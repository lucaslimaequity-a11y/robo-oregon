"""Termômetro das cartas (v3.6): quais empresas brasileiras as cartas mensais das gestoras citaram no mês.

O robô abre o PDF público de cada carta nova das gestoras brasileiras (alguns por rodada, respeitando o robots.txt), tira
o texto com `pdftexto` e conta as citações. Carta publicada como página (Dynamo, Kinea, JGP) é lida pelo texto da página;
se a página só aponta para o PDF da carta, o PDF do mesmo site é aberto. Vídeo não tem texto e fica de fora. Conta: códigos de negociação escritos na carta (PETR4, ALOS3…) e o nome das
empresas das carteiras Oregon e VG VIP (pelos mesmos termos e exclusões das notícias). Fica guardada a contagem e, desde a
v3.7, até 2 frases literais por empresa e por carta (no máximo 280 caracteres cada, com o link da carta), para o leitor
ver em que contexto a gestora citou a empresa. O texto completo da carta nunca é guardado. Nada de opinião ou sentido
atribuído: a frase é a da carta, sem interpretação.
Mês da carta = data de publicação na fonte ou, sem ela, o mês de referência escrito no título ou no nome do arquivo."""
import datetime as dt
import html as _html
import re
from urllib.parse import urljoin, urlparse

import analise
import biblioteca
import pdftexto
from util import sem_acento

TICKER = re.compile(r'(?<![A-Z0-9])([A-Z]{4}(?:3|4|5|6|11))(?![A-Z0-9])')
# códigos que parecem ação mas são outra coisa nas cartas
NAO_TICKER = {'CDI11', 'IPCA3', 'SELIC3', 'NTNB11'}


def mes_da_carta(x):
    p = (x.get('publicado_em') or '')[:7]
    if p and not x.get('data_estimada'):
        return p
    return x.get('referencia') or (p if p else None)


def meses_janela(hoje, n):
    """Os n meses até o atual, sem pular nenhum (nov, out, set, ago…)."""
    a, m, out = hoje.year, hoje.month, []
    for _ in range(max(1, int(n))):
        out.append('%04d-%02d' % (a, m))
        m -= 1
        if m == 0:
            a, m = a - 1, 12
    return sorted(out)


def texto_html(corpo):
    """Texto de uma carta publicada como página: o miolo (<article> ou <main>, quando há), sem script, estilo, menu e rodapé."""
    t = corpo.decode('utf-8', 'replace') if isinstance(corpo, (bytes, bytearray)) else (corpo or '')
    t = re.sub(r'(?is)<(script|style|noscript|svg|nav|header|footer|form)\b.*?</\1\s*>', ' ', t)
    for tag in ('article', 'main'):
        m = re.search(r'(?is)<%s\b[^>]*>(.*)</%s\s*>' % (tag, tag), t)
        if m and len(re.sub(r'<[^>]+>', '', m.group(1)).strip()) > 400:
            t = m.group(1)
            break
    t = _html.unescape(re.sub(r'<[^>]+>', ' ', t))
    return re.sub(r'\s+', ' ', t).strip()


def pdf_da_pagina(corpo, base, titulo=''):
    """PDF da carta citado na página (Dynamo e JGP publicam uma página curta com "Leia aqui"/"Baixar" e o PDF).
    Só PDF do mesmo site; menu e rodapé ficam de fora; entre vários, o que tem "carta"/"relatório" ou palavras do título."""
    t = corpo.decode('utf-8', 'replace') if isinstance(corpo, (bytes, bytearray)) else (corpo or '')
    t = re.sub(r'(?is)<(script|style|nav|header|footer)\b.*?</\1\s*>', ' ', t)
    host = urlparse(base).netloc.lower().replace('www.', '')
    palavras = {w for w in re.findall(r'[a-z0-9]{4,}', sem_acento(titulo or '').lower())}
    melhor, nota_m = None, -1
    for i, h in enumerate(re.findall(r'(?i)href=["\']([^"\']+\.pdf(?:\?[^"\']*)?)["\']', t)):
        u = urljoin(base, _html.unescape(h))
        pu = urlparse(u)
        if pu.scheme not in ('http', 'https') or pu.netloc.lower().replace('www.', '') != host:
            continue
        nome = sem_acento(pu.path.rsplit('/', 1)[-1]).lower()
        nota = (3 if re.search(r'carta|relat|letter|gestao|report', nome) else 0) + sum(1 for w in palavras if w in nome)
        if re.search(r'politica|regulamento|lamina|formulario|codigo|termo|manual', nome):
            nota -= 5
        if nota > nota_m:
            melhor, nota_m = u, nota
    return melhor if nota_m > -5 else None


