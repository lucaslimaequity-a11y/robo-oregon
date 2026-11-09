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
let f = 0; for (const r of res) { console.log((r.ok ? 'PASS ' : 'FAIL ') + r.nome + (r.det ? ' · ' + r.det : '')); if (!r.ok) f++; }
const q = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'quant.test.js')], {encoding: 'utf8'});
process.stdout.write(q.stdout); if (q.status !== 0) f++;
console.log(`\n${res.length - f} de ${res.length} testes do painel passaram` + (q.status === 0 ? '; modelos quantitativos ok' : '; FALHA nos modelos quantitativos'));
process.exit(f ? 1 : 0);
