// Percorre as cinco seções do Oregon Intelligence (Hoje, Brasil, Mundo e Estratégia, Carteiras, Biblioteca) no computador e no celular, com dados de TESTE
// gerados pelo robô contra a internet simulada (painel/test/gera_dados_teste.py), e procura erros de JavaScript, telas que não
// montam e rolagem horizontal. Uso: python painel/test/gera_dados_teste.py <pasta> && (cd <pasta> && python -m http.server 8777) && node painel/test/areas.js http://localhost:8777/index.html
const { chromium } = require('playwright');
const url = process.argv[2];
const ROTAS = ['brasil/fluxo', 'brasil/recomendacoes', 'cart/semana', 'hoje', 'brasil/ativos', 'brasil/pauta', 'bib/mes', 'bib/estante', 'vip/hoje', 'vip/ativos', 'vip/pauta', 'cart/comite', 'brasil/proventos', 'brasil/fundos', 'brasil/cartas', 'mundo/wealth', 'bib/trilha', 'mundo/agora', 'mundo/cartas', 'mundo/debate', 'mundo/etfs', 'cart/ref', 'cart/mapa', 'cart/carteira', 'cart/perfis', 'bib/busca', 'bib/semanal', 'bib/aprendizados', 'bib/fontes',
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
    // linha de notícia abre um resumo no próprio lugar (sem sair da lista), com a fonte original à mão
    const ln = await p.evaluate(() => { const r = document.querySelector('#ultimas .nr'), bt = r.querySelector('.nr-t'); bt.click(); const d = r.querySelector('.nr-d'); const ok1 = !!d && bt.getAttribute('aria-expanded') === 'true' && !!d.querySelector('a.btn[href^="http"]'); bt.click(); return ok1 && !r.querySelector('.nr-d') ? 'ok' : 'linha não abriu/fechou'; });
    rep(ln === 'ok', vw + ' linha de notícia abre e fecha no lugar (' + ln + ')');
    // janela de leitura: título, fonte e data em destaque, link original, sem os sete pontos nem "não avaliado"; aprofundar recolhido
    const y0 = await p.evaluate(() => { const r = document.getElementById('research'); if (r && r.classList.contains('fechada')) r.querySelector('header').click(); const c = document.querySelector('#prioridades .nw'); c.scrollIntoView(); window.scrollBy(0, -120); return window.scrollY; });
    const an = await p.evaluate(() => { const bt = document.querySelector('#prioridades .nw .nwl'); bt.focus(); bt.click(); const d = document.querySelector('.drawer'); if (!d) return 'gaveta não abriu';
      const t = d.innerText, tit = d.querySelector('.lr-t'), orig = !!d.querySelector('.lr-acts a.btn.pri[href^="http"]'), pts = d.querySelectorAll('.an-p').length, mais = d.querySelector('details.lr-mais');
      return tit && /Publicado|Sem data de publicação|Acervo/.test(t) && orig && pts === 0 && !/Não avaliado|não avaliado/.test(t) && mais && !mais.open && d.querySelectorAll('.lr-s').length <= 4 ? 'ok' : 'título ' + !!tit + ' original ' + orig + ' pontos ' + pts + ' seções ' + d.querySelectorAll('.lr-s').length; });
    rep(an === 'ok', vw + ' janela de leitura editorial, curta e com a fonte original (' + an + ')');
    // registrar um aprendizado pela gaveta
    const ap = await p.evaluate(async () => { const d = document.querySelector('.drawer'); const ta = d.querySelector('textarea'); ta.value = 'Teste de aprendizado: a carta assume juro real alto por muito tempo.'; const bt = Array.from(d.querySelectorAll('button')).find(x => /Salvar no registro/.test(x.textContent)); bt.click(); await new Promise(r => setTimeout(r, 400)); return APP.aprendizados().length; });
    rep(ap === 1, vw + ' aprendizado salvo neste navegador (' + ap + ')');
    // fechar a janela devolve o ponto de leitura
    await p.evaluate(() => { const bt = document.querySelector('#prioridades .nw .nwl'); bt.focus(); bt.click(); }); await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelector('.drawer .x').click()); await p.waitForTimeout(250);
    const volta = await p.evaluate(y0 => ({dy: Math.abs(window.scrollY - y0), foco: !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#prioridades'))}), y0);
    rep(volta.dy < 40 && volta.foco, vw + ' fechar a janela volta ao ponto de leitura (' + JSON.stringify(volta) + ')');
    // menção de passagem não conta como notícia do ativo
    const men = await p.evaluate(() => { const x = {id: 'm1', titulo: 'Allied paga R$ 0,63; Santander, Klabin, Lavvi e outros completam dividendos da semana', ativos: ['KLBN4'], ativos_porque: {KLBN4: 'Klabin'}}; return INTEL.vinculo(x, 'KLBN4').tipo; });
    rep(men === 'mencao', vw + ' lista de dividendos é menção de passagem (' + men + ')');
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
    const fe = await p.evaluate(() => { const t = document.getElementById('main').innerText, np = document.querySelector('.ficha-news'), aba = document.querySelector('.fv button[aria-selected="true"]');
      return {area: APP.S.area, semPreco: !/Último preço|Preço do par/.test(t), painel: !!np && np.querySelectorAll('.nl .nw-when').length >= 1 && !!np.querySelector('.nl a.nw-ext[href^="http"]'),
        aFavor: /A favor · 1/.test(np ? np.innerText : ''), doze: /12 meses/i.test(np ? np.innerText : ''), busca: !!(np && np.querySelector('.np-links a[href^="https://news.google.com/"]')), aba: aba && aba.dataset.v, opiniaoCasa: /Opinião da casa/.test(t), mudou: /Fatos que pedem revisão da tese/.test(t), velho: /Conteúdo que cita a empresa/.test(t)}; });
    rep(fe.area === 'brasil' && fe.semPreco && fe.painel && fe.aFavor && fe.doze && fe.busca && fe.aba === 'tese' && !fe.opiniaoCasa && fe.mudou && !fe.velho, vw + ' ficha PETR4: notícias ao lado, opiniões de 12 meses, sem "Opinião da casa", mudanças na tese primeiro (' + JSON.stringify(fe) + ')');
    await p.evaluate(() => APP.fichaVista('fundamentos')); await p.waitForTimeout(200);
    const fund = await p.evaluate(() => /A tese/.test(document.getElementById('main').innerText) && !!document.querySelector('.ficha-news'));
    rep(fund, vw + ' aba Fundamentos com a tese e o painel de notícias mantido');
    await p.evaluate(() => APP.abrirEmpresa('IMAB11')); await p.waitForTimeout(400);
    await p.evaluate(() => APP.fichaVista('documentos')); await p.waitForTimeout(200);
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
    const ordem = await p.evaluate(() => Array.from(document.querySelectorAll('#nav button')).map(b => b.dataset.a).join(','));
    rep(menu === '7|cart' && ordem === 'hoje,pautas,brasil,mundo,cart,bib,vip', vw + ' menu com sete seções: Pautas logo depois de Hoje (v4.2) e a VG VIP por último (' + menu + ' · ' + ordem + ')');
    // as cinco seções e a busca ficam visíveis sem rolagem escondida, inclusive no celular; a hora da coleta não some
    const topo = await p.evaluate(() => { const bs = Array.from(document.querySelectorAll('#nav button')), q = document.querySelector('.qbox'), ds = document.querySelector('.dstat b');
      return {nav: bs.every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1 && r.width > 30; }), busca: !!q && q.getBoundingClientRect().width > 80, hora: !!ds && /\d{2}:\d{2}/.test(ds.textContent) && ds.getBoundingClientRect().width > 0}; });
    rep(topo.nav && topo.busca && topo.hora, vw + ' topo: sete seções, busca e hora da coleta à vista (' + JSON.stringify(topo) + ')');
    // ---- v3.4: mesa em quatro áreas, profundidade de leitura, sumário, desde a última visita
    await p.evaluate(() => APP.go('hoje')); await p.waitForTimeout(300);
    const mesa = await p.evaluate(() => ({areas: ['radar', 'agenda-decisiva', 'research', 'debate'].filter(id => document.getElementById(id)).length, sumario: document.querySelectorAll('nav.sumario a[href^="#"]').length,
      desde: !!document.querySelector('.desde'), prof: document.querySelectorAll('.prof [role=radio]').length, ext: !!document.querySelector('#debate .ext a[href^="https://www.reddit.com/"]')}));
    rep(mesa.areas === 4 && mesa.sumario >= 4 && mesa.desde && mesa.prof === 3 && mesa.ext, vw + ' Hoje: quatro áreas, sumário, desde a última visita, profundidade e consultas externas (' + JSON.stringify(mesa) + ')');
    const prof = await p.evaluate(async () => { const r = []; for (const k of ['Rápida', 'Aprofundada', 'Briefing']) { Array.from(document.querySelectorAll('.prof button')).find(b => b.textContent === k).click(); await new Promise(z => setTimeout(z, 250)); r.push(k + ':' + (document.getElementById('ultimas') ? 'notícias' : 'sem notícias')); } return r.join(','); });
    rep(prof === 'Rápida:sem notícias,Aprofundada:notícias,Briefing:notícias', vw + ' profundidade de leitura muda o que aparece (' + prof + ')');
    // "Ler depois" guarda o item e ele aparece em Biblioteca › Salvos para ler
    const sv = await p.evaluate(async () => { const bt = document.querySelector('#prioridades .nw .nwl'); bt.click(); await new Promise(z => setTimeout(z, 200)); const b = Array.from(document.querySelectorAll('.drawer button')).find(x => /Ler depois/.test(x.textContent)); b.click(); await new Promise(z => setTimeout(z, 300));
      document.querySelector('.drawer .x').click(); APP.go('bib', 'busca'); APP.bibFiltro({grupo: 'salvos'}); await new Promise(z => setTimeout(z, 300)); return document.querySelectorAll('#main .nw').length; });
    rep(sv === 1, vw + ' "Ler depois" aparece em Salvos para ler (' + sv + ')');
    // Mundo › Research: faixas de recência; Debate: opiniões, colaboradores e consultas externas sem coleta
    await p.evaluate(() => APP.go('mundo', 'cartas')); await p.waitForTimeout(300);
    const rs = await p.evaluate(() => ({faixas: ['rs-7', 'rs-30', 'rs-90'].filter(id => document.getElementById(id)).length, hist: /Biblioteca histórica/.test(document.getElementById('main').innerText)}));
    rep(rs.faixas === 3 && rs.hist, vw + ' Research: 7 dias, 8 a 30, 31 a 90 e biblioteca histórica (' + JSON.stringify(rs) + ')');
    await p.evaluate(() => APP.go('mundo', 'debate')); await p.waitForTimeout(300);
    const db = await p.evaluate(() => { const t = document.getElementById('main').innerText; return {op: !!document.getElementById('db-op'), colab: !!document.getElementById('db-colab'), x: !!document.querySelector('#db-ext a[href^="https://x.com/search"]'), porque: /Por que não há coleta automática/.test(t)}; });
    rep(db.op && db.colab && db.x && db.porque, vw + ' Debate de mercado com consultas externas identificadas (' + JSON.stringify(db) + ')');
    // Fontes e coleta: fonte → última tentativa → último conteúdo → falha → publicados
    await p.evaluate(() => APP.go('bib', 'fontes')); await p.waitForTimeout(500);
    const dg = await p.evaluate(() => Array.from(document.querySelectorAll('#main table.t thead th')).map(th => th.textContent.trim()).slice(0, 5).join('|'));
    rep(dg === 'Fonte|Última tentativa|Último conteúdo|Falha|Publicados', vw + ' diagnóstico das fontes na ordem pedida (' + dg + ')');
    // busca sem texto: ativos vistos por último no topo
    await p.evaluate(() => { APP.abrirEmpresa('PRIO3'); APP.go('hoje'); APP.busca(); }); await p.waitForTimeout(200);
    const bv = await p.evaluate(() => { const li = document.querySelector('.cmdk li'); const t = li ? li.innerText : ''; document.querySelector('.cmdk-bg').remove(); return t; });
    rep(/PRIO3/.test(bv) && /visto por último/.test(bv), vw + ' busca vazia começa pelos ativos vistos por último (' + bv.replace(/\n/g, ' ') + ')');
    // ---- v3.5: casas de análise na ficha, pauta da semana, origem no Research, buscas salvas, resumo do mês
    await p.evaluate(() => { APP.abrirEmpresa('PETR4'); APP.fichaVista('casas'); }); await p.waitForTimeout(400);
    const cs = await p.evaluate(() => ({aba: (document.querySelector('.fv button[aria-selected="true"]') || {}).textContent || '', quadro: !!document.getElementById('casas-hoje'), grafico: !!document.getElementById('alvos-tempo'), tese: !!Array.from(document.querySelectorAll('.fv button')).find(b => /Mudanças na tese/.test(b.textContent))}));
    rep(/Casas de análise/.test(cs.aba) && cs.quadro && cs.grafico && cs.tese, vw + ' ficha: aba Casas de análise com o quadro e o gráfico, sem tirar as outras abas (' + JSON.stringify(cs) + ')');
    await p.evaluate(() => APP.go('brasil', 'pauta')); await p.waitForTimeout(300);
    const pt = await p.evaluate(() => { const t = document.getElementById('main').innerText; return {div: /Pilar Dividendos/.test(t), val: /Pilar Valor/.test(t), copiar: !!Array.from(document.querySelectorAll('button')).find(b => /Copiar pauta/.test(b.textContent))}; });
    rep(pt.div && pt.val && pt.copiar, vw + ' pauta da semana por pilar, com "Copiar pauta" (' + JSON.stringify(pt) + ')');
    await p.evaluate(() => APP.go('mundo', 'cartas')); await p.waitForTimeout(300);
    const og = await p.evaluate(() => Array.from(document.querySelectorAll('.rs-orig button')).map(b => b.firstChild.textContent).join('|'));
    rep(og === 'Brasil e mundo|Brasil|Mundo', vw + ' Research com origem Brasil e mundo (' + og + ')');
    const sb = await p.evaluate(async () => { try { localStorage.removeItem('oregon-intel-v3:buscas'); } catch (e) {} APP.go('bib', 'busca'); APP.bibFiltro({q: 'copom'}); await new Promise(z => setTimeout(z, 300)); const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent === 'Salvar busca'); if (!b) return 'sem botão'; b.click(); await new Promise(z => setTimeout(z, 300)); APP.bibFiltro({}); await new Promise(z => setTimeout(z, 200)); const c = document.querySelector('.bs .bs-c'); return c ? c.innerText.replace(/\s+/g, ' ') : 'sem busca salva'; });
    rep(/copom/.test(sb), vw + ' busca salva aparece na Biblioteca (' + sb + ')');
    await p.evaluate(() => APP.go('bib', 'mes')); await p.waitForTimeout(300);
    const rm = await p.evaluate(() => { const t = document.getElementById('main').innerText; return /Resumo do mês/.test(t) && (/publicações em/.test(t) || /Nenhuma publicação/.test(t)); });
    rep(rm, vw + ' resumo do mês por tema');
    // Biblioteca: filtros avançados recolhidos
    await p.evaluate(() => { APP.go('bib', 'busca'); APP.bibFiltro({}); }); await p.waitForTimeout(300);
    const bf = await p.evaluate(() => { const d = document.querySelector('details.mais-f'); return !!d && !d.open && document.querySelectorAll('.busca-box .busca-l select').length <= 2; });
    rep(bf, vw + ' Biblioteca com filtros avançados recolhidos');
    // ---- v3.5 · Estante, VG VIP separada da Oregon, mesmo fato agrupado
    await p.evaluate(() => APP.go('bib', 'estante')); await p.waitForTimeout(1200);
    const est = await p.evaluate(() => ({lomb: document.querySelectorAll('.est-spine').length, itens: document.querySelectorAll('.est-it').length, maub: /Mauboussin/.test(document.getElementById('main').innerText), indice: !!document.querySelector('.est-idx')}));
    rep(est.lomb >= 6 && est.itens > 20 && est.maub && est.indice, vw + ' Estante com coleções e acervo (' + JSON.stringify(est) + ')');
    await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.est-spine')).find(x => /Howard/.test(x.textContent)); b.click(); }); await p.waitForTimeout(300);
    const hm = await p.evaluate(() => { const l = Array.from(document.querySelectorAll('.est-it')); return l.length && l.every(x => !/Mauboussin/.test(x.querySelector('.est-m').textContent)) ? l.length : 0; });
    rep(hm > 20, vw + ' Estante filtra pela coleção (' + hm + ' memos)');
    await p.evaluate(() => APP.go('vip', 'hoje')); await p.waitForTimeout(600);
    const vh = await p.evaluate(() => ({mapa: document.querySelectorAll('.vip-mapa .atn-t').length + document.querySelectorAll('.vip-mapa .atn-z').length, quad: document.querySelectorAll('.vip-mapa .atn-t').length, radar: !!document.getElementById('vip-radar'), debate: !!document.getElementById('vip-debate'), vale: /VALE3/.test(document.getElementById('vip-radar').innerText)}));
    rep(vh.mapa === 35 && vh.quad < 35 && vh.radar && vh.debate && vh.vale, vw + ' Hoje VIP: mapa enxuto com os 35 ativos (quadrado só com acontecimento), radar e debate (' + JSON.stringify(vh) + ')');
    await p.evaluate(() => APP.go('vip', 'ativos')); await p.waitForTimeout(400);
    const va = await p.evaluate(() => ({tabelas: document.querySelectorAll('.vip-tw table').length, linhas: document.querySelectorAll('.vip-tw tbody tr').length, dy26: /DY PAGO 2026/i.test(document.getElementById('main').innerText), sw: document.documentElement.scrollWidth <= innerWidth + 1}));
    rep(va.tabelas === 3 && va.linhas === 35 && va.dy26 && va.sw, vw + ' Ativos VIP: três carteiras, 35 linhas, todas as colunas, sem rolagem lateral da página (' + JSON.stringify(va) + ')');
    await p.evaluate(() => APP.abrirFichaVip('LREN3')); await p.waitForTimeout(500);
    const vf = await p.evaluate(() => { const t = document.getElementById('main').innerText; return /Números do print/.test(t) && /O que cada casa diz hoje/.test(t) && /BTG Pactual/.test(t) && /Notícias de LREN3/.test(t); });
    rep(vf, vw + ' ficha VIP com números do print, casas de análise e notícias');
    // não misturar: o que é só da VIP não aparece nas telas da Oregon
    await p.evaluate(() => APP.go('hoje')); await p.waitForTimeout(500);
    const mist = await p.evaluate(() => { const t = document.getElementById('radar') ? document.getElementById('radar').innerText : ''; const a = document.getElementById('atencao') ? document.getElementById('atencao').innerText : ''; return /VALE3|LREN3|SBSP3/.test(t + a); });
    rep(!mist, vw + ' Hoje da Oregon sem os ativos só da VIP');
    await p.evaluate(() => APP.go('vip', 'pauta')); await p.waitForTimeout(400);
    const vp = await p.evaluate(() => ({secs: document.querySelectorAll('#main .sec').length, copiar: !!Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Copiar pauta')}));
    rep(vp.secs === 3 && vp.copiar, vw + ' Pauta VIP por carteira (' + JSON.stringify(vp) + ')');
    // ---- v3.6 · comitê do mês (sugestão, item à mão), proventos, fundos, cartas, wealth, trilha, clássico, ponte VIP
    const cm = await p.evaluate(async () => {
      const z = ms => new Promise(r => setTimeout(r, ms));
      try { localStorage.removeItem('oregon-v3:comite'); } catch (e) {}
      APP.go('cart', 'comite'); await z(400);
      const lv = Array.from(document.querySelectorAll('.cm-sug button')).find(b => b.textContent === 'Levar'); if (!lv) return 'sem sugestão';
      lv.click(); await z(400);
      const n1 = document.querySelectorAll('.cm-it').length;
      Array.from(document.querySelectorAll('button')).find(b => b.textContent === '+ Item à mão').click(); await z(300);
      const f = document.querySelector('.cm-form'); f.querySelector('input').value = 'Revisar peso de Klabin'; Array.from(f.querySelectorAll('button')).find(b => b.textContent === 'Pôr na pauta').click(); await z(400);
      const n2 = document.querySelectorAll('.cm-it').length, manual = /Revisar peso de Klabin/.test(document.getElementById('main').innerText);
      return n1 + '|' + n2 + '|' + manual;
    });
    rep(cm === '1|2|true', vw + ' comitê do mês: sugestão levada e item à mão na pauta (' + cm + ')');
    const fav = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); APP.go('hoje'); await z(400); const r = document.querySelector('#ultimas .nr') || document.querySelector('.nr'); r.querySelector('.nr-t').click(); await z(200); if (!r.querySelector('.nr-d')) { r.querySelector('.nr-t').click(); await z(200); }
      const b = r.querySelector('.cm-b'); if (!b) return 'sem botão'; const t0 = b.textContent; b.click(); await z(300); const t1 = b.textContent; b.click(); await z(300); return t0 + '→' + t1 + '→' + b.textContent; });
    rep(/^(Levar ao comitê→Na pauta do comitê→Levar ao comitê|Na pauta do comitê→Levar ao comitê→Na pauta do comitê)$/.test(fav), vw + ' "Levar ao comitê" numa notícia liga e desliga (' + fav + ')');
    await p.evaluate(() => APP.go('brasil', 'proventos')); await p.waitForTimeout(700);
    const pv = await p.evaluate(() => { const ts = Array.from(document.querySelectorAll('.pv-t')); const tags = Array.from(document.querySelectorAll('.pv-tag')).map(x => x.textContent);
      return {tabelas: ts.length, linhas: document.querySelectorAll('.pv-t tbody tr').length, vir: tags.includes('a vir'), receber: tags.includes('a receber'),
        dcFut: ts[0] ? Array.from(ts[0].querySelectorAll('tbody tr')).every(r => r.querySelector('.pv-tag')) : false}; });
    rep(pv.tabelas === 2 && pv.linhas > 0 && pv.vir && pv.receber && pv.dcFut, vw + ' agenda de proventos: data-com à frente e pagamentos a receber separados (' + JSON.stringify(pv) + ')');
    await p.evaluate(() => APP.go('brasil', 'fundos')); await p.waitForTimeout(700);
    const fd = await p.evaluate(() => { const t = document.getElementById('main').innerText; return /Carteiras de julho de 2026/.test(t) && /Gestora Alfa/.test(t); });
    rep(fd, vw + ' quem tem a ação: mês da CVM e gestora');
    await p.evaluate(() => APP.go('brasil', 'cartas')); await p.waitForTimeout(700);
    const tc = await p.evaluate(() => ({emp: document.querySelectorAll('.tc-i').length, petr: /PETR4/.test(document.getElementById('main').innerText)}));
    rep(tc.emp === 2 && tc.petr, vw + ' termômetro das cartas, só empresas das carteiras por padrão (' + JSON.stringify(tc) + ')');
    await p.evaluate(() => APP.go('mundo', 'wealth')); await p.waitForTimeout(500);
    const wl = await p.evaluate(() => { const t = document.getElementById('main').innerText; return /CVM abre audiência/.test(t) && /RIA M&A/.test(t); });
    rep(wl, vw + ' Wealth e consultorias com CVM e imprensa especializada');
    await p.evaluate(() => APP.go('bib', 'trilha')); await p.waitForTimeout(900);
    const tr = await p.evaluate(() => ({mods: document.querySelectorAll('.tr-m').length, cfp: /VIII · Psicologia/.test(document.getElementById('main').innerText)}));
    rep(tr.mods === 16 && tr.cfp, vw + ' trilha CFP (8) e CFA III (8) (' + JSON.stringify(tr) + ')');
    await p.evaluate(() => { APP.setProf && APP.setProf('briefing'); APP.go('hoje'); }); await p.waitForTimeout(800);
    const cl = await p.evaluate(() => !!document.querySelector('.paper-sem.classico'));
    rep(cl, vw + ' clássico da semana no Research do Hoje');
    const pte = await p.evaluate(async () => { APP.abrirFicha('KLBN4'); await new Promise(r => setTimeout(r, 400)); const t = document.querySelector('.drawer').innerText; document.querySelector('.drawer').remove(); return /Também na VG VIP/.test(t); });
    rep(pte, vw + ' ponte Oregon → VIP na ficha');
    // ---- v3.7 · topo, aviso ao atualizar, explicações, Hoje, marcas, eventos, recomendações, fechamento, busca, cartas, celular, impressão, tema
    await p.evaluate(() => APP.go('hoje')); await p.waitForTimeout(500);
    const tp7 = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); const d = document.querySelector('.top .dstat'); const txt = d.innerText; d.click(); await z(150);
      const pop = document.querySelector('.pop'); const r = {txt: txt, pop: !!pop, coletar: !!(pop && pop.querySelector('a[href*="actions/workflows/robo.yml"]')), prox: !!(pop && /Próxima coleta prevista/.test(pop.innerText))};
      const esc = pop && Array.from(pop.querySelectorAll('.seg button')).find(b => b.textContent === 'Escuro'); if (esc) esc.click(); await z(100);
      r.dark = document.documentElement.getAttribute('data-theme') === 'dark' && getComputedStyle(document.body).backgroundColor !== 'rgb(242, 244, 248)';
      const auto = pop && Array.from(pop.querySelectorAll('.seg button')).find(b => b.textContent === 'Automático'); if (auto) auto.click(); document.body.click(); await z(100); r.fechou = !document.querySelector('.pop'); return r; });
    rep(tp7.pop && tp7.coletar && tp7.prox && tp7.dark && tp7.fechou && !/atrasado/.test(tp7.txt), vw + ' topo: ponto + hora; detalhes, tema escuro e "Coletar agora" no toque (' + JSON.stringify(tp7) + ')');
    const av7 = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); const b = Array.from(document.querySelectorAll('.mesa-ctl button')).find(x => /Atualizar/.test(x.textContent)); b.click(); await z(1200);
      const a = document.querySelector('.aviso-at'); return {aviso: a ? a.textContent : null, coletar: !!document.querySelector('.mesa-ctl a[href*="actions/workflows/robo.yml"]')}; });
    rep(av7.aviso && /^Conferido às \d\d:\d\d: (nada novo desde a coleta (das \d|de )|chegou)/.test(av7.aviso) && av7.coletar, vw + ' aviso depois do Atualizar e "Coletar agora" no Hoje (' + JSON.stringify(av7) + ')');
    const hj7 = await p.evaluate(() => { const cols = document.querySelectorAll('.mesa > .mesa-col'); const fx = document.querySelector('.fxd'); const ids = s => Array.from(document.querySelectorAll(s)).map(x => x.id).filter(Boolean).join(',');
      if (document.documentElement.classList.contains('v4')) return Object.assign(hj7v4(), {fxd: fx ? fx.querySelectorAll('.fxd-i').length : -1, alertas: !!document.getElementById('alertas'), fila: !!document.getElementById('fila'),
        vz1: document.querySelectorAll('#agenda-decisiva .vz1').length, sticky: getComputedStyle(document.querySelector('.sumario')).position, tp: document.querySelectorAll('#ultimas .mt').length, leg: !!document.querySelector('#ultimas .mt-leg'),
        ev: Array.from(document.querySelectorAll('.mk.evc')).map(x => x.textContent).join('|'), evf: !!document.querySelector('.ev-f button'), divVip: INTEL.eventosDe(APP.itemPorId('vip3')).join() === 'divida'});
      function hj7v4() { return {cols: 2, colA: ids('.v4-main > section') === 'mercado-hoje,radar' && /^atencao,agenda-decisiva/.test(ids('.v4-side > *')) && ids('.v4-baixo > section') === 'research,debate' ? 'radar,research' : 'v4:' + ids('.v4-main > section') + '|' + ids('.v4-side > *') + '|' + ids('.v4-baixo > section')}; }
      return {cols: cols.length, colA: cols[0] ? Array.from(cols[0].children).map(x => x.id).join(',') : '', fxd: fx ? fx.querySelectorAll('.fxd-i').length : -1, alertas: !!document.getElementById('alertas'), fila: !!document.getElementById('fila'),
        vz1: document.querySelectorAll('#agenda-decisiva .vz1').length, sticky: getComputedStyle(document.querySelector('.sumario')).position, tp: document.querySelectorAll('#ultimas .mt').length, leg: !!document.querySelector('#ultimas .mt-leg'),
        ev: Array.from(document.querySelectorAll('.mk.evc')).map(x => x.textContent).join('|'), evf: !!document.querySelector('.ev-f button'), divVip: INTEL.eventosDe(APP.itemPorId('vip3')).join() === 'divida'}; });
    rep(hj7.cols === 2 && hj7.colA === 'radar,research' && hj7.fxd >= 2 && hj7.alertas && hj7.fila && hj7.vz1 >= 1 && hj7.sticky === 'sticky' && hj7.tp > 5 && hj7.leg && /Recompra/.test(hj7.ev) && hj7.evf && hj7.divVip,
      vw + ' Hoje: duas colunas, faixa do dia, alertas e fila, vazios em uma linha, atalhos fixos, marcas e eventos (' + JSON.stringify(hj7) + ')');
    const ph7 = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); APP.go('brasil', 'proventos'); await z(400); const f = document.querySelector('.page-h .ph-f'); const v0 = getComputedStyle(f).display;
      document.querySelector('.page-h .qbtn').click(); await z(50); return {antes: v0, depois: getComputedStyle(f).display}; });
    rep(ph7.antes === 'none' && ph7.depois === 'block', vw + ' explicação recolhida no "?" e aberta ao tocar (' + JSON.stringify(ph7) + ')');
    const rm7 = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); APP.go('brasil', 'recomendacoes'); await z(400); const t = document.querySelector('.rm-t'); const tx = t ? t.innerText : '';
      return {linhas: t ? t.querySelectorAll('tbody tr').length : 0, klbn: /KLBN4[\s\S]*Itaú BBA[\s\S]*Compra · R\$ 25,00\s+Neutro/.test(tx), txt: tx.slice(0, 300)}; });
    rep(rm7.linhas >= 1 && rm7.klbn, vw + ' mudanças de recomendação: a mesma casa contra a visão anterior (' + JSON.stringify(rm7) + ')');
    const fs7 = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); APP.go('cart', 'semana'); await z(500); const t = document.getElementById('main').innerText;
      const r = {secs: document.querySelectorAll('.fs .sec').length, fluxo: /Ações [−+]?R\$/.test(t), copiar: /Copiar/.test(t), imprimir: /Imprimir/.test(t), mud: /Klabin|KLBN4/.test(t), recompra: /recompra/i.test(t), carta: /Gestora Teste A/.test(t)};
      // o fluxo e as cartas do site de teste têm datas fixas (semana de 02/11): numa semana sem esses dados, confere a semana anterior
      if (!r.fluxo || !r.carta) { APP.FS = {off: 1}; APP.rerender(); await z(300); const t1 = document.getElementById('main').innerText; r.fluxo = r.fluxo || /Ações [−+]?R\$/.test(t1); r.carta = r.carta || /Gestora Teste A/.test(t1); r.semanaAnterior = true; APP.FS = {off: 0}; APP.rerender(); await z(150); }
      return r; });
    rep(fs7.secs === 9 && fs7.fluxo && fs7.copiar && fs7.imprimir && fs7.mud && fs7.recompra && fs7.carta, vw + ' fechamento da semana com as nove seções (com o fluxo dos fundos), copiar e imprimir (' + JSON.stringify(fs7) + ')');
    const bq7 = await p.evaluate(() => { const it = APP.itensAtivo(), f = q => INTEL.filtrar(it, {q: q}).map(x => x.id);
      return {ev: f('evento:recompra').join(','), fonte: f('fonte:"Money Times" ativo:KLBN4').length, frase: f('"programa de recompra"').join(','), fora: f('Klabin -corta').some(id => id === 'op_new'), periodo: f('ativo:KLBN4 desde:01/11/2026').indexOf('op_old') < 0, tipo: f('tipo:opiniao ativo:KLBN4').length}; });
    rep(bq7.ev === 'e1' && bq7.fonte >= 2 && bq7.frase === 'e1' && !bq7.fora && bq7.periodo && bq7.tipo >= 2, vw + ' busca com filtros: evento, fonte, frase, exclusão, período e tipo (' + JSON.stringify(bq7) + ')');
    const tc7 = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); APP.go('brasil', 'cartas'); await z(500); const d = document.querySelector('.tc-d'); if (d) d.open = true; await z(50);
      const tr = document.querySelector('.tc-tr'); const g = Array.from(document.querySelectorAll('.sub.filt button')).find(b => b.textContent === 'Ao longo dos meses'); g.click(); await z(200);
      const tb = document.querySelector('.tc-g'); return {trecho: tr ? tr.textContent.slice(0, 40) : null, meses: tb ? tb.querySelectorAll('thead th').length - 2 : 0, petr: tb ? /PETR4/.test(tb.innerText) : false}; });
    await p.evaluate(() => { const g = Array.from(document.querySelectorAll('.sub.filt button')).find(b => b.textContent === 'Um mês'); if (g) g.click(); });
    rep(tc7.trecho && /Petrobras/.test(tc7.trecho) && tc7.meses >= 2 && tc7.petr, vw + ' termômetro: trecho literal da carta e grade empresa × mês (' + JSON.stringify(tc7) + ')');
    if (vw === 1440) {
      const fl7 = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); APP.go('brasil', 'ativos'); await z(400); const b = document.querySelector('.rec-l'); b.click(); await z(300);
        const g = document.querySelector('.grid-emp'), r = {rec: g.classList.contains('recolhida'), lista: getComputedStyle(document.querySelector('.lista-at')).display, strip: getComputedStyle(document.querySelector('.tk-strip')).display, larg: document.querySelector('.ficha-at').offsetWidth, cheia: document.querySelector('.ficha-at').offsetWidth >= document.getElementById('main').clientWidth - 40, v4: document.documentElement.classList.contains('v4')};
        document.querySelector('.rec-a').click(); await z(300); r.volta = !document.querySelector('.grid-emp').classList.contains('recolhida'); return r; });
      rep(fl7.rec && fl7.lista === 'none' && fl7.strip === 'flex' && (fl7.v4 ? fl7.cheia && fl7.larg > 1000 : fl7.larg > 1200) && fl7.volta, vw + ' ficha mais larga: a lista recolhe e volta (' + JSON.stringify(fl7) + ')');
    } else {
      const ce7 = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); APP.lsSet('area-research', false); APP.go('hoje'); await z(500); const nav = document.getElementById('nav').getBoundingClientRect();
        const r = {navBaixo: Math.abs(nav.bottom - window.innerHeight) < 2, radar: !document.getElementById('radar').classList.contains('fechada'), research: document.getElementById('research').classList.contains('fechada')};
        document.querySelector('#debate > header').click(); await z(80); r.abre = !document.getElementById('debate').classList.contains('fechada');
        document.querySelector('#debate > header').click(); await z(80);
        const tt = document.querySelector('#radar .nr-tx'); r.clamp = tt ? getComputedStyle(tt).webkitLineClamp : null; r.alt = tt ? Math.round(tt.getBoundingClientRect().height / parseFloat(getComputedStyle(tt).lineHeight)) : null; return r; });
      rep(ce7.navBaixo && ce7.radar && ce7.research && ce7.abre && String(ce7.clamp) === '2', vw + ' celular: seções embaixo, áreas recolhíveis e notícias em duas linhas (' + JSON.stringify(ce7) + ')');
    }
    const nul7 = await p.evaluate(async (rotas) => { const z = ms => new Promise(r => setTimeout(r, ms)); const ruins = [];
      for (const r of rotas) { const [a, s] = r.split('/'); APP.go(a, s); await z(250); if (/(^|\s)(null|undefined|NaN)(\s|$)/.test(document.getElementById('main').innerText)) ruins.push(r); }
      return ruins; }, ['hoje', 'brasil/ativos', 'brasil/pauta', 'brasil/proventos', 'brasil/fundos', 'brasil/cartas', 'brasil/recomendacoes', 'brasil/fluxo', 'mundo/agora', 'mundo/wealth', 'cart/comite', 'cart/semana', 'bib/busca', 'bib/estante', 'bib/trilha', 'vip/hoje', 'vip/ativos', 'vip/pauta']);
    rep(!nul7.length, vw + ' nenhuma tela escreve "null", "undefined" ou "NaN" (' + nul7.join(', ') + ')');
    const fx8 = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); APP.go('brasil', 'fluxo'); await z(500); const t = document.getElementById('main').innerText;
      return {sem: document.querySelectorAll('.fx-t')[0] ? document.querySelectorAll('.fx-t')[0].querySelectorAll('tbody tr').length : 0, meses: document.querySelectorAll('.fx-t').length, barras: document.querySelectorAll('.fx-bar i.pos, .fx-bar i.neg').length,
        res: /Semana de \d\d\/\d\d a \d\d\/\d\d/.test(t), neg: /−R\$ 8 mi/.test(t), sw: document.documentElement.scrollWidth <= innerWidth}; });
    rep(fx8.sem >= 2 && fx8.meses === 2 && fx8.barras >= 2 && fx8.res && fx8.neg && fx8.sw, vw + ' fluxo dos fundos: semana a semana e mês a mês, com barras (' + JSON.stringify(fx8) + ')');
    // v3.8.2 · research das casas: só links externos (Brasil e global), nenhum do Grupo XP, em Research global e no Debate
    const rc8 = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); APP.go('mundo', 'cartas'); await z(450);
      const s = document.getElementById('rs-casas'); if (s && s.tagName === 'DETAILS') s.open = true;
      const as = s ? Array.from(s.querySelectorAll('a')) : [], sw = document.documentElement.scrollWidth <= innerWidth;
      const grupos = s ? Array.from(s.querySelectorAll('h3')).map(e => e.textContent) : [];
      APP.go('mundo', 'debate'); await z(450); const db = Array.from(document.querySelectorAll('#db-ext a')).filter(a => /Research das casas/.test(a.closest('.ext-g') ? a.closest('.ext-g').textContent : ''));
      return {n: as.length, casas: s ? s.querySelectorAll('li').length : 0, grupos: grupos.join('|'), https: as.every(a => a.href.indexOf('https://') === 0), fora: as.every(a => a.target === '_blank' && a.rel === 'noopener'),
        xp: as.concat(db).some(a => /xpi\.com|xp\.com\.br|infomoney|rico\.com|clear\.com\.br|conteudos\.xp/i.test(a.href)), deb: db.length, sw}; });
    rep(rc8.casas >= 20 && rc8.n >= rc8.casas && rc8.grupos === 'Brasil|Global' && rc8.https && rc8.fora && !rc8.xp && rc8.deb >= 20 && rc8.sw, vw + ' research das casas: links externos do Brasil e global, sem Grupo XP, em Research global e no Debate (' + JSON.stringify(rc8) + ')');
    // v3.9 · Biblioteca › Inglês: voz e microfone simulados (o navegador de teste não tem voz nem reconhecimento de fala)
    const en9 = await p.evaluate(async () => {
      const z = ms => new Promise(r => setTimeout(r, ms)), r = {};
      for (const v of STORE.list('vocab')) await STORE.del('vocab', v.id);
      APP.lsSet('ing-passo', null); APP.lsSet('ing-dia', null); APP.lsSet('ing-feitos', []); APP.lsSet('ing-vel', 0.75);
      window.__falado = [];
      Object.defineProperty(window, 'speechSynthesis', {configurable: true, value: {speak: u => window.__falado.push([u.text, u.rate]), cancel: () => {}, getVoices: () => [], addEventListener: () => {}}});
      window.__fala = 'stocks rally on weaker dollar';
      window.SpeechRecognition = window.webkitSpeechRecognition = function () { const me = this; me.start = () => setTimeout(() => { me.onresult({results: [[{transcript: window.__fala}]]}); me.onend && me.onend(); }, 20); };
      APP.go('bib', 'ingles'); await z(500);
      const main = document.getElementById('main'), card = () => main.querySelector('#en-dia .en-card');
      r.h1 = /Inglês do mercado/.test(main.querySelector('h1').textContent);
      r.passos = main.querySelectorAll('.en-pontos i').length === 8;
      r.passo1 = /Manchete 1 de 5/.test(card().textContent);
      r.escondido = !card().querySelector('.en-frase');
      Array.from(card().querySelectorAll('button')).find(b => / Ouvir$/.test(b.textContent)).click();
      Array.from(card().querySelectorAll('button')).find(b => b.textContent === 'Mais devagar').click();
      r.voz = window.__falado.length === 2 && Math.abs(window.__falado[0][1] - 0.75) < 0.01 && Math.abs(window.__falado[1][1] - 0.6) < 0.01 && window.__falado[0][0].split(' ').length >= 6;
      Array.from(card().querySelectorAll('button')).find(b => b.textContent === 'Mostrar o texto').click(); await z(100);
      const fr = card().querySelector('.en-frase'); r.frase = !!fr && fr.querySelectorAll('.gl-t').length >= 1;
      fr.querySelector('.gl-t').click(); await z(50);
      r.def = !!card().querySelector('.gl-def b') && card().querySelector('.gl-def').textContent.length > 20;
      const tr = card().querySelector('a.en-trad'); r.trad = !!tr && tr.href.indexOf('https://translate.google.com/?sl=en&tl=pt&text=') === 0;
      window.__fala = fr.textContent.trim().split(' ').slice(0, -1).join(' ');
      card().querySelector('.en-mic').click(); await z(120);
      const cf = card().querySelector('.en-conf'); r.conf = !!cf && /% das palavras/.test(cf.textContent) && cf.querySelectorAll('.cf-x').length >= 1 && cf.querySelectorAll('.cf-ok').length >= 3;
      Array.from(card().querySelectorAll('button')).find(b => b.textContent === 'Salvar frase').click(); await z(100);
      r.salvo = STORE.list('vocab').length === 1;
      const prox = () => Array.from(main.querySelectorAll('#en-dia .en-nav button')).find(b => /Próxima|Concluir/.test(b.textContent));
      for (let i = 0; i < 5; i++) { prox().click(); await z(60); }
      r.fale = /Fale você · 1 de 3/.test(card().textContent) && /pilar de (Dividendos|Valor)/.test(card().querySelector('.en-pt').textContent);
      for (let i = 0; i < 3; i++) { prox().click(); await z(60); }
      r.fim = /Pronto por hoje/.test(card().textContent) && APP.lsGet('ing-feitos', []).length === 1;
      // conferência da fala e arquivo do Anki (funções puras)
      const c1 = INTEL.conferirFala('Treasury yields climb to 4.5% as the Fed signals a pause', ['treasury yields climb to 4.5 percent as the fed signals a pause']);
      const c2 = INTEL.conferirFala('Stocks rally on weaker dollar', ['stocks on a weaker dollar']);
      r.conferir = c1.pct === 100 && c2.pct === 80 && c2.ok.join() === 'true,false,true,true,true';
      const anki = INTEL.textoAnki([{en: 'buyback', pt: 'recompra de ações', exp: 'A empresa compra as próprias ações.', ex: 'The board approved a new buyback.', tipo: 'termo'}]);
      r.anki = anki.indexOf('#separator:tab\n#html:true\n') === 0 && anki.indexOf('buyback\trecompra de ações<br>A empresa compra as próprias ações.<br><i>The board approved a new buyback.</i>\toregon termo') > 0;
      const rv = INTEL.proximaRevisao({caixa: 2}, true, '2026-11-08'), rv0 = INTEL.proximaRevisao({caixa: 4}, false, '2026-11-08');
      r.revisao = rv.caixa === 3 && rv.prox === '2026-11-15' && rv0.caixa === 0 && rv0.prox === '2026-11-08';
      // revisão em cartões com a frase salva
      APP.rerender(); await z(300);
      const rev = main.querySelector('#en-rev'); Array.from(rev.querySelectorAll('button')).find(b => b.textContent === 'Mostrar a resposta').click(); await z(50);
      Array.from(main.querySelector('#en-rev').querySelectorAll('button')).find(b => b.textContent === 'Acertei').click(); await z(100);
      const v = STORE.list('vocab')[0]; r.cartao = v.caixa === 1 && v.prox > INTEL.hojeBRT() && /Revisão de hoje concluída/.test(main.querySelector('#en-rev').textContent);
      // glossário: busca em português acha o termo em inglês
      const inp = main.querySelector('#en-gl input[type=search]'); inp.value = 'recompra'; inp.dispatchEvent(new Event('input')); await z(50);
      r.glossario = Array.from(main.querySelectorAll('#en-gl .gl-li b')).some(b => b.textContent === 'buyback');
      r.podcasts = main.querySelectorAll('#en-pod a[target=_blank]').length === 4;
      r.sw = document.documentElement.scrollWidth <= innerWidth;
      const nm = main.innerText.match(/.{0,30}(^|\s)(null|undefined|NaN)(\s|$).{0,30}/); r.nul = !nm || nm[0];
      // listas e leitura: botão de ouvir só nas manchetes em inglês
      APP.go('mundo', 'agora'); await z(500);
      const rows = Array.from(document.querySelectorAll('#main article.nr')), por = {}; APP.itens().forEach(x => { por[x.id] = x; });
      r.linhas = rows.filter(a => a.querySelector('.en-row')).length > 0 && rows.every(a => !!a.querySelector('.en-row') === ((por[a.dataset.id] || {}).idioma === 'en'));
      const xen = APP.itens().find(x => x.idioma === 'en'), xpt = APP.itens().find(x => x.idioma !== 'en');
      APP.abrirItem(xen); await z(150); r.leituraEN = !!document.querySelector('.drawer .en-bar .en-mic') && !!document.querySelector('.drawer .en-bar a.en-trad');
      document.querySelector('.drawer').remove(); APP.abrirItem(xpt); await z(150); r.leituraPT = !document.querySelector('.drawer .en-bar'); document.querySelector('.drawer').remove();
      for (const v2 of STORE.list('vocab')) await STORE.del('vocab', v2.id);
      APP.lsSet('ing-passo', null); APP.lsSet('ing-feitos', []);
      return r; });
    rep(Object.values(en9).every(v => v === true), vw + ' inglês: sessão do dia (ouvir, texto, glossário, traduzir, conferir a fala, salvar, falar sobre a carteira), revisão, Anki, glossário, podcasts e botão nas manchetes em inglês (' + JSON.stringify(en9) + ')');
    // v3.9.1 · aviso de atraso do GitHub (API do GitHub simulada: sem rodada, rodando, sem resposta)
    const gh9 = await p.evaluate(async () => {
      const z = ms => new Promise(r => setTimeout(r, ms)), r = {}, v = APP.intel.versao, g0 = v.gerado_em, f0 = window.fetch;
      window.fetch = (u, o) => /api\.github\.com/.test(String(u)) ? (window.__ghFix === 'erro' ? Promise.reject(new Error('offline')) : Promise.resolve({ok: true, json: () => Promise.resolve({workflow_runs: window.__ghFix})})) : f0(u, o);
      const caso = async (fix) => { window.__ghFix = fix; APP._ghColeta.t = 0; APP._ghColeta.runs = null; APP.go('hoje'); APP.atrasoColeta(); await z(150); APP.rerender(); await z(150); const a = document.querySelector('#main .aviso-gh'); return a ? a.textContent : ''; };
      v.gerado_em = new Date(Date.now() - 5 * 3600e3).toISOString(); const u0 = APP.intel.ultimoAviso; APP.intel.ultimoAviso = null;
      const t9 = await caso([]); r.nada = /Atraso do GitHub: (ele não disparou .*; nada novo desde a coleta das|desde a coleta das .*, ele não disparou as \d+ coletas previstas\.)/.test(t9);
      APP.intel.ultimoAviso = 'Conferido às 07:12: nada novo desde a coleta das 03:11. Próxima coleta prevista às 07:37; o GitHub costuma atrasar.'; APP.rerender(); await z(100);
      r.semRepetir = !!document.querySelector('#main .aviso-at') && !/nada novo/.test(document.querySelector('#main .aviso-gh').textContent);
      // textos: 1 coleta, 2 coletas e várias (funções puras, horários de Brasília)
      const dH = INTEL.hojeBRT(), T = (n, gh) => INTEL.textoAtraso({perdidas: [Date.parse(dH + 'T04:15:00-03:00'), Date.parse(dH + 'T05:07:00-03:00'), Date.parse(dH + 'T05:37:00-03:00')].slice(0, n), desde: Date.parse(dH + 'T03:11:00-03:00'), gh: gh});
      r.textos = /não disparou a coleta prevista das 04:15; nada novo desde a coleta das 03:11\./.test(T(1, 'nada')) && /as coletas previstas das 04:15 e das 05:07 ainda não chegaram; nada novo desde a coleta das 03:11\./.test(T(2, null)) && /desde a coleta das 03:11, ele não disparou as 3 coletas previstas\./.test(T(3, 'nada')); APP.intel.ultimoAviso = u0; APP.rerender(); await z(80);
      r.botao = !!document.querySelector('#main .aviso-gh a.btn.pri') && document.querySelector('#main .mesa-ctl a[href*="actions/workflows/robo.yml"]').classList.contains('pri');
      r.depoisDoTitulo = document.querySelector('#main .mesa-h').nextElementSibling.classList.contains('aviso-gh');
      const ini = Date.now() - 6e5, brt = new Date(ini - 3 * 3600e3), hmBRT = ('0' + brt.getUTCHours()).slice(-2) + ':' + ('0' + brt.getUTCMinutes()).slice(-2);
      r.rodando = (await caso([{status: 'in_progress', created_at: new Date(ini).toISOString(), run_started_at: new Date(ini).toISOString()}])).indexOf('está rodando agora (começou às ' + hmBRT + ')') >= 0 && !document.querySelector('#main .aviso-gh a.btn');
      r.semApi = /ainda não cheg(ou|aram)/.test(await caso('erro'));
      document.querySelector('.dstat').click(); await z(80); r.pop = Array.from(document.querySelectorAll('.pop .pop-l.warn')).some(e => /Atraso do GitHub/.test(e.textContent)); document.body.click(); await z(50);
      const pp = document.querySelector('.pop'); if (pp) pp.remove();
      r.prox = /^\d\d:\d\d$/.test(APP.proximaColeta());
      r.sw = document.documentElement.scrollWidth <= innerWidth;
      v.gerado_em = new Date(Date.now() - 4 * 60e3).toISOString(); APP.rerender(); await z(150); r.semAtraso = !document.querySelector('#main .aviso-gh');
      v.gerado_em = g0; window.fetch = f0; APP._ghColeta.t = 0; APP._ghColeta.runs = null; APP.rerender(); await z(100);
      return r; });
    rep(Object.values(gh9).every(v => v === true), vw + ' atraso do GitHub: aviso no topo do Hoje e no detalhe da coleta, com o Coletar agora destacado; some quando a coleta chega (' + JSON.stringify(gh9) + ')');
    // v3.10 · Mercado hoje · Brasil (macro do Brasil), filtro Macro Brasil e InfoMoney marcado como Grupo XP e fora da pauta
    const mh10 = await p.evaluate(async () => {
      const z = ms => new Promise(r => setTimeout(r, ms)), r = {}, p0 = APP.prof();
      const ver = async (prof) => { APP.setProf(prof); APP.go('hoje'); await z(400); const s = document.getElementById('mercado-hoje'); if (s && s.classList.contains('fechada')) s.querySelector('header').click(); await z(50); return s; };
      let s = await ver('rapida');
      r.rapida = !!s;
      s = await ver('briefing');
      r.depoisDoMapa = !!s && (document.documentElement.classList.contains('v4') ? s.parentElement.classList.contains('v4-main') && !s.previousElementSibling && !!document.querySelector('.v4-g > .v4-side > #atencao:first-child')
        : !!s.previousElementSibling && s.previousElementSibling.id === 'atencao');
      r.nav = !!document.querySelector('nav.sumario a[href="#mercado-hoje"]');
      const t = s.innerText;
      r.agenda = /Para começar o dia[\s\S]*Agenda desta segunda-feira/.test(t);
      r.itens = /Dólar fecha em queda/.test(t) && /Ata do Copom/.test(t) && /Haddad promete/.test(t);
      r.semMundo = !/Treasury|Fed signals/.test(t);
      r.xp = Array.from(s.querySelectorAll('article.nr')).some(a => /Haddad promete/.test(a.textContent) && a.querySelector('.xp-b') && /Grupo XP/.test(a.querySelector('.xp-b').textContent));
      const bj = Array.from(s.querySelectorAll('.mb-f button')).find(b => /^Juros/.test(b.textContent)); bj.click(); await z(250);
      const s2 = document.getElementById('mercado-hoje'), t2 = s2.innerText; r.filtro = /Ata do Copom/.test(t2) && !/Dólar fecha em queda/.test(t2);
      Array.from(s2.querySelectorAll('.mb-f button')).find(b => /^Juros/.test(b.textContent)).click(); await z(200);
      r.dica = getComputedStyle(document.querySelector('#mercado-hoje .mb-h')).display === 'none';
      const fm = Array.from(document.querySelectorAll('#ultimas .filt button')).find(b => /Macro Brasil/.test(b.textContent)); r.filtroTodas = !!fm && !fm.disabled;
      r.funcoes = INTEL.grupoXP({organizacao: 'InfoMoney'}) && !INTEL.bloqueado({organizacao: 'InfoMoney'}) && INTEL.bloqueado({organizacao: 'XP Investimentos'}) && INTEL.MACRO_NOMES.juros === 'Juros';
      r.sw = document.documentElement.scrollWidth <= innerWidth;
      const nm = document.getElementById('main').innerText.match(/.{0,30}(^|\s)(null|undefined|NaN)(\s|$).{0,30}/); r.nul = !nm || nm[0];
      APP.setProf(p0); await z(100);
      return r; });
    rep(Object.values(mh10).every(v => v === true), vw + ' mercado hoje · Brasil: em todos os modos, depois do mapa, com a agenda do dia, filtro por assunto, InfoMoney marcado Grupo XP e filtro Macro Brasil (' + JSON.stringify(mh10) + ')');
    // v3.11 · corrente de rodadas (próxima coleta e texto do detalhe) e painel novo no Atualizar (painel.json simulado)
    const c11 = await p.evaluate(async () => {
      const z = ms => new Promise(r => setTimeout(r, ms)), r = {}, v = APP.intel.versao, c0 = v.corrente, f0 = window.fetch, rc0 = APP._recarregar, u0 = APP.intel.ultimoAviso;
      const hm = t => new Date(t - 3 * 3600e3).toISOString().slice(11, 16), iso = t => new Date(t - 3 * 3600e3).toISOString().slice(0, 16) + '-03:00';
      r.robo = !!(c0 && c0.ativo && /T\d\d:\d\d-03:00$/.test(c0.proxima));   // o versao.json do robô traz a corrente
      const slot = INTEL.coletasPrevistas(Date.now(), Date.now() + 2 * 864e5)[0];
      v.corrente = {ativo: true, minutos: 15, proxima: iso(Date.now() + 4 * 60e3)}; const tc = Date.parse(v.corrente.proxima);
      r.prox = APP.proximaColeta() === (slot < tc ? hm(slot) : hm(tc));
      v.corrente = {ativo: true, minutos: 15, proxima: iso(Date.now() - 40 * 60e3)}; r.parou = APP.proximaColeta() === hm(slot);
      v.corrente = c0;
      // aviso de atraso com a corrente: rodada "em andamento" há 40 min (coleta falhou, a etapa seguinte espera) e rodada que falhou
      const g0 = v.gerado_em, u1 = APP.intel.ultimoAviso, fg = window.fetch; APP.intel.ultimoAviso = null; v.gerado_em = new Date(Date.now() - 3 * 3600e3).toISOString();
      window.fetch = (u, o) => /api\.github\.com/.test(String(u)) ? Promise.resolve({ok: true, json: () => Promise.resolve({workflow_runs: window.__gh11})}) : fg(u, o);
      const caso = async runs => { window.__gh11 = runs; APP._ghColeta.t = 0; APP._ghColeta.runs = null; APP.go('hoje'); APP.atrasoColeta(); await z(150); APP.rerender(); await z(150); const a = document.querySelector('#main .aviso-gh'); return a ? [a.textContent, !!a.querySelector('a.btn')] : ['', false]; };
      const ini = new Date(Date.now() - 40 * 60e3).toISOString();
      const dm = await caso([{status: 'in_progress', conclusion: null, created_at: ini, run_started_at: ini}]);
      r.demorando = /passou do tempo normal/.test(dm[0]) && dm[1] && !/está rodando agora/.test(dm[0]);
      const ini2 = new Date(Date.now() - 70 * 60e3).toISOString();
      const fl = await caso([{status: 'completed', conclusion: 'failure', created_at: ini2, run_started_at: ini2}]);
      r.falhou = /a rodada das .* falhou\..*A corrente tenta de novo em até 1 hora/.test(fl[0]) && fl[1];
      const ini3 = new Date(Date.now() - 5 * 60e3).toISOString();
      const rd = await caso([{status: 'in_progress', conclusion: null, created_at: ini3, run_started_at: ini3}]);
      r.rodandoDeVerdade = /está rodando agora/.test(rd[0]) && !rd[1];
      window.fetch = fg; v.gerado_em = g0; APP.intel.ultimoAviso = u1; APP._ghColeta.t = 0; APP._ghColeta.runs = null; APP.rerender(); await z(100);
      document.querySelector('.dstat').click(); await z(80); r.pop = Array.from(document.querySelectorAll('.pop .pop-l')).some(e => /Corrente de rodadas: cada rodada também dispara a seguinte/.test(e.textContent));
      document.body.click(); await z(50); const pp = document.querySelector('.pop'); if (pp) pp.remove();
      // painel novo
      let rec = null; APP._recarregar = b => { rec = b; };
      window.fetch = (u, o) => /painel\.json/.test(String(u)) ? Promise.resolve({ok: true, json: () => Promise.resolve({build: window.__pj})}) : f0(u, o);
      sessionStorage.removeItem('oi-painel-recarga');
      r.build = /^[0-9a-f]{12}$/.test(APP.PAINEL_BUILD || '');
      window.__pj = APP.PAINEL_BUILD; await APP.intelAtualizar(); await z(1500); r.igual = rec === null;
      window.__pj = 'ffffffffffff'; await APP.intelAtualizar(); r.toast = /versão nova do painel/.test((document.querySelector('.toast') || {}).textContent || '');
      await z(1500); r.recarrega = rec === 'ffffffffffff';
      rec = null; APP._painelNovo.faixa = null; await APP._conferirPainel(); const fx = document.querySelector('.painel-novo');
      r.faixa = !!fx && /Recarregar/.test(fx.textContent) && getComputedStyle(fx).position === 'fixed';
      r.sw = document.documentElement.scrollWidth <= innerWidth;
      if (fx) { fx.querySelector('.btn.pri').click(); r.botao = rec === 'ffffffffffff'; fx.querySelector('[aria-label="Fechar este aviso"]').click(); r.fecha = !document.querySelector('.painel-novo'); }
      // o arquivo publicado pelo site de teste é o mesmo do painel aberto
      window.fetch = f0; r.publicado = (await APP.lerPainelPublicado()) === APP.PAINEL_BUILD;
      APP._recarregar = rc0; APP._painelNovo.faixa = null; APP.intel.ultimoAviso = u0; APP.rerender(); await z(100);
      return r; });
    rep(Object.values(c11).every(v => v === true), vw + ' corrente de rodadas (próxima coleta e detalhe) e painel novo: o Atualizar recarrega, a faixa oferece Recarregar (' + JSON.stringify(c11) + ')');
    await p.emulateMedia({media: 'print'});
    const pr7 = await p.evaluate(async () => { const z = ms => new Promise(r => setTimeout(r, ms)); APP.go('cart', 'comite'); await z(400);
      return {top: getComputedStyle(document.querySelector('.top')).display, sug: getComputedStyle(document.querySelector('.cm-g > .no-print')).display, imp: Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'Imprimir')}; });
    await p.emulateMedia({media: 'screen'});
    rep(pr7.top === 'none' && pr7.sug === 'none' && pr7.imp, vw + ' comitê: botão Imprimir e folha limpa na impressão (' + JSON.stringify(pr7) + ')');
    // v4.0 · visual novo: moldura (menu lateral no computador), "O dia até agora", tipos por extenso, nada sumiu, e a volta ao visual antigo
    const v40 = await p.evaluate(async () => {
      const z = ms => new Promise(r => setTimeout(r, ms)), r = {}, de = document.documentElement, larg = innerWidth >= 1024;
      const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
      APP.go('hoje'); await z(400);
      r.padrao = de.classList.contains('v4');
      // v4.0.1 · "Assuntos do momento" no lugar das barras por hora
      const linhas = Array.from(document.querySelectorAll('.v4-ass .v4-as-r'));
      r.assuntos = linhas.length === INTEL.assuntosDefs().length && linhas.length >= 10 && !!document.querySelector('.v4-ass .v4-as-seg') && !document.querySelector('.v4-bars');
      const comN = linhas.find(b => +b.querySelector('.v4-as-n').textContent > 0) || linhas[0]; const nomeA = comN.querySelector('.v4-as-nm').textContent;
      comN.click(); await z(250);
      const det = document.querySelector('.v4-as-det');
      r.abreNoticias = !!det && det.querySelector('h3').textContent === nomeA && (det.querySelectorAll('[data-id]').length > 0 || det.querySelectorAll('.v4-as-ult li').length > 0 || !!det.querySelector('.v4-as-vz')) && /Palavras procuradas/.test(det.textContent);
      const pc = (t, defs) => INTEL.assuntosDe(t, INTEL.compilarAssuntos(defs || INTEL.assuntosDefs()));
      r.palavras = pc('Petróleo cai após Trump sinalizar moderação em relação ao Irã').join() === 'petroleo,guerra' && pc('Petrobras irá pagar dividendos').length === 0 && pc('IA generativa e a China').join() === 'china,ia' && pc('ia ficar para depois').length === 0
        && pc('Chinesa compra soja do Brasil').join() === 'china,agro' && INTEL.parseBusca('assunto:petroleo').assunto[0] === 'petroleo';
      // filtro do Hoje pelo assunto e "Limpar"
      det.querySelector('.v4-as-bf').click(); await z(400);
      const fx = document.querySelector('.v4-filtro');
      r.filtra = !!fx && fx.textContent.indexOf(nomeA) >= 0 && !!document.querySelector('.sumario .v4-sf') && APP.v4Filtro().nome === nomeA
        && Array.from(document.querySelectorAll('#ultimas [data-id], #radar [data-id]')).every(el => { const x = APP.itemPorId(el.getAttribute('data-id')); return !x || INTEL.assuntosDe(x.titulo).indexOf(APP.v4Filtro().id) >= 0; });
      Array.from(fx.querySelectorAll('button')).find(b => /Limpar/.test(b.textContent)).click(); await z(400);
      r.limpa = !document.querySelector('.v4-filtro') && !APP.v4Filtro() && !!document.getElementById('radar');
      // ativo do mapa filtra o Hoje; a ficha fica na faixa
      const tile = document.querySelector('#atencao .atn-t');
      if (tile) { const tk = tile.querySelector('b').textContent; tile.click(); await z(400); const f2 = document.querySelector('.v4-filtro');
        r.mapaFiltra = !!f2 && APP.v4Filtro().t === tk && !document.querySelector('.drawer') && Array.from(f2.querySelectorAll('button')).some(b => b.textContent === 'Ficha de ' + tk); APP.v4Filtrar(null); await z(300); }
      // títulos, linha do que tem, contagem no "Nesta página", modo de leitura
      r.titulos = parseFloat(getComputedStyle(document.querySelector('#radar > header h2')).fontSize) >= (larg ? 23 : 19) && !!document.querySelector('#radar > header .v4-desc') && !!document.querySelector('#debate > header .v4-desc');
      r.contagem = document.querySelectorAll('nav.sumario .v4-sn').length >= 3 && !!document.querySelector('.mesa-h .v4-prof-d');
      // ETFs de renda fixa do Brasil: juros, inflação e fiscal na coluna de notícias (ações não mudam)
      const rf = APP.noticiasPainel('5PRE11'), ac = APP.noticiasPainel('PETR4');
      r.etfRendaFixa = !!rf.querySelector('.np-rf') && /Juros, inflação e fiscal no Brasil/.test(rf.textContent) && !ac.querySelector('.np-rf') && APP.v4RendaFixaBR('IRFM11') && !APP.v4RendaFixaBR('PETR4');
      // busca: assuntos, ativos e últimas buscas
      APP.busca(); await z(150);
      const ck = document.querySelector('.cmdk .v4-ck'); r.busca = !!ck && ck.querySelectorAll('button').length >= 3;
      const inp = document.querySelector('.cmdk input'); inp.value = 'copom'; inp.dispatchEvent(new Event('input')); await z(50);
      r.buscaEsconde = ck.hidden === true; inp.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); await z(50); const bgx = document.querySelector('.cmdk-bg'); if (bgx) bgx.remove();
      const ids = ['atencao', 'mercado-hoje', 'radar', 'agenda-decisiva', 'research', 'debate', 'ultimas', 'alertas', 'fila'];
      APP.go('hoje'); await z(300);
      r.nadaSumiu = ids.every(i => !!document.getElementById(i)) && !!document.querySelector('.desde') && !!document.querySelector('nav.sumario') && document.querySelectorAll('.prof [role=radio]').length === 3 && !!document.querySelector('.v4-dia .fxd');
      const pal = Array.from(document.querySelectorAll('#ultimas .mt.v4mt')).map(m => m.getAttribute('data-w'));
      r.tipos = pal.length > 5 && pal.every(w => /^(Notícia|Resultado|Opinião|Carta|Estudo|Documento à CVM|Fato relevante|Comunicado|[A-ZÀ-Ú].+)$/.test(w)) && pal.some(w => w === 'Notícia');
      r.marca = /^oreg.?n$/.test(document.querySelector('.top .brand b').textContent) && !!document.querySelector('.top .brand .v4-o');
      if (larg) {
        r.lateral = getComputedStyle(document.querySelector('.ov')).display === 'grid' && document.querySelector('.top').getBoundingClientRect().width === 252;
        APP.go('brasil', 'ativos'); await z(400);
        const sb = Array.from(document.querySelectorAll('.v4-subs button')); r.subs = vis(document.querySelector('.v4-subs')) && sb.length === APP.SUBS.brasil.length && sb[0].getAttribute('aria-current') === 'page';
        sb[1].click(); await z(400); r.subsVai = APP.S.sub.brasil === APP.SUBS.brasil[1][0] && document.querySelectorAll('.v4-subs button')[1].getAttribute('aria-current') === 'page';
        r.coleta = vis(document.querySelector('.v4-col')) && /^(\d\d:\d\d|\dh\d\d|···|··)$/.test(document.querySelector('.v4-ring text').textContent) && !!document.querySelector('.v4-col-b a[href*="actions/workflows/robo.yml"]');
        r.volta = vis(document.querySelector('.v4-volta'));
        document.querySelector('.dstat').click(); await z(80); const pp = document.querySelector('body > .pop'), pr = pp && pp.getBoundingClientRect();
        r.detalheColeta = !!pp && pr.left >= 252 && pr.top >= 0 && pr.bottom <= innerHeight + 1; document.body.click(); await z(50); const p2 = document.querySelector('body > .pop'); if (p2) p2.remove();
      } else {
        r.semLateral = !vis(document.querySelector('.v4-subs')) && !vis(document.querySelector('.v4-col')) && vis(document.querySelector('#nav'));
        r.rodape = vis(document.querySelector('.v4-rod button'));
      }
      let sw = true; for (const a of ['hoje', 'brasil', 'mundo', 'cart', 'bib', 'vip']) { APP.go(a); await z(350); if (de.scrollWidth > innerWidth) sw = a; } r.semRolagemLateral = sw;
      APP.go('hoje'); await z(300);
      APP.setVisual('antigo'); await z(400);
      r.antigo = !de.classList.contains('v4') && document.querySelectorAll('.mesa > .mesa-col').length === 2 && !document.querySelector('.v4-dia') && document.querySelector('.top .brand b').textContent === 'Oregon' && !!document.querySelector('.fxd-slot .fxd')
        && (larg ? vis(document.querySelector('.v4-ir')) : true) && vis(document.querySelector('.v4-rod button')) && /Usar o visual novo/.test(document.querySelector('.v4-rod button').textContent) && APP.lsGet('visual') === 'antigo';
      const tp = Array.from(document.querySelectorAll('#ultimas .mt')); r.antigoLetras = tp.length > 5 && tp.every(m => !m.classList.contains('v4mt'));
      document.querySelector('.v4-rod button').click(); await z(400);
      r.novoDeVolta = de.classList.contains('v4') && !!document.querySelector('.v4-dia') && APP.lsGet('visual') === 'novo';
      const t = document.querySelector('.toast'); if (t) t.remove();
      return r; });
    rep(Object.values(v40).every(v => v === true), vw + ' visual novo: moldura, assuntos do momento (abre as notícias, filtra o Hoje), mapa filtra, títulos e contagens, busca com atalhos, tipos por extenso, nada sumiu, sem rolagem lateral e volta ao antigo (' + JSON.stringify(v40) + ')');
    // v4.1 · melhorias visuais (propostas 3 a 14): Brasil com "O que o mercado está falando", ficha, tabelas, Mundo, cores, carregamento
    const v41 = await p.evaluate(async () => {
      const z = ms => new Promise(r => setTimeout(r, ms)), r = {}, larg = innerWidth >= 1024;
      APP.go('hoje'); await z(400);
      r.esqueleto = APP.v4Esqueleto().classList.contains('v4-sk');
      r.radarGrade = !document.querySelector('#radar .nr-day') || !!document.querySelector('#radar .nrl.v4-grade .v4-dd');
      r.temporada = !document.querySelector('#agenda-decisiva .tmp') || (!!document.querySelector('.v4-tmp-bar') && document.querySelectorAll('.v4-tmp-g').length === 2);
      r.barraOpinioes = !document.querySelector('#debate .deb-h .pol') || !!document.querySelector('#debate .v4-op-bar');
      if (!larg) r.numerosLadoALado = getComputedStyle(document.querySelector('.v4-dia .v4-st')).display === 'grid';
      APP.go('brasil', 'ativos'); await z(700);
      const mf = document.querySelector('.v4-mf'); const lin = mf ? mf.querySelectorAll('.v4-as-r') : [];
      r.mercadoFala = !!mf && lin.length >= 1 && /Empresas mais citadas/.test(mf.textContent) && /Macro do Brasil/.test(mf.textContent);
      if (lin.length) { lin[0].click(); await z(300); r.abreEmpresa = !!document.querySelector('.v4-mf .v4-as-det'); document.querySelector('.v4-mf .v4-as-x').click(); await z(200); }
      const tr = Array.from(document.querySelectorAll('.lista-at tbody tr')).find(x => /PETR4/.test(x.textContent)); if (tr) { tr.click(); await z(500); }
      r.cabecalho = !!document.querySelector('.ficha-head .v4-mono') && document.querySelectorAll('.ficha-head .v4-cc').length >= 2 && document.querySelectorAll('.ficha-head .v4-pesos .v4-pc').length >= 1;
      r.indiceNoticias = document.querySelectorAll('.ficha-news .v4-np-idx button').length >= 2;
      const tw = document.querySelector('.lista-at .tw'); r.listaSemCorte = !larg || !tw || tw.scrollWidth <= tw.clientWidth + 2;
      APP.go('brasil', 'fluxo'); await z(600);
      r.tabelas = document.querySelectorAll('table.t td.v4-sg').length > 0;
      APP.go('mundo', 'agora'); await z(600);
      r.mundoRegioes = !document.querySelector('#mundo-ultimas .sub.filt') || !!document.querySelector('.v4-mw .v4-rg .v4-rg-r');
      APP.go('cart', 'ref'); await z(500);
      r.cores = APP.PC.P1 === '#A8D8D3' && APP.CC['Ações Brasil'] === '#1C3548';
      APP.setVisual('antigo'); await z(300); r.coresAntigas = APP.PC.P1 === '#8DB8FA' && APP.CC['Ações Brasil'] === '#1D8C0F' && !document.querySelector('.v4-mf');
      APP.setVisual('novo'); await z(300); const t = document.querySelector('.toast'); if (t) t.remove();
      r.sw = document.documentElement.scrollWidth <= innerWidth;
      APP.go('hoje'); await z(200);
      return r; });
    rep(Object.values(v41).every(v => v === true), vw + ' v4.1: mercado falando em Brasil, cabeçalho e índice da ficha, lista sem corte, tabelas, Mundo, radar, temporada, opiniões, cores e carregamento (' + JSON.stringify(v41) + ')');
    // v4.2 · Pautas da semana, do mês e do ano: item no menu, Oregon e VIP separadas, períodos, ano com Focus e fatos relevantes, copiar
    const v42 = await p.evaluate(async () => {
      const z = ms => new Promise(r => setTimeout(r, ms)), r = {}, P = APP.v42Pautas ? APP.v42Pautas() : null;
      const bt = document.querySelector('.nav button[data-a="pautas"]');
      r.menu = !!bt && bt.previousElementSibling && bt.previousElementSibling.dataset.a === 'hoje';
      if (!bt || !P) return r;
      bt.click(); for (let i = 0; i < 30 && !P.js; i++) await z(200); await z(300);
      r.carregou = !!P.js && !!document.querySelector('.v4-pt .v4-pt-tiles');
      const emps = () => Array.from(document.querySelectorAll('.v4-pt-emp .v4-pt-tk')).map(b => b.textContent);
      r.oregonSemVip = emps().indexOf('VALE3') < 0 && emps().indexOf('PETR4') >= 0;
      r.macro = /Macro do Brasil/.test(document.querySelector('#main').textContent);
      Array.from(document.querySelectorAll('.v4-pt-seg button')).find(b => b.textContent === 'VG VIP').click(); await z(300);
      r.vip = emps().indexOf('VALE3') >= 0 && !/Alocação de ativos/.test(document.querySelector('#main').textContent);
      Array.from(document.querySelectorAll('.v4-pt-seg button')).find(b => b.textContent === 'Mês').click(); await z(300);
      r.mes = document.querySelectorAll('.v4-pt-meses button').length >= 2 && !!document.querySelector('.v4-pt-tiles');
      Array.from(document.querySelectorAll('.v4-pt-seg button')).find(b => b.textContent === 'Carteira Oregon').click(); await z(200);
      Array.from(document.querySelectorAll('.v4-pt-seg button')).find(b => b.textContent === 'Ano').click(); await z(800);
      const txt = document.querySelector('#main').textContent;
      r.ano = /Como o ano começou/.test(txt) && /O que o mercado esperava em janeiro/.test(txt) && document.querySelectorAll('.v4-pt-ic').length >= 4 && document.querySelectorAll('.v4-pt-ano').length >= 5;
      r.mesAMes = document.querySelectorAll('.v4-pt-mm-c').length >= 2;
      const ab = Array.from(document.querySelectorAll('.v4-pt-ano')).find(a => /PETR4/.test(a.textContent)); ab.querySelector('.v4-pt-abre').click(); await z(300);
      r.fatosDoAno = /Fatos relevantes do ano/.test(document.querySelector('.v4-pt-ano.aberto').textContent);
      r.texto = /pauta do ano/.test(APP.v42Texto()) && !/InfoMoney/.test(APP.v42Texto());
      P.per = 'semana'; APP.rerender(); await z(200);
      r.textoSemana = /pauta da semana/.test(APP.v42Texto()) && !/InfoMoney/.test(APP.v42Texto());
      r.sw = document.documentElement.scrollWidth <= innerWidth;
      APP.go('hoje'); await z(200);
      return r; });
    rep(Object.values(v42).every(v => v === true), vw + ' v4.2: Pautas no menu, Oregon e VIP separadas, semana, mês e ano (Focus, mês a mês, fatos relevantes), texto para copiar sem Grupo XP (' + JSON.stringify(v42) + ')');
    if (errs.length) rep(false, 'erros de JavaScript: ' + errs.join(' | '));
    await p.close();
  }
  console.log(falhas ? falhas + ' falha(s)' : 'tudo ok'); await b.close(); process.exit(falhas ? 1 : 0);
})();