def link_pdf(x):
    for k in ('pdf', 'link'):
        u = x.get(k) or ''
        if u.lower().split('?')[0].endswith('.pdf'):
            return u
    return None


def citacoes(texto, oregon):
    """{ticker: ocorrências}. Códigos escritos + nomes das empresas das carteiras (termos e exclusões das notícias)."""
    out = {}
    for t in TICKER.findall(texto or ''):
        if t not in NAO_TICKER:
            out[t] = out.get(t, 0) + 1
    norm = ' ' + sem_acento(texto or '').lower() + ' '
    for t, a in ((oregon or {}).get('ativos') or {}).items():
        if (a.get('classe') or '') not in ('Ações', 'acao') and not a.get('so_vip'):
            continue
        txt = norm
        for ex in a.get('excluir') or []:
            txt = txt.replace(sem_acento(ex).lower(), ' ')
        termos = [k for k in (a.get('termos') or []) if not k.startswith('=') and not re.match(r'^[A-Z]{4}\d{1,2}$', k)]
        achou = analise._casa(txt, termos)
        if achou:
            n = sum(txt.count(sem_acento(k).lower()) for k in achou)
            raiz = re.match(r'^([A-Z]{4})\d', t)
            # o código já contado (PETR4) e o nome da mesma empresa (Petrobras) somam no código da carteira
            outros = [k for k in list(out) if raiz and k.startswith(raiz.group(1)) and k != t]
            for k in outros:
                n += out.pop(k)
            out[t] = out.get(t, 0) + max(1, n)
    return out


TRECHO_MAX = 280
_FIM_FRASE = re.compile(r'(?<=[.!?;])\s+|\n\s*\n+')


def _termos_carteira(oregon):
    """Termos (sem acento, minúsculos) de todos os ativos que `citacoes` olha: filtro rápido antes de testar cada frase."""
    out = set()
    for a in ((oregon or {}).get('ativos') or {}).values():
        if (a.get('classe') or '') not in ('Ações', 'acao') and not a.get('so_vip'):
            continue
        for k in a.get('termos') or []:
            if not k.startswith('=') and not re.match(r'^[A-Z]{4}\d{1,2}$', k):
                out.add(sem_acento(k).lower())
    return out


def _corta(frase, alvo):
    """Até TRECHO_MAX caracteres, em fronteira de palavra, com a citação dentro do recorte."""
    if len(frase) <= TRECHO_MAX:
        return frase
    norm = sem_acento(frase).lower()
    pos = min([p for p in (norm.find(a) for a in alvo) if p >= 0] or [0])
    ini = 0
    if pos > TRECHO_MAX - 80:
        ini = frase.rfind(' ', 0, max(0, pos - 100)) + 1
    corte = frase[ini:ini + TRECHO_MAX - 2]
    if ini + TRECHO_MAX - 2 < len(frase):
        corte = corte.rsplit(' ', 1)[0] + '…'
    return ('…' if ini > 0 else '') + corte


