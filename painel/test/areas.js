// Percorre as cinco seções do Oregon Intelligence (Hoje, Brasil, Mundo e Estratégia, Carteiras, Biblioteca) no computador e no celular, com dados de TESTE
// gerados pelo robô contra a internet simulada (painel/test/gera_dados_teste.py), e procura erros de JavaScript, telas que não
// montam e rolagem horizontal. Uso: python painel/test/gera_dados_teste.py <pasta> && (cd <pasta> && python -m http.server 8777) && node painel/test/areas.js http://localhost:8777/index.html
const { chromium } = require('playwright');
const url = process.argv[2];
const ROTAS = ['hoje', 'brasil/ativos', 'mundo/agora', 'mundo/cartas', 'mundo/etfs', 'cart/ref', 'cart/mapa', 'cart/carteira', 'cart/perfis', 'bib/busca', 'bib/semanal', 'bib/aprendizados', 'bib/fontes',
  // endereços antigos continuam funcionando
  'oregon/ativos', 'oregon/carteiras', 'oregon/setores', 'res/empresas', 'res/etfs', 'res/eventos', 'cart/risco', 'cart/construcao', 'global', 'sala/reuniao', 'mesa/mercado', 'cons/editor'];
const DESTINO = {'oregon/ativos': 'brasil/ativos', 'oregon/carteiras': 'cart/', 'oregon/setores': 'brasil/ativos', 'res/empresas': 'brasil/ativos', 'res/etfs': 'brasil/ativos', 'res/eventos': 'hoje/',
  'cart/risco': 'cart/', 'cart/construcao': 'cart/', 'global': 'mundo/agora', 'sala/reuniao': 'cart/', 'mesa/mercado': 'hoje/', 'cons/editor': 'cart/'};
