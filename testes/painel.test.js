// Testes do painel (Oregon Intelligence) no Node, sem navegador: validação das carteiras, modelos quantitativos,
// camada de conteúdo (busca, filtros, aprendizados) e teses. Rodar na pasta do repositório:
//   node testes/painel.test.js
const path = require('path');
const S = path.join(__dirname, '..', 'painel', 'src');
const C = require(path.join(S, 'core.js')), Q = require(path.join(S, 'quant.js')), T = require(path.join(S, 'tests.js')), D = require(path.join(S, 'data.json'));
// como no build: as fichas dos ETFs entram em DATA.etfs
const E = require(path.join(S, 'etfs.json')); D.etfs = {}; Object.keys(E).forEach(k => { if (!k.startsWith('_')) D.etfs[k] = E[k]; });
global.STORE = require(path.join(S, 'store.js'));
global.TAXON = (function () { const { execFileSync } = require('child_process'); return JSON.parse(execFileSync('python3', ['-c', 'import sys,json; sys.path.insert(0, sys.argv[1]); import analise; print(json.dumps({"temas": analise.TEMA_NOME, "regioes": analise.REGIAO_NOME, "fatores": analise.FATOR_NOME, "tipos": analise.TIPO_NOME}))', path.join(__dirname, '..', 'robo')], {encoding: 'utf8'})); })();
global.INTEL = require(path.join(S, 'intel.js'));
const res = T.run(C, Q, D, null);
let f = 0; for (const r of res) { console.log((r.ok ? 'PASS ' : 'FAIL ') + r.nome + (r.det ? ' · ' + r.det : '')); if (!r.ok) f++; }
const q = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'quant.test.js')], {encoding: 'utf8'});
process.stdout.write(q.stdout); if (q.status !== 0) f++;
console.log(`\n${res.length - f} de ${res.length} testes do painel passaram` + (q.status === 0 ? '; modelos quantitativos ok' : '; FALHA nos modelos quantitativos'));
process.exit(f ? 1 : 0);