def trechos(texto, oregon, mencoes, max_por=2):
    """{ticker: [frase literal, ...]}: as primeiras `max_por` frases da carta em que cada empresa de `mencoes` aparece,
    pelas mesmas regras de `citacoes` (código ou nome; exclusões como "Vale do Silício"). Código de outra classe da mesma
    empresa (PETR3) vai para o código que a contagem usou (PETR4)."""
    if not texto or not mencoes:
        return {}
    termos = _termos_carteira(oregon)
    raiz = {}
    for k in mencoes:
        m = re.match(r'^([A-Z]{4})\d', k)
        if m:
            raiz.setdefault(m.group(1), k)
    nomes = {}
    for t, a in ((oregon or {}).get('ativos') or {}).items():
        nomes[t] = [sem_acento(k).lower() for k in (a.get('termos') or []) if not k.startswith('=')]
    out = {}
    for bruta in _FIM_FRASE.split(texto):
        frase = re.sub(r'\s+', ' ', bruta).strip()
        if len(frase) < 12:
            continue
        norm = sem_acento(frase).lower()
        if not TICKER.search(frase) and not any(k in norm for k in termos):
            continue
        for k in citacoes(frase, oregon):
            alvo = k if k in mencoes else raiz.get(k[:4])
            if not alvo:
                continue
            lst = out.setdefault(alvo, [])
            if len(lst) >= max_por:
                continue
            c = _corta(frase, [k.lower()] + nomes.get(alvo, []) + nomes.get(k, []))
            if c not in lst:
                lst.append(c)
    return {k: v for k, v in out.items() if v}


