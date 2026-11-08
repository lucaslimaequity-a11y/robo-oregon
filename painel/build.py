"""Monta o HTML único do Oregon Intelligence a partir de painel/src.
Uso (na pasta do repositório):  python painel/build.py
Saídas:
  site/index.html                    (o site publicado pelo GitHub Pages)
  painel/dist/painel_artifact.html   (corpo para a versão privada no claude.ai)
  painel/dist/Oregon_Intelligence.html (arquivo completo, abre sozinho)
"""
import os, sys, json
B = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(B, '..')
sys.path.insert(0, os.path.join(RAIZ, 'robo'))
import analise  # noqa: E402  (nomes de temas, regiões, fatores e tipos: a mesma taxonomia do robô, sem cópia manual)

def rd(p): return open(os.path.join(B, 'src', p), encoding='utf-8').read()

data = json.load(open(os.path.join(B, 'src', 'data.json'), encoding='utf-8'))
_etfs = json.load(open(os.path.join(B, 'src', 'etfs.json'), encoding='utf-8'))
data['etfs'] = {k: v for k, v in _etfs.items() if not k.startswith('_')}
def js_const(nome, obj): return 'var %s = %s;' % (nome, json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/'))
# buscas por ativo (links "buscar agora" na ficha) e empresas com CNPJ (documentos da CVM): da mesma configuração do robô
_cfg = json.load(open(os.path.join(RAIZ, 'robo', 'config.json'), encoding='utf-8'))
_buscas, _cvm = {}, {}
for _a in _cfg.get('ativos') or []:
    _n = _a.get('noticias') or {}
    if _n.get('busca'):
        _buscas[_a['id']] = _n['busca']
    if _a.get('cnpj'):
        _cvm[_a['id']] = True
for _te in (_cfg.get('noticias') or {}).get('etfs') or []:
    for _t in _te.get('etfs') or []:
        if _te.get('busca') and _t not in _buscas:
            _buscas[_t] = _te['busca']
taxon = {'temas': analise.TEMA_NOME, 'regioes': analise.REGIAO_NOME, 'fatores': analise.FATOR_NOME, 'tipos': analise.TIPO_NOME, 'roteiro': analise.ROTEIRO,
         'buscas': _buscas, 'cvm': _cvm, 'vinculo': analise.VINCULO}
js_order = ['quant.js', 'core.js', 'store.js', 'tests.js', 'ui_base.js', 'intel.js', 'ui_mesa.js', 'ui_teses.js', 'ui_mapa.js', 'ui_oregon.js', 'ui_bib.js', 'ui_hoje.js', 'ui_vip.js', 'main.js']
# v3.5 · carteiras VG VIP (aba separada): números do print enviado pelo Lucas; publicação autorizada por ele em 08/11/2026
_vip_p = os.path.join(B, 'src', 'vip.json')
vip = json.load(open(_vip_p, encoding='utf-8')) if os.path.exists(_vip_p) else {'carteiras': []}
parts = [js_const('DATA', data), js_const('TAXON', taxon), js_const('VIP_DATA', vip)]
for f in js_order:
    parts.append(rd(f))
js = '\n;\n'.join(parts)
for bad in ['</script', '<!--']:
    assert bad not in js, bad
css = rd('app.css')
fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;500;600&display=swap" rel="stylesheet">'
body = '''<div class="ov">
<header class="top">
  <div class="top-in">
    <button class="brand" type="button" onclick="APP.go('hoje')" aria-label="Oregon, ir para Hoje"><b>Oregon</b><small>Intelligence</small></button>
    <nav id="nav" class="nav" role="tablist" aria-label="Seções"></nav>
    <div id="top-r" class="top-r"></div>
  </div>
  <div id="ctx" class="ctx" hidden><div id="top-ctl" class="ctx-in"></div></div>
</header>
<main>
  <div id="main" aria-live="polite"></div>
</main>
</div>
'''
page = ('<title>Oregon Intelligence</title>\n<meta name="robots" content="noindex,nofollow">\n<meta name="description" content="Oregon Intelligence: central de research e formação continuada. Hoje (briefing), Biblioteca (pesquisa, resumos semanais, aprendizados, fontes) e Oregon (ativos, carteiras, setores).">\n'
        + fonts + '\n<style>\n' + css + '\n</style>\n' + body + '<script>\n' + js + '\n</script>\n')
os.makedirs(os.path.join(B, 'dist'), exist_ok=True)
open(os.path.join(B, 'dist', 'painel_artifact.html'), 'w', encoding='utf-8').write(page)
os.makedirs(os.path.join(RAIZ, 'site'), exist_ok=True)
full = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + page.split('<div class="ov">')[0] + '</head>\n<body>\n<div class="ov">' + page.split('<div class="ov">', 1)[1] + '</body>\n</html>\n')
open(os.path.join(RAIZ, 'site', 'index.html'), 'w', encoding='utf-8').write(full)
open(os.path.join(B, 'dist', 'Oregon_Intelligence.html'), 'w', encoding='utf-8').write(full)
for velho in ('Oregon_Investment_Desk.html',):
    try: os.remove(os.path.join(B, 'dist', velho))
    except OSError: pass
print('ok', len(page), 'bytes')
