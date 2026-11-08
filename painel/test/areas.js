// Percorre as quatro áreas (e a Sala, dentro de Carteiras) e as seções do Oregon Desk com dados SIMULADOS do robô (servidos localmente) e procura
// erros de JavaScript, áreas que não montam e rolagem horizontal no celular. Uso: node test/areas.js http://localhost:8765/index.html
const { chromium } = require('playwright');
const url = process.argv[2];
const ROTAS = ['hoje', 'res/empresas', 'res/etfs', 'res/macro', 'res/eventos', 'cart/ref', 'cart/risco', 'cart/sala', 'cart/mapa', 'cart/carteira', 'cart/construcao', 'cart/perfis', 'cart/perf', 'global',
  'sala/reuniao', 'sala/comite', 'sala/decisoes', 'sala/pauta', 'sala/textos', 'sala/hist',
  'mesa/painel', 'mesa/mercado', 'cons/editor', 'cons/sizing', 'risco/cenarios', 'risco/prem', 'res/teses', 'res/noticias', 'res/sala', 'res/comite', 'cart/todas'];
// Destino esperado de cada endereço (os antigos são traduzidos para a navegação nova)
const DESTINO = {'cart/sala': 'sala/reuniao', 'mesa/painel': 'cart/carteira', 'mesa/mercado': 'hoje/', 'cons/editor': 'cart/construcao', 'cons/sizing': 'cart/construcao', 'risco/cenarios': 'cart/risco', 'risco/prem': 'cart/risco',
  'res/teses': 'res/empresas', 'res/noticias': 'res/eventos', 'res/sala': 'sala/reuniao', 'res/comite': 'sala/comite', 'cart/todas': 'cart/mapa'};