def atualizar(cfg, oregon, rede, robots, hoje, agora_, estado, log_=print):
    cc = (cfg.get('intel') or {}).get('cartas_termometro') or {}
    if cc.get('ativo') is False:
        return None
    st = estado.setdefault('cartas_lidas', {})
    meses_alvo = meses_janela(hoje, cc.get('meses', 4))
    candidatas = {}
    for m in biblioteca.meses_disponiveis():
        if m < meses_alvo[0]:
            continue
        for x in biblioteca.ler_mes(m).get('itens') or []:
            if x.get('categoria') != 'gestora_brasil' or x.get('agrupado_em') or biblioteca.bloqueado(x):
                continue
            mr = mes_da_carta(x)
            if not mr or mr not in meses_alvo or (x.get('acervo') and not x.get('referencia')):
                continue
            candidatas[x['id']] = (x, mr)
    lidas, max_pdf = 0, int(cc.get('max_por_rodada', 6))
    for xid in list(st):
        # lidas antes da v3.7 sem empresa citada: não há trecho a buscar
        if 'mencoes' in st[xid] and not st[xid].get('mencoes') and st[xid].get('v') != 2:
            st[xid]['v'] = 2
    ordem = sorted(candidatas.items(), key=lambda kv: kv[1][1], reverse=True)
    novas = [kv for kv in ordem if kv[0] not in st]
    # v3.7: cartas lidas antes, com empresas citadas mas sem os trechos, são reabertas uma vez (depois das novas)
    reler = [kv for kv in ordem if kv[0] in st and st[kv[0]].get('mencoes') and st[kv[0]].get('v') != 2]
    for xid, (x, mr) in novas + reler:
        if lidas >= max_pdf:
            break
        antes = st.get(xid) or {}

        def falha(motivo, **extra):
            # releitura que falha não apaga a contagem já feita: marca e não tenta de novo
            if antes.get('mencoes'):
                st[xid] = dict(antes, v=2, erro_releitura=motivo)
            else:
                st[xid] = dict({'mes': mr, 'erro': motivo, 'em': agora_.isoformat(timespec='minutes')}, **extra)
        u = link_pdf(x)
        pagina = None
        if not u:
            pagina = x.get('link') or ''
            if not pagina.startswith(('http://', 'https://')) or re.search(r'youtu\.?be|vimeo\.com|spotify\.com', pagina):
                if antes.get('mencoes'):
                    st[xid] = dict(antes, v=2)
                else:
                    st[xid] = {'mes': mr, 'sem_pdf': True, 'em': agora_.isoformat(timespec='minutes')}
                continue
        if robots is not None and not robots.permite(u or pagina):
            falha('robots')
            continue
        lidas += 1
        try:
            limite = int(cc.get('max_mb', 12)) * 1024 * 1024
            if pagina:
                corpo = rede.get('Termômetro das cartas', pagina, timeout=int(cc.get('timeout', 40)), tentativas=1)
                txt = texto_html(corpo)
                origem = 'página'
                pdf2 = pdf_da_pagina(corpo, pagina, x.get('titulo')) if len(txt) < 1500 else None
                if pdf2 and (robots is None or robots.permite(pdf2)):
                    corpo2 = rede.get('Termômetro das cartas', pdf2, timeout=int(cc.get('timeout', 40)), tentativas=1)
                    if len(corpo2) <= limite:
                        t2 = pdftexto.texto(corpo2)
                        if len(t2) > len(txt):
                            txt, origem = t2, 'PDF da página'
            else:
                corpo = rede.get('Termômetro das cartas', u, timeout=int(cc.get('timeout', 40)), tentativas=1)
                if len(corpo) > limite:
                    falha('grande')
                    continue
                txt = pdftexto.texto(corpo)
                origem = 'PDF'
            men = citacoes(txt, oregon)
            if antes.get('mencoes') and not men:
                falha('sem texto na releitura')
                continue
            st[xid] = {'mes': mr, 'mencoes': men, 'trechos': trechos(txt, oregon, men), 'v': 2, 'caracteres': len(txt), 'origem': origem,
                       'em': antes.get('em') if antes.get('mencoes') else agora_.isoformat(timespec='minutes')}
            if len(txt) < 200:
                st[xid]['sem_texto'] = True  # PDF de imagem ou protegido: sem texto para contar
        except Exception as e:
            falha(type(e).__name__)
    # limpa o estado de cartas fora da janela
    for k in [k for k, v in st.items() if v.get('mes', '9999') < meses_alvo[0]]:
        st.pop(k, None)
    at = (oregon or {}).get('ativos') or {}
    meses = []
    for mr in sorted(meses_alvo, reverse=True):
        cartas, emp = [], {}
        for xid, (x, m0) in candidatas.items():
            if m0 != mr:
                continue
            s = st.get(xid) or {}
            gest = x.get('organizacao') or x.get('fonte') or ''
            cartas.append({'id': xid, 'titulo': x.get('titulo'), 'gestora': gest, 'link': link_pdf(x) or x.get('link'), 'data': (x.get('publicado_em') or '')[:10] or None,
                           'lida': 'mencoes' in s and not s.get('sem_texto'), 'origem': s.get('origem'),
                           'motivo': 'vídeo ou sem texto' if s.get('sem_pdf') else 'sem texto legível' if s.get('sem_texto') else s.get('erro') or (None if s else 'na fila'),
                           'n_empresas': len(s.get('mencoes') or {})})
            for t, n in (s.get('mencoes') or {}).items():
                e = emp.setdefault(t, {'t': t, 'nome': (at.get(t) or {}).get('nome') or t, 'carteira': 'vip' if (at.get(t) or {}).get('so_vip') else 'oregon' if t in at else None,
                                       'vip_tambem': bool((at.get(t) or {}).get('carteiras_vip')), 'n_cartas': 0, 'mencoes': 0, 'gestoras': [], 'cartas': [], 'trechos': []})
                e['n_cartas'] += 1
                e['mencoes'] += n
                if gest and gest not in e['gestoras']:
                    e['gestoras'].append(gest)
                e['cartas'].append(xid)
                for frase in (s.get('trechos') or {}).get(t) or []:
                    if len(e['trechos']) < 6:
                        e['trechos'].append({'carta': xid, 'gestora': gest, 'link': link_pdf(x) or x.get('link'), 'data': (x.get('publicado_em') or '')[:10] or None, 'texto': frase})
        lista = sorted(emp.values(), key=lambda e: (-e['n_cartas'], -e['mencoes'], e['t']))
        meses.append({'mes': mr, 'cartas': sorted(cartas, key=lambda c: (c['gestora'] or '').lower()), 'n_lidas': sum(1 for c in cartas if c['lida']), 'empresas': lista})
    log_('  termômetro das cartas: %d cartas abertas nesta rodada; %s' % (lidas, ', '.join('%s %d cartas (%d lidas)' % (m['mes'], len(m['cartas']), m['n_lidas']) for m in meses)))
    return {'gerado_em': agora_.isoformat(timespec='minutes'), 'meses': meses,
            'nota': 'Contagem de citações (código de negociação ou nome das empresas das carteiras) nas cartas públicas das gestoras brasileiras, com até 2 frases literais por empresa e por carta, e o link. O texto completo das cartas não é guardado; não há sentido nem opinião atribuídos.'}
