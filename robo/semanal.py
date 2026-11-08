# -*- coding: utf-8 -*-
"""Resumo semanal e briefing diário do Oregon Intelligence (sem IA; com IA só o campo "mudanças de visão").

Briefing (hoje.json): 5 a 8 prioridades com variedade de fonte e tema, macro oficial, publicações de gestoras,
vídeos, uma leitura recomendada (rotativa, nunca repetida em 30 dias) e perguntas de estudo ligadas aos temas do dia.
Semanal (semanal.json): por semana ISO, os temas mais presentes, as teses publicadas (cartas e research), o que mais
se repetiu entre fontes, o que faltou (temas com pouca fonte primária) e os assuntos para estudo.
"""
import datetime as dt

import analise


def _pub(x):
    return x.get('publicado_em') or x.get('detectado_em') or ''


def _pontos(x):
    return (x.get('prioridade') or {}).get('pontos', 0)


def _variedade(cands, n, max_fonte=2, max_tema=3):
    out, por_fonte, por_tema = [], {}, {}
    for x in cands:
        f = x.get('fonte_id')
        t = (x.get('temas') or ['-'])[0]
        if por_fonte.get(f, 0) >= max_fonte or por_tema.get(t, 0) >= max_tema:
            continue
        out.append(x)
        por_fonte[f] = por_fonte.get(f, 0) + 1
        por_tema[t] = por_tema.get(t, 0) + 1
        if len(out) >= n:
            break
    return out


def briefing(itens, macro, hoje, agora_, estado, n_min=5, n_max=8):
    """Monta o briefing do dia a partir dos itens recentes (lista já sem agrupados)."""
    ontem = (hoje - dt.timedelta(days=2)).isoformat()
    semana = (hoje - dt.timedelta(days=7)).isoformat()
    # prioridades de LEITURA: cartas, research e documentos oficiais (a imprensa vai para "Últimas notícias" no painel).
    # Acervo nunca entra; sem data de publicação, só o que foi detectado como novo nos últimos 2 dias.
    leitura_itens = [x for x in itens if not x.get('acervo') and x.get('categoria') != 'veiculo' and (x.get('publicado_em') or (x.get('detectado_em') or '')[:10] >= ontem)]
    frescos = [x for x in leitura_itens if _pub(x)[:10] >= ontem]
    base = frescos if len(frescos) >= n_min else [x for x in leitura_itens if _pub(x)[:10] >= semana]
    janela = '48 horas' if base is frescos else '7 dias'
    base = sorted(base, key=lambda x: (_pontos(x), _pub(x)), reverse=True)
    sem_ruido = [x for x in base if x.get('natureza') not in ('promocional', 'recomendacao')]
    prioridades = _variedade(sem_ruido, n_max)
    if len(prioridades) < n_min:
        prioridades = _variedade(sem_ruido, n_min, max_fonte=3, max_tema=4)
    ids = {x['id'] for x in prioridades}
    macro_itens = [x for x in base if x['id'] not in ids and x.get('categoria') == 'instituicao' and x.get('tipo') != 'video'][:5]
    gestoras = [x for x in base if x['id'] not in ids and x.get('categoria') in ('gestora_brasil', 'gestora_internacional') and x.get('tipo') != 'video'][:6]
    videos = [x for x in base if x.get('tipo') == 'video'][:3]
    # leitura recomendada: a carta ou research de maior pontuação dos últimos 30 dias ainda não recomendada
    lidas = estado.setdefault('leituras_recomendadas', [])
    mes = (hoje - dt.timedelta(days=30)).isoformat()
    cand = [x for x in itens if x.get('publicado_em') and _pub(x)[:10] >= mes and not x.get('acervo') and x.get('tipo') in ('carta', 'research', 'paper', 'macro', 'relatorio') and x['id'] not in lidas and x.get('natureza') == 'original']
    cand.sort(key=_pontos, reverse=True)
    leitura = cand[0] if cand else None
    if leitura:
        lidas.append(leitura['id'])
        del lidas[:-60]
    temas_dia = []
    for x in prioridades:
        for t in x.get('temas') or []:
            if t not in temas_dia:
                temas_dia.append(t)
    perguntas = analise.perguntas_estudo(temas_dia, 3)
    ag = ((macro or {}).get('agenda') or {}).get('itens') or []
    prox = [a for a in ag if a.get('data', '') >= hoje.isoformat()][:6]

    def rel(x):
        return {'id': x['id'], 'mes': (x.get('publicado_em') or x.get('detectado_em') or '')[:7]}
    return {'gerado_em': agora_.isoformat(timespec='minutes'), 'data': hoje.isoformat(), 'janela': janela, 'n_itens_janela': len(base),
            'prioridades': [rel(x) for x in prioridades], 'macro': [rel(x) for x in macro_itens], 'gestoras': [rel(x) for x in gestoras], 'videos': [rel(x) for x in videos],
            'leitura': rel(leitura) if leitura else None, 'temas': temas_dia[:6], 'estudo': perguntas, 'agenda': prox,
            'aviso': None if any((x.get('analise') or {}).get('profunda') for x in prioridades) else 'Leitura por IA desligada: a leitura de cada item vem de regras sobre título e resumo público e abre com a fonte original.'}