(async () => {
  const b = await chromium.launch(); let falhas = 0;
  for (const vw of [1440, 390]) {
    const p = await b.newPage({viewport: {width: vw, height: 900}}); const errs = [];
    await p.route(/fonts\.(googleapis|gstatic)|api\.bcb\.gov\.br|awesomeapi/, r => r.abort());
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|net::|Failed to load/.test(m.text())) errs.push(m.text()); });
    await p.goto(url); await p.waitForTimeout(3000);
    // ficha rápida aberta antes de o arquivo de resultados chegar: o resultado da CVM aparece sem reabrir
    await p.evaluate(() => APP.abrirFicha('PETR4')); await p.waitForTimeout(1500);
    const rq = await p.evaluate(() => { const d = document.querySelector('.drawer'); return d ? (/Último resultado na CVM/.test(d.innerText) ? 'ok' : /Sem resultado da CVM|indisponíveis/.test(d.innerText) ? 'sem arquivo (aceito)' : 'não atualizou') : 'gaveta não abriu'; });
    const rqOk = rq === 'ok' || rq === 'sem arquivo (aceito)';
    console.log((rqOk ? 'PASS ' : 'FAIL ') + vw + ' ficha rápida completa o resultado da CVM (' + rq + ')'); if (!rqOk) falhas++;
    await p.keyboard.press('Escape');
    for (const r of ROTAS) {
      const [a, s] = r.split('/');
      await p.evaluate(([a, s]) => APP.go(a, s || undefined), [a, s]); await p.waitForTimeout(250);
      const res = await p.evaluate(() => ({area: APP.S.area, sub: APP.S.sub[APP.S.area], erro: Array.from(document.querySelectorAll('.alert.bad')).some(e => /Erro ao montar/.test(e.textContent)), vazio: (document.getElementById('main').innerText || '').trim().length < 40, ov: document.documentElement.scrollWidth > window.innerWidth + 1}));
      const esperado = DESTINO[r] || (s ? r : r + '/');
      const destinoOk = esperado.endsWith('/') ? res.area === esperado.slice(0, -1) : (res.area + '/' + res.sub) === esperado;
      const ok = destinoOk && !res.erro && !(res.vazio && r !== 'sala/comite') && !(vw < 500 && res.ov);
      if (!ok) falhas++;
      console.log((ok ? 'PASS ' : 'FAIL ') + vw + ' ' + r + ' → ' + res.area + '/' + (res.sub || '') + (res.erro ? ' erro' : '') + (res.ov ? ' rolagem-horizontal' : ''));
    }
    // busca rápida abre as últimas atualizações do ativo (empresa e ETF)
    for (const [q, re] of [['PRIO3', /PRIO/], ['IMAB11', /IMA-B/]]) {
      await p.evaluate(() => APP.go('hoje')); await p.waitForTimeout(150);
      await p.keyboard.press('/'); await p.waitForTimeout(150); await p.keyboard.type(q); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
      const ok = await p.evaluate((src) => { const d = document.querySelector('.drawer'); return !!d && new RegExp(src).test(d.innerText) && /Últimas atualizações/.test(d.innerText); }, re.source);
      console.log((ok ? 'PASS ' : 'FAIL ') + vw + ' busca rápida abre a ficha de ' + q); if (!ok) falhas++;
      await p.keyboard.press('Escape');
    }
    // notícia leva ao ativo; filtro de notícias redesenha só a lista
    await p.evaluate(() => APP.go('hoje')); await p.waitForTimeout(200);
    const nav = await p.evaluate(() => { const b = document.querySelector('#noticias .nwl.tkl'); if (!b) return 'sem notícia com ativo'; b.click(); const d = document.querySelector('.drawer'); return d && /Últimas atualizações/.test(d.innerText) ? 'ok' : 'gaveta não abriu'; });
    console.log((nav === 'ok' ? 'PASS ' : 'FAIL ') + vw + ' notícia → ficha do ativo (' + nav + ')'); if (nav !== 'ok') falhas++;
    await p.keyboard.press('Escape');
    const filt = await p.evaluate(() => { const bs = Array.from(document.querySelectorAll('#noticias .filt button')); const b = bs.find(x => /Empresas/.test(x.textContent) && !x.disabled); if (!b) return 'sem filtro'; b.click(); const cards = Array.from(document.querySelectorAll('#noticias .nw')); return cards.length && cards.every(c => c.classList.contains('c-empresas') || /ficha/.test(c.innerText)) ? 'ok' : 'filtro não aplicou'; });
    console.log((filt === 'ok' ? 'PASS ' : 'FAIL ') + vw + ' filtro Empresas (' + filt + ')'); if (filt !== 'ok') falhas++;
    // exercício: pergunta com fato real e explicação técnica
    const ex = await p.evaluate(() => { const s = document.querySelector('#exercicio'); if (!s) return 'sem exercício'; const d = s.querySelector('details'); if (!d) return /fato real/.test(s.innerText) ? 'sem fato (aceito)' : 'sem explicação'; d.open = true; return /Nas carteiras de referência/.test(d.innerText) && /Construção de carteira/.test(d.innerText) ? 'ok' : 'explicação incompleta'; });
    console.log((ex === 'ok' ? 'PASS ' : 'FAIL ') + vw + ' exercício do dia (' + ex + ')'); if (ex !== 'ok') falhas++;
    // carteiras: seletor simples troca Conservador ↔ Arrojado e mostra a validade
    await p.evaluate(() => APP.go('cart', 'ref')); await p.waitForTimeout(200);
    const ref = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.seg button')).find(x => /Arrojado/.test(x.textContent)); b.click(); return APP.S.cart + '|' + (/inválida/.test(document.getElementById('main').innerText) ? 'mostra inválida' : 'NÃO mostra inválida'); });
    console.log((ref === 'cresc-arr|mostra inválida' ? 'PASS ' : 'FAIL ') + vw + ' seletor de referência (' + ref + ')'); if (ref !== 'cresc-arr|mostra inválida') falhas++;
    // menu: só quatro áreas; a Sala acende Carteiras
    const menu = await p.evaluate(() => { APP.go('sala', 'reuniao'); const bs = Array.from(document.querySelectorAll('#nav button')); return bs.length + '|' + (bs.find(b => b.getAttribute('aria-selected') === 'true') || {}).dataset.a; });
    console.log((menu === '4|cart' ? 'PASS ' : 'FAIL ') + vw + ' menu com 4 áreas, Sala dentro de Carteiras (' + menu + ')'); if (menu !== '4|cart') falhas++;
    if (errs.length) { falhas++; console.log('FAIL erros de JavaScript: ' + errs.join(' | ')); }
    await p.close();
  }
  console.log(falhas ? falhas + ' falha(s)' : 'tudo ok'); await b.close(); process.exit(falhas ? 1 : 0);
})();
