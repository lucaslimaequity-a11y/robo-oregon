"""Monta o HTML único do Oregon Investment Desk a partir de painel/src.
Uso (na pasta do repositório):  python painel/build.py
Saídas:
  site/index.html                    (o site publicado pelo GitHub Pages)
  painel/dist/painel_artifact.html   (corpo para a versão privada no claude.ai)
"""
import os, sys, json, re
B = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(B, '..')

def rd(p): return open(os.path.join(B, 'src', p), encoding='utf-8').read()

data = json.load(open(os.path.join(B, 'src', 'data.json'), encoding='utf-8'))
# fichas dos ETFs (documentos oficiais das gestoras): separadas para atualizar sem mexer no restante dos dados
_etfs = json.load(open(os.path.join(B, 'src', 'etfs.json'), encoding='utf-8'))
data['etfs'] = {k: v for k, v in _etfs.items() if not k.startswith('_')}
data_js = 'var DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';'
sala = rd('sala.js').replace('/*__LEGACY_TOPICOS__*/', rd('legacy_topicos.js'))
assert '__LEGACY' not in sala
js_order = ['quant.js', 'core.js', 'store.js', 'tests.js', 'ui_base.js', 'ui_mesa.js', 'ui_cons.js', 'ui_risco.js', 'ui_dados.js', None, 'ui_teses.js', 'ui_research.js', 'mercado.js', 'ui_hoje.js', 'ui_mapa.js', 'ui_global.js', 'main.js']
parts = [data_js]
for f in js_order:
    parts.append(sala if f is None else rd(f))
js = '\n;\n'.join(parts)
for bad in ['</script', '<!--']:
    assert bad not in js, bad
cg_js = rd('comite.js')  # guia do Comitê 05/11 (classes cg-), preservado sem alterações

css = rd('app.css') + '\n/* ---- Guia do Comitê 05/11 ---- */\n' + rd('comite.css')
fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;500;600&display=swap" rel="stylesheet">'
body = '''<div class="ov">
<header class="top">
  <div class="top-in">
    <button class="brand" type="button" onclick="APP.go('hoje')" aria-label="Oregon, ir para Hoje"><b>Oregon</b><small>Investment Desk</small></button>
    <nav id="nav" class="nav" role="tablist" aria-label="Áreas"></nav>
    <div id="top-r" class="top-r"></div>
  </div>
  <div id="ctx" class="ctx" hidden><div id="top-ctl" class="ctx-in"></div></div>
  <div id="sim" class="simulado" hidden>DADOS SIMULADOS DE TESTE · nenhum número desta tela é real</div>
</header>
<main>
  <div id="main" aria-live="polite"></div>
  <div id="cg-host" hidden>
''' + rd('comite.html') + '''
  </div>
</main>
</div>
'''
page = ('<title>Oregon Investment Desk</title>\n<meta name="robots" content="noindex,nofollow">\n<meta name="description" content="Mesa de análise, risco e estratégia da Oregon: Hoje, Research Brasil, Carteiras e Mundo e Estratégia.">\n'
        + fonts + '\n<style>\n' + css + '\n</style>\n' + body + '<script>\n' + js + '\n</script>\n<script>\n' + cg_js + '\n</script>\n')
os.makedirs(os.path.join(B, 'dist'), exist_ok=True)
open(os.path.join(B, 'dist', 'painel_artifact.html'), 'w', encoding='utf-8').write(page)
os.makedirs(os.path.join(RAIZ, 'site'), exist_ok=True)
full = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + page.split('<div class="ov">')[0] + '</head>\n<body>\n<div class="ov">' + page.split('<div class="ov">', 1)[1] + '</body>\n</html>\n')
open(os.path.join(RAIZ, 'site', 'index.html'), 'w', encoding='utf-8').write(full)
open(os.path.join(B, 'dist', 'Oregon_Investment_Desk.html'), 'w', encoding='utf-8').write(full)
print('ok', len(page), 'bytes')
