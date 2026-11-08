#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Robô de mercado · Carteira Oregon (versão 2)

Roda no GitHub Actions (.github/workflows/robo.yml). O GitHub dispara a cada 30 minutos; a agenda de
robo/config.json decide quando o robô trabalha. Em cada rodada:
  1. juros, inflação e câmbio oficiais (Banco Central, Focus, Tesouro Direto, Tesouro dos EUA);
  2. cotações: cada ativo tenta as fontes na ordem da configuração e sai com fonte, data, hora, tipo de preço
     e status (atualizado, desatualizado, suspeito, indisponível);
  3. relatório de cobertura e avaliação da rodada (completa, parcial ou crítica);
  4. notícias classificadas por relevância (de hora em hora);
  5. alertas e resumo no Telegram;
  6. à noite, séries históricas para o modelo de risco do painel.
Arquivos em data/: mercado.json, historico.json, noticias.json, status.json (publicados no site) e
estado.json, b3_cache.json (internos, só no ramo "dados").

Modos (variável ROBO_MODO): normal | teste_telegram | diagnostico.
Chaves (Secrets do GitHub, nunca em arquivo): TELEGRAM_TOKEN, TELEGRAM_CHAT_ID e, opcionais, BRAPI_TOKEN,
TIINGO_TOKEN, FRED_API_KEY, AWESOMEAPI_KEY, ANTHROPIC_API_KEY.
"""
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import agenda  # noqa: E402
import avisos  # noqa: E402
import b3  # noqa: E402
import calendario  # noqa: E402
import config  # noqa: E402
import cotacoes  # noqa: E402
import diagnostico  # noqa: E402
import fontes_macro  # noqa: E402
import historico  # noqa: E402
import noticias  # noqa: E402
import qualidade  # noqa: E402
import resultados  # noqa: E402
from util import ErroFonte, Rede, agora, gravar, ler, log, num  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
FATOR_PP = ('selic', 'pre', 'real', 'ust2', 'ust10')


def fator_de_serie(k, pts, nome, fonte, ref, unid='% a.a.'):
    if not pts or len(pts) < 2:
        return {'k': k, 'nome': avisos.FATOR_NOME[k], 'ok': False, 'status': 'indisponivel', 'motivo': 'série sem dois pontos'}
    (d0, v0), (d1, v1) = pts[-2], pts[-1]
    st = 'atualizado' if d1 >= ref else 'desatualizado'
    return {'k': k, 'nome': avisos.FATOR_NOME[k], 'detalhe': nome, 'ok': True, 'nivel': v1, 'anterior': v0, 'var': round(v1 - v0, 4), 'uvar': 'pp',
            'unid': unid, 'data': d1, 'data_anterior': d0, 'fonte': fonte, 'status': st, 'tipo_preco': 'fechamento',
            'motivo': '' if st == 'atualizado' else 'dado de %s; esperado a partir de %s' % (d1, ref)}


def fator_de_cotacao(k, f, c):
    base = {'k': k, 'nome': f.get('nome') or avisos.FATOR_NOME.get(k, k), 'unid': f.get('unid'), 'uvar': '%'}
    if c.get('status') == 'indisponivel':
        base.update({'ok': False, 'status': 'indisponivel', 'motivo': c.get('motivo'), 'tentativas': c.get('tentativas')})
        return base
    base.update({'ok': True, 'nivel': c['preco'], 'anterior': c['anterior'], 'var': c['var'], 'data': c['data'], 'hora': c.get('hora'), 'fonte': c['fonte'],
                 'status': c['status'], 'motivo': c.get('motivo', ''), 'tipo_preco': c.get('tipo_preco'), 'provedor': c.get('provedor'), 'tentativas': c.get('tentativas')})
    return base


def contexto(cfg, agora_, rede, chaves):
    fer = set(cfg['feriados_b3'])
    ag = cfg['agenda']
    hoje = agora_.date()
    sessao_eua = hoje if (hoje.weekday() < 5 and agora_.strftime('%H:%M') >= '11:30') else calendario.dias_uteis_atras(hoje, 1)
    fechada_eua = hoje if (hoje.weekday() < 5 and agora_.strftime('%H:%M') >= '20:00') else calendario.dias_uteis_atras(hoje, 1)
    return {'rede': rede, 'chaves': chaves, 'agora': agora_, 'hoje': hoje, 'feriados': fer,
            'sessao_b3': calendario.ultima_sessao(agora_, fer, ag['abertura_b3']).isoformat(),
            'fechada_b3': calendario.ultima_sessao_fechada(agora_, fer, ag['publicacao_b3']).isoformat(),
            'sessao_eua': sessao_eua.isoformat(), 'fechada_eua': fechada_eua.isoformat(),
            'tolerancia': cfg['qualidade']['tolerancia_dias'], 'anomalia': cfg['qualidade']['anomalia_pct'],
            'anos': cfg['historico']['anos'], 'brapi_faixa': cfg['historico']['brapi_faixa']}


def coletar_macro(cfg, ctx, estado, anterior, fat, ind, fontes, marca):
    rede, hoje = ctx['rede'], ctx['hoje']
    ok_bcb, erros_bcb = 0, []
    for s in cfg.get('bcb_series') or []:
        try:
            pts = fontes_macro.sgs(rede, s['codigo'], s.get('dias', 30), hoje)
            if not pts:
                raise ErroFonte('Banco Central', 'vazio', 'SGS %s' % s['codigo'])
        except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
            erros_bcb.append('%s: %s' % (s['id'], e))
            continue
        ok_bcb += 1
        x = {'nome': s.get('nome', s['id']), 'nivel': pts[-1][1], 'unid': s.get('unid', ''), 'data': pts[-1][0], 'fonte': 'Banco Central · SGS %d' % s['codigo']}
        if len(pts) >= 2 and not s.get('mensal'):
            x['anterior'] = pts[-2][1]
            x['var'] = (pts[-1][1] / pts[-2][1] - 1) * 100 if s.get('unid') == 'R$' and pts[-2][1] else round(pts[-1][1] - pts[-2][1], 4)
        ind[s['id']] = x
        if s['id'] == 'selic':
            fat['selic'] = fator_de_serie('selic', pts, s.get('nome'), x['fonte'], calendario.anterior(hoje, ctx['feriados']).isoformat())
    fontes['bcb'] = {'ok': ok_bcb > 0 and not erros_bcb, 'quando': marca, 'msg': ('%d de %d séries' % (ok_bcb, len(cfg.get('bcb_series') or []))) + ('; ' + '; '.join(erros_bcb[:3]) if erros_bcb else '')}
    if ok_bcb == 0:
        fontes['bcb']['ok'] = False
    try:
        ind['focus'] = fontes_macro.focus(rede, hoje)
        fontes['focus'] = {'ok': True, 'quando': marca, 'msg': ''}
    except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
        fontes['focus'] = {'ok': False, 'quando': marca, 'msg': str(e)}
    ult = estado.get('tesouro_em')
    velho = not ult or (ctx['agora'] - dt.datetime.fromisoformat(ult)).total_seconds() > 3 * 3600
    tz = None
    if velho or not (anterior.get('fatores') or {}).get('pre', {}).get('ok'):
        try:
            tz = fontes_macro.tesouro(rede, cfg['tesouro'], hoje - dt.timedelta(days=20))
            ref = calendario.anterior(hoje, ctx['feriados']).isoformat()
            for k in ('pre', 'real'):
                if k in tz:
                    fat[k] = fator_de_serie(k, tz[k]['pts'], tz[k]['nome'] + ' (taxa de compra)', 'Tesouro Transparente', ref)
            estado['tesouro_em'] = ctx['agora'].isoformat()
            fontes['tesouro'] = {'ok': True, 'quando': marca, 'msg': ''}
        except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
            fontes['tesouro'] = {'ok': False, 'quando': marca, 'msg': str(e)}
    ref_tz = calendario.anterior(hoje, ctx['feriados']).isoformat()
    for k in ('pre', 'real'):
        if k not in fat and (anterior.get('fatores') or {}).get(k, {}).get('ok'):
            fat[k] = dict(anterior['fatores'][k])
            if (fat[k].get('data') or '') < ref_tz:  # o reaproveitado não herda "atualizado"
                fat[k].update({'status': 'desatualizado', 'reaproveitado': True, 'motivo': 'último valor válido (%s); esperado a partir de %s' % (fat[k].get('data'), ref_tz)})
            if 'tesouro' not in fontes:
                fontes['tesouro'] = {'ok': True, 'quando': estado.get('tesouro_em'), 'msg': 'reaproveitado da leitura de até 3 horas atrás'}
    try:
        us = fontes_macro.treasury(rede, [hoje.year - 1, hoje.year] if hoje.month == 1 else [hoje.year])
        ref = calendario.dias_uteis_atras(hoje, 2).isoformat()
        fat['ust2'] = fator_de_serie('ust2', us['2 Yr'], 'Treasury 2 anos', 'Tesouro dos EUA', ref)
        fat['ust10'] = fator_de_serie('ust10', us['10 Yr'], 'Treasury 10 anos', 'Tesouro dos EUA', ref)
        fontes['treasury'] = {'ok': True, 'quando': marca, 'msg': ''}
    except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
        fontes['treasury'] = {'ok': False, 'quando': marca, 'msg': str(e)}
    return tz


def gravar_versao(snap, estado, hist):
    """Arquivo de poucos bytes que o site consulta para saber se há dado novo, sem baixar os arquivos grandes."""
    gravar('versao.json', {'gerado_em': snap.get('gerado_em'), 'verificado_em': snap.get('verificado_em') or snap.get('gerado_em'), 'noticias_em': estado.get('noticias_em'),
                           'historico': (hist or {}).get('data_ref'), 'resultados_em': estado.get('resultados_em')})


def main():
    agora_ = agora()
    hoje = agora_.date()
    marca = agora_.isoformat(timespec='minutes')
    modo = (os.environ.get('ROBO_MODO') or 'normal').strip().lower()
    manual = os.environ.get('ROBO_MANUAL') in ('1', 'true', 'True') or modo != 'normal'
    estado = ler('estado.json', {}) or {}
    anterior = ler('mercado.json', {}) or {}
    log('Robô Oregon v2 · %s · modo %s' % (agora_.strftime('%d/%m/%Y %H:%M'), modo))

    # ---- configuração
    try:
        cfg = config.carregar(os.environ.get('ROBO_CONFIG') or os.path.join(AQUI, 'config.json'))
        erros = config.validar(cfg)
    except Exception as e:
        cfg, erros = None, ['robo/config.json não pôde ser lido: %s' % e]
    if erros:
        snap = json.loads(json.dumps(anterior or {}))
        snap.update({'versao': 2, 'verificado_em': agora_.isoformat(timespec='seconds')})
        snap.setdefault('gerado_em', agora_.isoformat(timespec='seconds'))  # mantém a data da última coleta válida
        for grupo in ('ativos', 'fatores'):
            for x in (snap.get(grupo) or {}).values():
                if isinstance(x, dict) and x.get('status') in ('atualizado', 'suspeito'):
                    x.update({'status': 'desatualizado', 'motivo': 'configuração inválida: esta rodada não coletou; último valor válido (%s)' % (x.get('data') or '?')})
        snap['status'] = qualidade.avaliar(cfg or config.PADRAO, {}, {}, erros_config=erros)
        snap['erros_config'] = erros
        gravar('mercado.json', snap)
        gravar_versao(snap, estado, ler('historico.json') or {})
        gravar('status.json', {'gerado_em': snap['gerado_em'], 'status': snap['status'], 'cobertura': snap.get('cobertura')})
        for e in erros:
            log('  ! configuração: ' + e)
        # avisa no Telegram uma vez por dia enquanto a configuração continuar inválida
        marca_erro = hoje.isoformat() + '|' + '|'.join(erros)[:300]
        if estado.get('aviso_config') != marca_erro:
            okk, m = avisos.enviar('⚠ Robô Oregon: a configuração (robo/config.json) tem erros e a coleta está parada; '
                                   'o painel continua com os últimos dados válidos.\n\n' + '\n'.join('• ' + e for e in erros[:8]))
            if okk:
                estado['aviso_config'] = marca_erro
                gravar('estado.json', estado)
        qualidade.publicar_saidas(snap)
        return 0

    roda, porque = config.deve_rodar(agora_, cfg, manual, estado.get('fechamento_em'))
    if porque in ('rodada de fechamento', 'recuperação do fechamento da semana'):
        estado['fechamento_em'] = hoje.isoformat()
    if not roda:
        log('  sem trabalho agora: ' + porque)
        qualidade.publicar_saidas({}, pular=True)
        return 0
    if not calendario.cobre_ano(hoje.year, cfg['feriados_b3']):
        log('  ! os feriados da B3 de %d não estão em config.json (feriados_b3); dias sem pregão podem aparecer como dado desatualizado' % hoje.year)

    chaves = config.chaves()
    rede = Rede(prazo_seg=int(cfg['prazo_rodada_min']) * 60)
    ctx = contexto(cfg, agora_, rede, chaves)
    # Alpha Vantage: cota diária do plano gratuito controlada aqui; por padrão só na rodada de fechamento (ou manual)
    av = estado.get('alphavantage') or {}
    ctx['av_cota'] = {'limite': int(cfg['alphavantage'].get('limite_dia', 20)), 'usados': int(av.get('n', 0)) if av.get('dia') == hoje.isoformat() else 0}
    ctx['av_so_fechamento'] = bool(cfg['alphavantage'].get('so_fechamento', True))
    ctx['fechamento'] = manual or porque in ('rodada de fechamento', 'recuperação do fechamento da semana')
    fat, ind, fontes = {}, {}, {}

    # ---- 1. juros, inflação e câmbio oficiais
    tz = coletar_macro(cfg, ctx, estado, anterior, fat, ind, fontes, marca)
    ctx['indicadores'] = ind

    # ---- 2. arquivo oficial da B3 (diários; a carga anual só na montagem do histórico)
    hc = cfg['historico']
    hist_ant = ler('historico.json')
    hora_hist = agora_.strftime('%H:%M') >= hc['horario']
    ref_hist = (hist_ant or {}).get('data_ref') or ''
    fazer_hist = (hist_ant is None or (hora_hist and ref_hist < hoje.isoformat())
                  or (porque.startswith('recuperação') and ref_hist < ctx['fechada_b3']))
    b3_cache = ler('b3_cache.json')
    tickers_b3 = [a.get('b3') or a['id'] for a in cfg['ativos'] if a.get('mercado') == 'B3' and a.get('ativo', True)]
    if cfg['b3_arquivos'].get('ativo', False):  # desligado por padrão: a B3 veda coleta automatizada (docs/FONTES.md)
        try:
            b3_cache = b3.atualizar(rede, b3_cache, tickers_b3, hoje, dt.date.fromisoformat(ctx['fechada_b3']), ctx['feriados'],
                                    anos=cfg['b3_arquivos'].get('anos', 2), carga_anual=fazer_hist or not b3_cache, log=log)
            n_ok = sum(1 for t in tickers_b3 if (b3_cache['tickers'].get(t) or []))
            fontes['b3'] = {'ok': n_ok > 0, 'quando': marca, 'msg': '%d de %d ativos no arquivo oficial%s' % (n_ok, len(tickers_b3), ('; ' + '; '.join(b3_cache['falhas'][:2])) if b3_cache.get('falhas') else '')}
        except ErroFonte as e:
            fontes['b3'] = {'ok': False, 'quando': marca, 'msg': str(e)}
        except Exception as e:  # o arquivo da B3 nunca derruba a rodada
            fontes['b3'] = {'ok': False, 'quando': marca, 'msg': 'erro ao ler o arquivo da B3: %s' % type(e).__name__}
    ctx['b3_cache'] = b3_cache

    # ---- 3. cotações
    itens = {}
    ant_at, ant_ft = anterior.get('ativos') or {}, anterior.get('fatores') or {}
    for k, f in (cfg.get('fatores_cotacao') or {}).items():
        item = dict(f, id=k)
        prev = ant_ft.get(k)
        prev_c = {'preco': prev.get('nivel'), 'anterior': prev.get('anterior'), 'var': prev.get('var'), 'data': prev.get('data'), 'hora': prev.get('hora'), 'fonte': prev.get('fonte'),
                  'tipo_preco': prev.get('tipo_preco'), 'status': prev.get('status', 'atualizado') if prev.get('ok') else 'indisponivel', 'provedor': prev.get('provedor')} if prev else None
        c = cotacoes.cotar(item, ctx, prev_c)
        itens[k] = c
        fat[k] = fator_de_cotacao(k, f, c)
    ativos = {}
    for a in cfg['ativos']:
        if not a.get('ativo', True):
            continue
        c = cotacoes.cotar(a, ctx, ant_at.get(a['id']))
        c.setdefault('moeda', 'USD' if a.get('mercado') != 'B3' else 'BRL')
        if c.get('moeda') not in ('BRL', 'USD'):
            c['moeda'] = 'USD' if a.get('mercado') != 'B3' else 'BRL'
        itens[a['id']] = c
        if c['status'] != 'indisponivel':
            ativos[a['id']] = c
        else:
            ativos[a['id']] = {'status': 'indisponivel', 'motivo': c['motivo'], 'tentativas': c.get('tentativas')}
    sem_chave = {t['fonte'].split(':')[0] for c in itens.values() for t in c.get('tentativas') or [] if t.get('erro') == 'sem_chave'}
    cob = cotacoes.cobertura(itens, rede.resumo(), sem_chave)
    fontes['cotacoes'] = {'ok': cob['taxa_sucesso'] >= cfg['qualidade']['critico_abaixo_pct'], 'quando': marca,
                          'msg': '%d de %d atualizadas (%d intradiárias, %d de fechamento), %d desatualizadas, %d suspeitas, %d indisponíveis' % (
                              cob['atualizados'], cob['total'], cob['intradiarios'], cob['fechamentos'], cob['desatualizados'], cob['suspeitos'], cob['indisponiveis'])}
    log('  cotações: ' + fontes['cotacoes']['msg'])

    snap = {'versao': 2, 'gerado_em': agora_.isoformat(timespec='seconds'), 'referencias': {k: ctx[k] for k in ('sessao_b3', 'fechada_b3', 'sessao_eua', 'fechada_eua')},
            'fatores': fat, 'indicadores': ind, 'ativos': ativos, 'cobertura': cob, 'fontes': fontes, 'limites': cfg['limites']}

    # ---- 4. notícias (de hora em hora; sempre em modo manual)
    ult_n = estado.get('noticias_em')
    if manual or not ult_n or (agora_ - dt.datetime.fromisoformat(ult_n)).total_seconds() > (cfg['noticias']['intervalo_min'] - 5) * 60:
        arq = ler('noticias.json', {}) or {}
        nots, erros_n, ok_n = noticias.coletar(rede, cfg, (anterior.get('noticias') or []) + arq.get('itens', []), hoje, estado, agora_)
        rel = sum(1 for x in nots if (x.get('classe') or {}).get('relevancia') in ('alta', 'media'))
        fontes['noticias'] = {'ok': bool(ok_n), 'quando': marca, 'msg': '%d itens (%d relevantes) de %s' % (len(nots), rel, ', '.join(sorted(ok_n)) or 'nenhuma fonte') + ('; falhas: ' + '; '.join(erros_n[:3]) if erros_n else '')}
        n_ia, msg_ia = noticias.ler_com_ia(rede, nots, cfg, chaves.get('anthropic'))
        fontes['ia'] = {'ok': (n_ia is not None) if chaves.get('anthropic') else None, 'quando': marca, 'msg': msg_ia or ('%d manchetes lidas' % n_ia)}
        if nots:
            gravar('noticias.json', noticias.arquivar(nots, arq, agora_))
            estado['noticias_em'] = agora_.isoformat()
        snap['noticias'] = nots
    else:
        snap['noticias'] = anterior.get('noticias') or []
        for k in ('noticias', 'ia'):
            if k in (anterior.get('fontes') or {}):
                fontes[k] = anterior['fontes'][k]

    # ---- 4b. agenda macro (IBGE uma vez por dia; Copom e Fed pelos calendários oficiais da configuração)
    try:
        snap['agenda'] = agenda.montar(rede, cfg, hoje, agora_, estado)
        ag = snap['agenda']
        fontes['agenda'] = {'ok': not ag['erros'], 'quando': marca, 'msg': '%d eventos nos próximos %d dias' % (len(ag['itens']), ag['dias']) + ('; falhas: ' + '; '.join(ag['erros']) if ag['erros'] else '')}
    except Exception as e:  # a agenda nunca derruba a rodada
        snap['agenda'] = anterior.get('agenda')
        fontes['agenda'] = {'ok': False, 'quando': marca, 'msg': 'agenda não montada: %s' % type(e).__name__}

    # ---- 5. avaliação preliminar, alertas e Telegram
    snap['status'] = qualidade.avaliar(cfg, fontes, cob)
    ip = ind.get('ipca_mes')
    if ip and not estado.get('ipca_visto'):
        estado['ipca_visto'] = ip['data']
    alertas = avisos.detectar(snap, cfg, estado, hoje)
    snap['alertas'] = alertas
    enviados = estado.get('enviados') or {}
    ja = set(x for v in enviados.values() for x in v)
    recente = (hoje - dt.timedelta(days=3)).isoformat()
    novos = [a for a in alertas if a['id'] not in ja and (a.get('data') or hoje.isoformat()) >= recente]
    tg = {'ok': None, 'msg': 'nada novo para avisar'}
    tem_tg = bool(os.environ.get('TELEGRAM_TOKEN'))
    if novos:
        okk, m = avisos.enviar(avisos.msg_alertas(novos, agora_, snap['status']))
        tg = {'ok': okk, 'msg': m or '%d alerta(s) enviado(s)' % len(novos)}
        if okk or not tem_tg:
            enviados.setdefault(hoje.isoformat(), []).extend(a['id'] for a in novos)
            ja.update(a['id'] for a in novos)
    if ip and ('ipca:' + ip['data']) in ja:
        estado['ipca_visto'] = ip['data']
    hm = agora_.strftime('%H:%M')
    if modo == 'teste_telegram':
        okv, mv = avisos.verificar()
        log('  Telegram: ' + mv)
        okk, m = avisos.enviar(avisos.msg_resumo(snap, cfg, hoje, 'teste do robô'))
        tg = {'ok': okk and okv, 'msg': (m or 'mensagem de teste entregue') + ' · ' + mv}
    elif cfg['alertas'].get('resumo_diario', True) and agora_.weekday() < 5 and hm >= cfg['agenda']['resumo_diario'] and estado.get('resumo') != hoje.isoformat():
        okk, m = avisos.enviar(avisos.msg_resumo(snap, cfg, hoje, 'fechamento'))
        tg = {'ok': okk, 'msg': m or 'resumo do dia enviado'}
        if okk:
            estado['resumo'] = hoje.isoformat()
    fontes['telegram'] = {'ok': tg['ok'] if tem_tg else None, 'quando': marca, 'msg': tg['msg'] if tem_tg else 'TELEGRAM_TOKEN não configurado'}
    estado['enviados'] = {k: v for k, v in enviados.items() if k >= (hoje - dt.timedelta(days=10)).isoformat()}

    # ---- 6. histórico (à noite, se faltar ou em modo manual)
    if fazer_hist:
        anos = hc['anos']
        dias = int(365.25 * anos) + 5
        sg = {}
        for chave_, cod in (('ptax', 1), ('cdi_diario', 12), ('selic', 432)):
            try:
                sg[chave_] = fontes_macro.sgs(rede, cod, dias, hoje)
            except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
                log('  ! histórico %s: %s' % (chave_, e if isinstance(e, ErroFonte) else 'resposta fora do formato esperado'))
        tz_h, us_h = None, None
        try:
            tz_h = fontes_macro.tesouro(rede, cfg['tesouro'], hoje - dt.timedelta(days=dias))
        except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
            log('  ! histórico Tesouro: %s' % e)
        try:
            us_h = fontes_macro.treasury(rede, list(range(hoje.year - anos, hoje.year + 1)))
        except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
            log('  ! histórico Treasury: %s' % e)
        S, relat = historico.construir(cfg, ctx, hist_ant, tz_h, sg, us_h)
        q = {}
        for s in S.values():
            q[s.get('qualidade', 'ok')] = q.get(s.get('qualidade', 'ok'), 0) + 1
        gravar('historico.json', {'versao': 2, 'gerado_em': agora_.isoformat(timespec='seconds'), 'data_ref': hoje.isoformat(), 'series': S, 'relatorio': relat})
        fontes['historico'] = {'ok': bool(S), 'quando': marca, 'msg': '%d séries (%s)' % (len(S), ', '.join('%s: %d' % kv for kv in sorted(q.items())))}
        log('  histórico: ' + fontes['historico']['msg'])
    elif hist_ant:
        fontes['historico'] = (anterior.get('fontes') or {}).get('historico') or {'ok': True, 'quando': hist_ant.get('gerado_em'), 'msg': 'gerado em %s' % hist_ant.get('gerado_em')}
    h = ler('historico.json') or {}
    snap['historico'] = {'disponivel': bool(h.get('series')), 'data_ref': h.get('data_ref'), 'n': len(h.get('series') or {})}

    # ---- 6b. resultados trimestrais (CVM, dados abertos): depois de alertas, Telegram e histórico, com prazo próprio,
    # na rodada de fechamento ou manual, a cada N dias. Um arquivo que falhar não apaga o que já estava lido.
    rc = cfg.get('resultados') or {}
    ult_r = estado.get('resultados_em') or ''
    if rc.get('ativo', True) and ctx['fechamento'] and (manual or not ult_r or ult_r[:10] <= (hoje - dt.timedelta(days=int(rc.get('intervalo_dias', 3)))).isoformat()):
        try:
            rede_cvm = Rede(prazo_seg=int(rc.get('prazo_min', 8)) * 60)
            res, erros_r = resultados.coletar(rede_cvm, cfg, hoje, log=log)
            ant_r = ler('resultados.json') or {}
            emp = resultados.mesclar(ant_r.get('empresas'), res['empresas'])
            if emp:
                gravar('resultados.json', {'gerado_em': agora_.isoformat(timespec='minutes'), 'empresas': emp, 'fora': res['fora'], 'arquivos': res['arquivos'], 'erros': erros_r,
                                           'fonte': 'CVM · Portal Dados Abertos (ITR e DFP)', 'licenca': 'ODbL · crédito à CVM',
                                           'nota': 'Valores em reais, como informados no formulário (DRE consolidada, versão mais recente). Trimestre = linha de três meses; o quarto trimestre não é calculado.'})
            if not erros_r:
                estado['resultados_em'] = agora_.isoformat(timespec='minutes')  # com falha, tenta de novo na próxima rodada de fechamento
            fontes['resultados'] = {'ok': bool(res['empresas']) and not erros_r, 'quando': marca, 'msg': '%d empresas lidas nesta rodada' % len(res['empresas']) + ('; falhas: ' + '; '.join(erros_r[:2]) if erros_r else '')}
        except Exception as e:
            fontes['resultados'] = {'ok': False, 'quando': marca, 'msg': 'resultados não lidos: %s' % (e if isinstance(e, ErroFonte) else type(e).__name__)}
    elif (anterior.get('fontes') or {}).get('resultados'):
        fontes['resultados'] = anterior['fontes']['resultados']

    # ---- 7. avaliação final, diagnóstico e gravação
    cob['por_fornecedor'] = rede.resumo()
    snap['status'] = qualidade.avaliar(cfg, fontes, cob, telegram=fontes['telegram'] if tem_tg else None)
    if modo == 'teste_telegram' and not tg['ok']:
        snap['status']['nivel'] = 'critico'
        snap['status']['motivos'].insert(0, 'teste do Telegram falhou: ' + tg['msg'])
    extra = ''
    if modo == 'diagnostico':
        dg = diagnostico.rodar(cfg, ctx, log=log)
        gravar('diagnostico.json', dg)
        extra = diagnostico.md(dg)
        log('  diagnóstico: %d testes gravados em data/diagnostico.json' % len(dg['linhas']))
    estado['alphavantage'] = {'dia': hoje.isoformat(), 'n': ctx['av_cota']['usados']}
    gravar('mercado.json', snap)
    gravar('status.json', {'gerado_em': snap['gerado_em'], 'status': snap['status'], 'cobertura': cob, 'fontes': fontes})
    gravar_versao(snap, estado, h)
    gravar('estado.json', estado)
    if b3_cache:
        gravar('b3_cache.json', b3_cache)
    for k, v in fontes.items():
        log('  %-10s %s %s' % (k, 'ok ' if v.get('ok') else ('—  ' if v.get('ok') is None else 'FALHOU'), (v.get('msg') or '')[:200]))
    log('  rodada: %s%s' % (snap['status']['nivel'].upper(), (' · ' + ' | '.join(snap['status']['motivos'][:3])) if snap['status']['motivos'] else ''))
    log('  alertas: %d (novos: %d)' % (len(alertas), len(novos)))
    qualidade.publicar_saidas(snap, extra_md=extra)
    return 0


if __name__ == '__main__':
    sys.exit(main())
