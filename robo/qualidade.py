# -*- coding: utf-8 -*-
"""Avaliação da rodada: COMPLETA, PARCIAL ou CRÍTICA, com os motivos. Também escreve o resumo que aparece na
página da execução no GitHub (Actions → rodada → Summary) e as saídas usadas pelo workflow."""
import os

from util import num

NIVEIS = ('completo', 'parcial', 'critico')


def avaliar(cfg, fontes, cob, erros_config=None, telegram=None):
    q = cfg['qualidade']
    motivos, nivel = [], 'completo'

    def sobe(n, m):
        nonlocal nivel
        motivos.append(m)
        if NIVEIS.index(n) > NIVEIS.index(nivel):
            nivel = n
    if erros_config:
        sobe('critico', 'configuração inválida: ' + '; '.join(erros_config[:3]))
        return {'nivel': nivel, 'motivos': motivos}
    taxa = cob.get('taxa_sucesso', 0)
    if taxa < q['critico_abaixo_pct']:
        sobe('critico', 'só %s de %s cotações atualizadas (%s%%; mínimo para não ser crítico: %s%%)' % (cob.get('atualizados'), cob.get('total'), num(taxa, 0), q['critico_abaixo_pct']))
    elif taxa < q['completo_min_pct']:
        sobe('parcial', '%s de %s cotações atualizadas (%s%%; completo a partir de %s%%)' % (cob.get('atualizados'), cob.get('total'), num(taxa, 0), q['completo_min_pct']))
    if cob.get('indisponiveis'):
        sobe('parcial', '%d ativo(s) sem cotação: %s' % (cob['indisponiveis'], ', '.join(cob.get('lista_indisponiveis', [])[:8])))
    if cob.get('suspeitos'):
        sobe('parcial', '%d cotação(ões) com variação anormal para conferir: %s' % (cob['suspeitos'], ', '.join(cob.get('lista_suspeitos', []))))
    for f in ('bcb', 'focus', 'tesouro', 'treasury'):
        x = fontes.get(f)
        if x and x.get('ok') is False:
            sobe('parcial', 'fonte %s falhou: %s' % (f, x.get('msg', '')[:120]))
    if (fontes.get('bcb') or {}).get('ok') is False and taxa < q['completo_min_pct']:
        sobe('critico', 'sem Banco Central e com cotações incompletas')
    x = fontes.get('noticias')
    if x and x.get('ok') is False:
        sobe('parcial', 'notícias: ' + (x.get('msg') or '')[:120])
    if telegram and telegram.get('ok') is False:
        sobe('parcial', 'Telegram: ' + (telegram.get('msg') or '')[:160])
    return {'nivel': nivel, 'motivos': motivos}


def resumo_md(snap):
    st, cob = snap.get('status') or {}, snap.get('cobertura') or {}
    icone = {'completo': '✅', 'parcial': '⚠️', 'critico': '❌'}.get(st.get('nivel'), '•')
    L = ['## %s Robô Oregon · rodada %s' % (icone, (st.get('nivel') or '').upper()), '', 'Gerado em %s.' % snap.get('gerado_em', '')]
    for m in st.get('motivos') or []:
        L.append('- ' + m)
    L += ['', '### Cobertura das cotações', '', '| Total | Atualizadas | Intradiárias | Fechamento | Desatualizadas | Suspeitas | Indisponíveis | Sucesso |', '|---|---|---|---|---|---|---|---|',
          '| %s | %s | %s | %s | %s | %s | %s | %s%% |' % (cob.get('total'), cob.get('atualizados'), cob.get('intradiarios'), cob.get('fechamentos'), cob.get('desatualizados'),
                                                   cob.get('suspeitos'), cob.get('indisponiveis'), num(cob.get('taxa_sucesso'), 1))]
    if cob.get('fontes_sem_chave'):
        L += ['', 'Fontes sem chave configurada (ficaram de fora): ' + ', '.join(cob['fontes_sem_chave'])]
    L += ['', '### Fornecedores', '', '| Fonte | Tentativas | Acertos | Falhas por tipo | Pausada |', '|---|---|---|---|---|']
    for f, s in (cob.get('por_fornecedor') or {}).items():
        L.append('| %s | %s | %s | %s | %s |' % (f, s.get('tentativas'), s.get('ok'), ', '.join('%s: %s' % kv for kv in s.get('falhas', {}).items()) or '—', s.get('pausada_por') or ''))
    if cob.get('lista_indisponiveis'):
        L += ['', '### Sem cotação', '']
        for t in cob['lista_indisponiveis']:
            c = (snap.get('ativos') or {}).get(t) or (snap.get('fatores') or {}).get(t) or {}
            L.append('- **%s**: %s' % (t, c.get('motivo', '')))
    if cob.get('lista_desatualizados'):
        L += ['', 'Desatualizadas: ' + ', '.join(cob['lista_desatualizados'])]
    L += ['', '### Outras fontes', '', '| Fonte | Situação | Detalhe |', '|---|---|---|']
    for k, v in (snap.get('fontes') or {}).items():
        L.append('| %s | %s | %s |' % (k, 'ok' if v.get('ok') else ('—' if v.get('ok') is None else 'falhou'), (v.get('msg') or '').replace('|', '/')))
    return '\n'.join(L) + '\n'


def publicar_saidas(snap, pular=False, extra_md=''):
    """Escreve o resumo da execução e as saídas do passo, quando roda no GitHub Actions."""
    caminho = os.environ.get('GITHUB_STEP_SUMMARY')
    if caminho and not pular:
        with open(caminho, 'a', encoding='utf-8') as f:
            f.write(resumo_md(snap) + (extra_md or ''))
    saida = os.environ.get('GITHUB_OUTPUT')
    if saida:
        st = snap.get('status') or {}
        with open(saida, 'a', encoding='utf-8') as f:
            f.write('pular=%s\n' % ('true' if pular else 'false'))
            f.write('status=%s\n' % (st.get('nivel') or 'completo'))
            f.write('motivos=%s\n' % ' | '.join(st.get('motivos') or [])[:900].replace('\n', ' '))
