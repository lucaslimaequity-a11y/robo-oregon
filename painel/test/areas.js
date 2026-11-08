// Percorre as cinco áreas e as seções do Oregon Desk com dados SIMULADOS do robô (servidos localmente) e procura
// erros de JavaScript, áreas que não montam e rolagem horizontal no celular. Uso: node test/areas.js http://localhost:8765/index.html
const { chromium } = require('playwright');
const url = process.argv[2];
const ROTAS = ['hoje', 'cart/mapa', 'cart/carteira', 'cart/risco', 'cart/construcao', 'cart/perfis', 'cart/perf', 'res/empresas', 'res/macro', 'res/eventos', 'global', 'sala/reuniao', 'sala/comite', 'sala/decisoes', 'sala/pauta', 'sala/textos', 'sala/hist',
  'mesa/painel', 'mesa/mercado', 'cons/editor', 'cons/sizing', 'risco/cenarios', 'risco/prem', 'res/teses', 'res/noticias', 'res/sala', 'res/comite'];
(async () => {
  const b = await chromium.launch(); let falhas = 0;
  for (const vw of [1440, 390]) {
    const p = await b.newPage({viewport: {width: vw, height: 900}}); const errs = [];
    await p.route(/fonts\.(googleapis|gstatic)|api\.bcb\.gov\.br|awesomeapi/, r => r.abort());
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|net::|Failed to load/.test(m.text())) errs.push(m.text()); });
    await p.goto(url); await p.waitForTimeout(3000);
    for (const r of ROTAS) {
      const [a, s] = r.split('/');
      await p.evaluate(([a, s]) => APP.go(a, s || undefined), [a, s]); await p.waitForTimeout(250);
      const res = await p.evaluate(() => ({area: APP.S.area, sub: APP.S.sub[APP.S.area], erro: Array.from(document.querySelectorAll('.alert.bad')).some(e => /Erro ao montar/.test(e.textContent)), vazio: (document.getElementById('main').innerText || '').trim().length < 40, ov: document.documentElement.scrollWidth > window.innerWidth + 1}));
      const ok = !res.erro && !(res.vazio && r !== 'sala/comite') && !(vw < 500 && res.ov);
      if (!ok) falhas++;
      console.log((ok ? 'PASS ' : 'FAIL ') + vw + ' ' + r + ' → ' + res.area + '/' + (res.sub || '') + (res.erro ? ' erro' : '') + (res.ov ? ' rolagem-horizontal' : ''));
    }
    // busca rápida abre e navega
    await p.keyboard.press('/'); await p.waitForTimeout(150); await p.keyboard.type('PRIO3'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const tese = await p.evaluate(() => !!document.querySelector('.drawer') && /PRIO/.test(document.querySelector('.drawer').innerText));
    console.log((tese ? 'PASS ' : 'FAIL ') + vw + ' busca rápida abre a tese da PRIO3'); if (!tese) falhas++;
    await p.keyboard.press('Escape');
    if (errs.length) { falhas++; console.log('FAIL erros de JavaScript: ' + errs.join(' | ')); }
    await p.close();
  }
  console.log(falhas ? falhas + ' falha(s)' : 'tudo ok'); await b.close(); process.exit(falhas ? 1 : 0);
})();
