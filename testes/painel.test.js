// Testes do painel (Oregon Intelligence) no Node, sem navegador: validação das carteiras, modelos quantitativos,
// camada de conteúdo (busca, filtros, aprendizados) e teses. Rodar na pasta do repositório:
//   node testes/painel.test.js
const path = require('path');
const S = path.join(__dirname, '..', 'painel', 'src');
const C = require(path.join(S, 'core.js')), Q = require(path.join(S, 'quant.js')), T = require(path.join(S, 'tests.js')), D = require(path.join(S, 'data.json'));
// como no build: as fichas dos ETFs entram em DATA.etfs
const E = require(path.join(S, 'etfs.json')); D.etfs = {}; Object.keys(E).forEach(k => { if (!k.startsWith('_')) D.etfs[k] = E[k]; });
global.STORE = require(path.join(S, 'store.js'));
global.TAXON = (function () { const { execFileSync } = require('child_process'); return JSON.parse(execFileSync('python3', ['-c', 'import sys,json; sys.path.insert(0, sys.argv[1]); import analise; print(json.dumps({"temas": analise.TEMA_NOME, "regioes": analise.REGIAO_NOME, "fatores": analise.FATOR_NOME, "tipos": analise.TIPO_NOME, "roteiro": analise.ROTEIRO, "vinculo": analise.VINCULO}))', path.join(__dirname, '..', 'robo')], {encoding: 'utf8'})); })();
global.INTEL = require(path.join(S, 'intel.js'));
// notícias reais já capturadas (testes/amostras_reais): o painel e o robô precisam classificar o vínculo igual
global.AMOSTRAS_LEITURA = require(path.join(__dirname, 'amostras_reais', 'leitura_vinculos_2026-11-08.json'));
const res = T.run(C, Q, D, null);
// v3.6 · todo arquivo que entra no site precisa ao menos compilar (um erro de sintaxe derruba o painel inteiro)
const fs = require('fs');
for (const arq of fs.readdirSync(S).filter(n => /\.js$/.test(n))) {
  try { new Function(fs.readFileSync(path.join(S, arq), 'utf8')); res.push({ok: true, nome: 'sintaxe de ' + arq}); }
  catch (e) { res.push({ok: false, nome: 'sintaxe de ' + arq, det: String(e.message)}); }
}
// v3.9.1 · a agenda que o painel mostra (ui_v391.js) bate com os horários do robo.yml (UTC → Brasília, UTC−3)
(function () {
  const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'robo.yml'), 'utf8');
  const lista = c => [].concat(...c.split(',').map(p => { const r = p.split('-').map(Number); return r.length === 2 ? Array.from({length: r[1] - r[0] + 1}, (_, i) => r[0] + i) : [r[0]]; }));
  const esperado = new Set();
  for (const m of wf.matchAll(/cron: '([^']+)'/g)) { const [mi, ho] = m[1].split(' '); for (const hh of lista(ho)) for (const mm of lista(mi)) esperado.add(((hh + 21) % 24) * 60 + mm); }
  const src = fs.readFileSync(path.join(S, 'ui_v391.js'), 'utf8'), bloco = src.slice(src.indexOf('var SL = '), src.indexOf('A.SLOTS_COLETA'));
  const SL = new Function(bloco + '; return SL;')();
  const iguais = SL.length === esperado.size && SL.every(x => esperado.has(x));
  res.push({ok: iguais, nome: 'agenda do painel = horários do robo.yml (' + SL.length + ' por dia)', det: iguais ? '' : 'painel ' + JSON.stringify(SL) + ' · robo.yml ' + JSON.stringify([...esperado].sort((a, b) => a - b))});
})();
// v3.11 · corrente de rodadas e painel novo (ui_v311.js): as regras puras, sem navegador
(function () {
  const A = {h: () => null, proximaColeta: () => '14:37', intelAtualizar: async () => 'ok'}, I = {coletasPrevistas: () => [Date.parse('2026-11-09T14:37:00-03:00')]};
  new Function('APP', 'CORE', 'INTEL', fs.readFileSync(path.join(S, 'ui_v311.js'), 'utf8'))(A, {}, I);
  const agora = Date.parse('2026-11-09T14:33:00-03:00'), vc = p => ({corrente: {ativo: true, minutos: 15, proxima: p}});
  const ok = {
    proxima: I.proximaCorrente(vc('2026-11-09T14:45-03:00'), agora) === Date.parse('2026-11-09T14:45-03:00'),
    parou: I.proximaCorrente(vc('2026-11-09T14:05-03:00'), agora) === null,
    rodandoAgora: I.proximaCorrente(vc('2026-11-09T14:25-03:00'), agora) === Date.parse('2026-11-09T14:25-03:00'),
    desligada: I.proximaCorrente({corrente: {ativo: false}}, agora) === null && I.proximaCorrente({}, agora) === null && I.proximaCorrente(null, agora) === null,
    mesmo: I.painelNovo('aaa', 'aaa', null, agora) === null,
    novo: I.painelNovo('aaa', 'bbb', null, agora) === 'recarregar',
    acabouDeTentar: I.painelNovo('aaa', 'bbb', {b: 'bbb', t: agora - 60e3, n: 1}, agora) === 'aguardar',
    tentaDeNovo: I.painelNovo('aaa', 'bbb', {b: 'bbb', t: agora - 6 * 60e3, n: 1}, agora) === 'recarregar',
    terceira: I.painelNovo('aaa', 'bbb', {b: 'bbb', t: agora - 20 * 60e3, n: 3}, agora) === 'aguardar' && I.painelNovo('aaa', 'bbb', {b: 'bbb', t: agora - 31 * 60e3, n: 3}, agora) === 'recarregar',
    outraVersao: I.painelNovo('aaa', 'ccc', {b: 'bbb', t: agora - 60e3, n: 1}, agora) === 'recarregar',
    semResposta: I.painelNovo('aaa', null, null, agora) === null && I.painelNovo(null, 'bbb', null, agora) === null,
    outrosParametros: JSON.stringify(I.semV('?simulado&v=abc.2')) === '["simulado"]' && JSON.stringify(I.semV('')) === '[]'};
  const tudo = Object.values(ok).every(Boolean);
  res.push({ok: tudo, nome: 'v3.11: próxima coleta pela corrente e quando recarregar o painel novo', det: tudo ? '' : JSON.stringify(ok)});
})();
let f = 0; for (const r of res) { console.log((r.ok ? 'PASS ' : 'FAIL ') + r.nome + (r.det ? ' · ' + r.det : '')); if (!r.ok) f++; }
const q = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'quant.test.js')], {encoding: 'utf8'});
process.stdout.write(q.stdout); if (q.status !== 0) f++;
console.log(`\n${res.length - f} de ${res.length} testes do painel passaram` + (q.status === 0 ? '; modelos quantitativos ok' : '; FALHA nos modelos quantitativos'));
process.exit(f ? 1 : 0);
