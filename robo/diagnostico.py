# -*- coding: utf-8 -*-
"""Modo diagnóstico (Actions → Run workflow → modo "diagnostico").

Testa cada ativo em cada fonte, um por um, sem disjuntor, e registra o resultado:
  - Yahoo com e sem o sufixo .SA (para os da B3), com nome, bolsa e início de negociação que a fonte informa;
  - brapi (se houver chave);
  - arquivo oficial da B3 do último pregão: o código existe? nome, especificação e ISIN oficiais; e, se não existir,
    quais códigos parecidos (mesmo radical) foram negociados, o que denuncia troca de ticker;
  - Tiingo para os ETFs americanos (se houver chave).
O resultado vai para o resumo da execução no GitHub e para data/diagnostico.json (o painel mostra)."""
import datetime as dt
import time

import b3
import cotacoes
from util import ErroFonte, Rede


def _linha(id_, fonte, ok, detalhe):
    return {'ativo': id_, 'fonte': fonte, 'ok': ok, 'detalhe': detalhe}


def rodar(cfg, ctx, log=print):
    rede = Rede(prazo_seg=12 * 60, pausa_apos=10 ** 6)
    rede.dormir = ctx.get('dormir', time.sleep)
    ctx = dict(ctx, rede=rede)
    linhas = []
    # índice do último arquivo diário da B3: todos os códigos negociados
    indice, nome_arq = {}, None
    ult = dt.date.fromisoformat(ctx['fechada_b3'])
    usar_b3 = (cfg.get('b3_arquivos') or {}).get('ativo', False)  # desligado por padrão: os termos da B3 vedam coleta automatizada
    if not usar_b3:
        linhas.append(_linha('B3', 'arquivo oficial', None, 'não consultado: a B3 veda coleta automatizada das cotações históricas (ver docs/FONTES.md)'))
    for _ in range(5 if usar_b3 else 0):
        nome_arq = 'COTAHIST_D%02d%02d%d.ZIP' % (ult.day, ult.month, ult.year)
        try:
            for ln in b3.baixar(rede, nome_arq, timeout=90):
                if len(ln) >= 245 and ln[:2] == '01' and ln[24:27] == '010':
                    indice[ln[12:24].strip()] = {'nome': ln[27:39].strip(), 'especificacao': ln[39:49].strip(), 'isin': ln[230:242].strip(),
                                                 'fechamento': int(ln[108:121]) / 100.0 / (int(ln[210:217]) or 1), 'data': ult.isoformat()}
            break
        except ErroFonte as e:
            linhas.append(_linha('B3', nome_arq, False, str(e)))
            ult -= dt.timedelta(days=1)
    for item in cfg['ativos']:
        t = item['id']
        if item.get('mercado') == 'B3':
            for simb in (item.get('yahoo') or t + '.SA', t):
                try:
                    c = cotacoes.yahoo(rede, simb)
                    idn = c.get('identificacao') or {}
                    linhas.append(_linha(t, 'Yahoo ' + simb, True, '%s · %s · %s · bolsa %s · início %s' % (c['data'], c['preco'], idn.get('nome') or '?', idn.get('bolsa') or '?', idn.get('inicio') or '?')))
                except ErroFonte as e:
                    linhas.append(_linha(t, 'Yahoo ' + simb, False, str(e)))
                rede.dormir(1)
            if ctx['chaves'].get('brapi'):
                try:
                    c = cotacoes.brapi(rede, t, ctx['chaves']['brapi'])
                    linhas.append(_linha(t, 'brapi', True, '%s · %s · %s' % (c['data'], c['preco'], (c.get('identificacao') or {}).get('nome') or '?')))
                except ErroFonte as e:
                    linhas.append(_linha(t, 'brapi', False, str(e)))
            else:
                linhas.append(_linha(t, 'brapi', None, 'sem BRAPI_TOKEN'))
            if indice:
                x = indice.get(item.get('b3') or t)
                if x:
                    linhas.append(_linha(t, 'B3 ' + nome_arq, True, 'negociado em %s · fechamento %s · %s %s · ISIN %s' % (x['data'], x['fechamento'], x['nome'], x['especificacao'], x['isin'])))
                else:
                    raiz = t[:4]
                    parecidos = sorted(k for k in indice if k.startswith(raiz))
                    linhas.append(_linha(t, 'B3 ' + nome_arq, False, 'código não negociado neste pregão' + ('; códigos parecidos: ' + ', '.join(parecidos[:6]) if parecidos else '; nenhum código com o radical ' + raiz)))
        else:
            simb = item.get('yahoo') or t
            try:
                c = cotacoes.yahoo(rede, simb)
                idn = c.get('identificacao') or {}
                linhas.append(_linha(t, 'Yahoo ' + simb, True, '%s · %s · %s · bolsa %s' % (c['data'], c['preco'], idn.get('nome') or '?', idn.get('bolsa') or '?')))
            except ErroFonte as e:
                linhas.append(_linha(t, 'Yahoo ' + simb, False, str(e)))
            rede.dormir(1)
            if ctx['chaves'].get('tiingo'):
                try:
                    c = cotacoes.tiingo(rede, item.get('tiingo') or t, ctx['chaves']['tiingo'], ctx['hoje'])
                    linhas.append(_linha(t, 'Tiingo', True, '%s · %s' % (c['data'], c['preco'])))
                except ErroFonte as e:
                    linhas.append(_linha(t, 'Tiingo', False, str(e)))
    for k, f in (cfg.get('fatores_cotacao') or {}).items():
        for tok in f['fontes']:
            try:
                c = cotacoes.chamar(tok, dict(f, id=k), ctx)
                linhas.append(_linha(k, tok, True, '%s · %s · %+.2f%%' % (c['data'], round(c['preco'], 4), c['var'])))
            except ErroFonte as e:
                linhas.append(_linha(k, tok, False, str(e)))
    return {'gerado_em': ctx['agora'].isoformat(timespec='seconds'), 'linhas': linhas, 'fornecedores': rede.resumo(), 'arquivo_b3': nome_arq if indice else None}


def md(d):
    L = ['', '## Diagnóstico por ativo e fonte', '', '| Ativo | Fonte | Resultado | Detalhe |', '|---|---|---|---|']
    for x in d['linhas']:
        L.append('| %s | %s | %s | %s |' % (x['ativo'], x['fonte'], 'ok' if x['ok'] else ('—' if x['ok'] is None else 'falhou'), str(x['detalhe']).replace('|', '/')))
    return '\n'.join(L) + '\n'