(async () => {
  const b = await chromium.launch(); let falhas = 0;
  function rep(ok, msg) { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) falhas++; }
  for (const vw of [1440, 390]) {
    const p = await b.newPage({viewport: {width: vw, height: 900}}); const errs = [];
    await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|net::|Failed to load/.test(m.text())) errs.push(m.text()); });
    await p.goto(url); await p.waitForTimeout(2500);
    // Hoje: últimas notícias com hora e veículo; situação da coleta no topo; 5 a 8 leituras do dia, cada uma com link para a fonte original
    const hj = await p.evaluate(() => { const cards = Array.from(document.querySelectorAll('#prioridades .nw')), ult = Array.from(document.querySelectorAll('#ultimas .nw'));
      return {n: cards.length, links: cards.every(c => c.querySelector('a.nw-ext[href^="http"]')), ult: ult.length, horas: ult.every(c => c.querySelector('.nw-when') && c.querySelector('.nw-src')), status: (document.querySelector('.status-l') || {}).textContent || '',
        macro: !!document.querySelector('#macro'), agenda: !!document.querySelector('#agenda li'), estudo: document.querySelectorAll('#estudo li').length, leitura: !!document.querySelector('#leitura .nw')}; });
    rep(hj.ult >= 3 && hj.horas, vw + ' Hoje abre com as últimas notícias, cada uma com hora e veículo (' + hj.ult + ')');
    rep(/Última coleta concluída/.test(hj.status) && /notícias nas últimas 24 h/.test(hj.status), vw + ' topo mostra a última coleta e as notícias de 24 h');
    rep(hj.n >= 5 && hj.n <= 8, vw + ' Hoje mostra 5 a 8 leituras do dia (' + hj.n + ')');
    rep(hj.links, vw + ' toda leitura abre a fonte original');
    rep(!hj.macro && hj.agenda, vw + ' sem caixas de macro; agenda presente');
    rep(hj.estudo >= 1 && hj.leitura, vw + ' estudo do dia e leitura recomendada');
    // análise em sete pontos com rótulos, aberta pelo título
    const an = await p.evaluate(() => { const bt = document.querySelector('#prioridades .nw .nwl'); bt.click(); const d = document.querySelector('.drawer'); if (!d) return 'gaveta não abriu'; const pts = d.querySelectorAll('.an-p').length, rot = d.querySelectorAll('.rot').length, orig = !!d.querySelector('a.btn.pri[href^="http"]'); return pts === 7 && rot >= 7 && orig ? 'ok' : 'pontos ' + pts + ' rótulos ' + rot + ' original ' + orig; });
    rep(an === 'ok', vw + ' análise em sete pontos com rótulos e link original (' + an + ')');
    // registrar um aprendizado pela gaveta
    const ap = await p.evaluate(async () => { const d = document.querySelector('.drawer'); const ta = d.querySelector('textarea'); ta.value = 'Teste de aprendizado: a carta assume juro real alto por muito tempo.'; const bt = Array.from(d.querySelectorAll('button')).find(x => /Salvar no registro/.test(x.textContent)); bt.click(); await new Promise(r => setTimeout(r, 400)); return APP.aprendizados().length; });
    rep(ap === 1, vw + ' aprendizado salvo neste navegador (' + ap + ')');
    for (const r of ROTAS) {
      const [a, s] = r.split('/');
      await p.evaluate(([a, s]) => APP.go(a, s || undefined), [a, s]); await p.waitForTimeout(300);
      const res = await p.evaluate(() => ({area: APP.S.area, sub: APP.S.sub[APP.S.area], erro: Array.from(document.querySelectorAll('.alert.bad')).some(e => /Erro ao montar/.test(e.textContent)), vazio: (document.getElementById('main').innerText || '').trim().length < 40, ov: document.documentElement.scrollWidth > window.innerWidth + 1}));
      const esperado = DESTINO[r] || (s ? r : r + '/');
      const destinoOk = esperado.endsWith('/') ? res.area === esperado.slice(0, -1) : (res.area + '/' + res.sub) === esperado;
      rep(destinoOk && !res.erro && !res.vazio && !(vw < 500 && res.ov), vw + ' ' + r + ' → ' + res.area + '/' + (res.sub || '') + (res.erro ? ' erro' : '') + (res.ov ? ' rolagem-horizontal' : ''));
    }
    // Biblioteca: busca por texto e filtro por assunto reduzem a lista; nenhum item some sem filtro
    await p.evaluate(() => { APP.go('bib', 'busca'); APP.bibFiltro({}); }); await p.waitForTimeout(400);
    const bib = await p.evaluate(async () => { const total = document.querySelectorAll('#main .nw').length; const inp = document.querySelector('.busca-box input[type=search]'); inp.value = 'copom'; inp.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 500)); const q = document.querySelectorAll('#main .nw').length; APP.bibFiltro({tema: 'juros'}); await new Promise(r => setTimeout(r, 200)); const t = document.querySelectorAll('#main .nw').length; APP.bibFiltro({}); await new Promise(r => setTimeout(r, 200)); const back = document.querySelectorAll('#main .nw').length; return {total, q, t, back}; });
    rep(bib.total >= 10 && bib.q >= 1 && bib.q < bib.total && bib.t >= 1 && bib.t < bib.total && bib.back === bib.total, vw + ' busca e filtro da Biblioteca (' + JSON.stringify(bib) + ')');
    // Biblioteca: item de prioridade baixa continua visível (nada escondido)
    const baixa = await p.evaluate(() => { APP.bibFiltro({nivel: 'baixa'}); return document.querySelectorAll('#main .nw').length; });
    rep(baixa >= 1, vw + ' itens de prioridade baixa visíveis na Biblioteca (' + baixa + ')');
    // Biblioteca: mês anterior carrega sob demanda (item de 40 dias atrás)
    const mes = await p.evaluate(async () => { APP.bibFiltro({}); const sel = Array.from(document.querySelectorAll('.filtros select')).find(s => /últimos/.test(s.options[0].textContent)); sel.value = '12'; sel.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 1200)); return /Carta 40/.test(document.getElementById('main').innerText) ? 'ok' : 'mês anterior não carregou'; });
    rep(mes === 'ok', vw + ' mês anterior da biblioteca carrega sob demanda (' + mes + ')');
    // Fontes e coleta: contadores por fonte
    await p.evaluate(() => APP.go('bib', 'fontes')); await p.waitForTimeout(600);
    const fc = await p.evaluate(() => { const t = document.getElementById('main').innerText; return /Gestora Teste/.test(t) && /recebidos/i.test(t) && /Site Que Veda Robôs/.test(t) ? 'ok' : 'tabela incompleta'; });
    rep(fc === 'ok', vw + ' fontes e coleta por fonte (' + fc + ')');
    // Resumo semanal
    await p.evaluate(() => APP.go('bib', 'semanal')); await p.waitForTimeout(300);
    const sm = await p.evaluate(() => { const t = document.getElementById('main').innerText; return /Principais teses/.test(t) && /Assuntos para estudar/.test(t) && /Mudanças de visão/.test(t) ? 'ok' : 'seções faltando'; });
    rep(sm === 'ok', vw + ' resumo semanal (' + sm + ')');
    // Brasil: ficha de empresa com o painel de notícias ao lado (hora, veículo, ↗), opiniões a favor/contra e links de busca
    await p.evaluate(() => APP.abrirEmpresa('PETR4')); await p.waitForTimeout(400);
    const fe = await p.evaluate(() => { const t = document.getElementById('main').innerText, np = document.querySelector('.ficha-news');
      return {area: APP.S.area, semPreco: !/Último preço|Preço do par/.test(t), painel: !!np && np.querySelectorAll('.nl .nw-when').length >= 1 && !!np.querySelector('.nl a.nw-ext[href^="http"]'),
        aFavor: /A favor · 1/.test(np ? np.innerText : ''), busca: !!(np && np.querySelector('.np-links a[href^="https://news.google.com/"]')), opiniaoCasa: /Opinião da casa/.test(t), tese: /A tese/.test(t), velho: /Conteúdo que cita a empresa/.test(t)}; });
    rep(fe.area === 'brasil' && fe.semPreco && fe.painel && fe.aFavor && fe.busca && fe.opiniaoCasa && fe.tese && !fe.velho, vw + ' ficha PETR4 com notícias ao lado, opinião a favor, busca e tese (' + JSON.stringify(fe) + ')');
    await p.evaluate(() => APP.abrirEmpresa('IMAB11')); await p.waitForTimeout(400);
    const fetf = await p.evaluate(() => { const t = document.getElementById('main').innerText; return APP.S.area === 'brasil' && !/Último preço|Preço do par/.test(t) && /Documentos oficiais/.test(t) && !!document.querySelector('.ficha-news') ? 'ok' : 'ficha incompleta'; });
    rep(fetf === 'ok', vw + ' ficha do ETF IMAB11 com painel de notícias (' + fetf + ')');
    // Mundo e Estratégia: últimas do mundo (imprensa internacional) e ETF global abre aqui
    await p.evaluate(() => APP.go('mundo', 'agora')); await p.waitForTimeout(300);
    const mu = await p.evaluate(() => document.querySelectorAll('#mundo-ultimas .nw').length);
    rep(mu >= 1, vw + ' Mundo e Estratégia mostra o que o mundo fala (' + mu + ')');
    await p.evaluate(() => APP.abrirEmpresa('IB01')); await p.waitForTimeout(400);
    const gl = await p.evaluate(() => APP.S.area + '/' + APP.S.sub.mundo + '|' + !!document.querySelector('.ficha-news'));
    rep(gl === 'mundo/etfs|true', vw + ' ETF global abre em Mundo › ETFs globais com notícias do tema (' + gl + ')');
    // ficha rápida pela busca
    await p.evaluate(() => APP.go('hoje')); await p.waitForTimeout(150);
    await p.keyboard.press('/'); await p.waitForTimeout(150); await p.keyboard.type('PRIO3'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const fr = await p.evaluate(() => { const d = document.querySelector('.drawer'); return !!d && /PRIO/.test(d.innerText) && /Últimas notícias/.test(d.innerText); });
    rep(fr, vw + ' busca rápida abre a ficha de PRIO3');
    await p.keyboard.press('Escape');
    // carteiras: seletor troca Conservador ↔ Arrojado e mostra a validade; nada de cenários
    await p.evaluate(() => APP.go('cart', 'ref')); await p.waitForTimeout(300);
    const ref = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.seg button')).find(x => /Arrojado/.test(x.textContent)); b.click(); const t = document.getElementById('main').innerText; return APP.S.cart + '|' + (/inválida/.test(t) ? 'mostra inválida' : 'NÃO mostra inválida') + '|' + (/Cenários|Risco estatístico/.test(t) ? 'tem simulador' : 'sem simulador'); });
    rep(ref === 'cresc-arr|mostra inválida|sem simulador', vw + ' carteiras de referência (' + ref + ')');
    const menu = await p.evaluate(() => { const bs = Array.from(document.querySelectorAll('#nav button')); return bs.length + '|' + (bs.find(b => b.getAttribute('aria-selected') === 'true') || {}).dataset.a; });
    rep(menu === '5|cart', vw + ' menu com cinco seções (' + menu + ')');
    if (errs.length) rep(false, 'erros de JavaScript: ' + errs.join(' | '));
    await p.close();
  }
  console.log(falhas ? falhas + ' falha(s)' : 'tudo ok'); await b.close(); process.exit(falhas ? 1 : 0);
})();