def semana_iso(d):
    y, w, _ = d.isocalendar()
    return '%d-S%02d' % (y, w)


def limites_semana(d):
    ini = d - dt.timedelta(days=d.weekday())
    return ini, ini + dt.timedelta(days=6)


def resumo_semana(itens, ref, agora_, ia=None):
    """Resumo determinístico da semana ISO que contém `ref` (date). `ia` opcional: {'mudancas_visao': [...]}."""
    ini, fim = limites_semana(ref)
    sem = [x for x in itens if ini.isoformat() <= _pub(x)[:10] <= fim.isoformat() and not x.get('agrupado_em')]
    temas, fontes, tipos, regioes = {}, {}, {}, {}
    for x in sem:
        for t in x.get('temas') or []:
            temas[t] = temas.get(t, 0) + 1
        for r in x.get('regioes') or []:
            regioes[r] = regioes.get(r, 0) + 1
        fontes[x.get('organizacao') or x.get('fonte')] = fontes.get(x.get('organizacao') or x.get('fonte'), 0) + 1
        tipos[x.get('tipo')] = tipos.get(x.get('tipo'), 0) + 1
    top_temas = sorted([kv for kv in temas.items() if kv[0] != 'carta_gestor'], key=lambda kv: -kv[1])[:6]  # 'carta_gestor' é formato, não assunto
    teses = sorted([x for x in sem if x.get('tipo') in ('carta', 'research', 'paper', 'macro', 'relatorio') and x.get('natureza') == 'original'], key=_pontos, reverse=True)[:8]
    repetidos = sorted([x for x in sem if x.get('tambem_em')], key=lambda x: -len(x['tambem_em']))[:5]
    primarias = {t: 0 for t, _ in top_temas}
    for x in sem:
        if x.get('categoria') in ('gestora_brasil', 'gestora_internacional', 'instituicao', 'academia'):
            for t in x.get('temas') or []:
                if t in primarias:
                    primarias[t] += 1
    estudo = [t for t, n in top_temas if primarias.get(t, 0) <= max(1, n // 4)]
    perguntas = analise.perguntas_estudo([t for t, _ in top_temas], 4)
    ativos = {}
    for x in sem:
        for a in x.get('ativos') or []:
            ativos[a] = ativos.get(a, 0) + 1

    def rel(x):
        return {'id': x['id'], 'mes': _pub(x)[:7], 'titulo': x.get('titulo'), 'fonte': x.get('organizacao') or x.get('fonte'), 'link': x.get('link'), 'tipo': x.get('tipo')}
    out = {'semana': semana_iso(ref), 'inicio': ini.isoformat(), 'fim': fim.isoformat(), 'gerado_em': agora_.isoformat(timespec='minutes'), 'n_itens': len(sem),
           'temas': [{'tema': t, 'nome': analise.TEMA_NOME.get(t, t), 'n': n, 'fontes_primarias': primarias.get(t, 0)} for t, n in top_temas],
           'regioes': sorted(regioes.items(), key=lambda kv: -kv[1])[:5], 'fontes_mais_ativas': sorted(fontes.items(), key=lambda kv: -kv[1])[:8], 'tipos': tipos,
           'teses': [rel(x) for x in teses], 'mais_repetidos': [dict(rel(x), em=len(x['tambem_em']) + 1) for x in repetidos],
           'ativos_citados': sorted(ativos.items(), key=lambda kv: -kv[1])[:10],
           'estudar': [{'tema': t, 'nome': analise.TEMA_NOME.get(t, t), 'porque': 'tema frequente na semana com pouca fonte primária: vale buscar a leitura original'} for t in estudo[:4]],
           'perguntas': perguntas,
           'mudancas_visao': (ia or {}).get('mudancas_visao') if ia else None,
           'mudancas_visao_nota': None if ia else 'Comparar a visão desta semana com a anterior exige leitura dos textos: disponível só com a análise por IA ligada.'}
    return out
