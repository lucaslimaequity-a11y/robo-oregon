/* INTEL — camada de dados do Oregon Intelligence e vistas compartilhadas de conteúdo.
   Lê os arquivos públicos gerados pelo robô (data/): versao.json (pequeno, consultado a cada 10 min), macro.json,
   recentes.json, hoje.json, coleta.json, semanal.json, fontes.json, resultados.json e biblioteca/AAAA-MM.json (sob demanda).
   Nada é inventado: arquivo que falta aparece como falta; nenhum número é estimado. Nenhuma chave existe aqui. */
var INTEL = (function () {
  'use strict';
  var I = {};
  var TX = (typeof TAXON !== 'undefined') ? TAXON : {temas: {}, regioes: {}, fatores: {}, tipos: {}};
  I.TX = TX;
  I.temaNome = function (t) { return TX.temas[t] || t; };
  I.regiaoNome = function (r) { return TX.regioes[r] || r; };
  I.fatorNome = function (k) { return TX.fatores[k] || k; };
  I.tipoNome = function (t) { return TX.tipos[t] || t || 'Conteúdo'; };
  I.CATEGORIA = {gestora_internacional: 'Gestora internacional', gestora_brasil: 'Gestora brasileira', instituicao: 'Instituição', academia: 'Academia', oficial_empresa: 'Empresa (oficial)', youtube: 'Canal oficial', veiculo: 'Imprensa'};
  I.ROTULO = {FATO: 'Fato', FONTE: 'Opinião da fonte', 'INFERÊNCIA': 'Inferência do sistema'};
  I.PONTOS = [['1_publicacao', 'O que foi publicado e quem é a fonte'], ['2_tese', 'Tese ou informação central'], ['3_evidencias', 'Evidências'], ['4_contrarios', 'Argumentos contrários'],
    ['5_regioes', 'O que pode representar para Brasil, EUA e outras regiões'], ['6_oregon', 'Ativos, setores e fatores da Oregon'], ['7_monitorar', 'O que acompanhar para validar ou invalidar']];

  // Data usada para ordenar: a de publicação; sem ela, a de detecção; o acervo (o que já estava nas páginas na primeira
  // leitura) usa o mês de referência do documento ou vai para o fim — nunca aparece como novidade de hoje.
  function pub(x) {
    if (!x) return '';
    if (x.publicado_em) return x.publicado_em;
    if (x.acervo) return x.referencia ? x.referencia + '-01T00:00' : '0000';
    return x.detectado_em || '';
  }
  I.pub = pub;
  var MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function hm(iso) { var m = String(iso || '').match(/T(\d{2}):(\d{2})/); return m ? m[1] + ':' + m[2] : ''; }
  function dm(iso) { var m = String(iso || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? m[2] + '/' + m[1] : ''; }
  // Quando foi publicado, dito como as pessoas dizem: "há 12 min", "há 3 h", "ontem 18:40", "06/11 14:35".
  // Item sem data diz "detectado em"; acervo diz o mês de referência. agora: Date (para testes).
  I.quando = function (x, agora) {
    if (!x) return '';
    if (!x.publicado_em) {
      if (x.acervo) return x.referencia ? 'acervo · ref. ' + MES[+x.referencia.slice(5, 7) - 1] + '/' + x.referencia.slice(0, 4) : 'acervo · sem data';
      return x.detectado_em ? 'detectado ' + dm(x.detectado_em) + ' ' + hm(x.detectado_em) + (x.referencia ? ' · ref. ' + MES[+x.referencia.slice(5, 7) - 1] + '/' + x.referencia.slice(0, 4) : '') : 'sem data';
    }
    var soData = x.publicado_em.length <= 10, t = Date.parse(x.publicado_em), n = (agora || new Date()).getTime(), min = Math.round((n - t) / 60000);
    if (soData) { var hj = I.hojeBRT(agora || new Date()), dd = x.publicado_em.slice(0, 10); return dd === hj ? 'hoje' : dd === I.menosDias(hj, 1) ? 'ontem' : dm(dd) + (dd.slice(0, 4) !== hj.slice(0, 4) ? '/' + dd.slice(0, 4) : ''); }
    if (isFinite(min) && min >= 0 && min < 60) return 'há ' + Math.max(1, min) + ' min';
    if (isFinite(min) && min >= 60 && min < 12 * 60) return 'há ' + Math.round(min / 60) + ' h';
    var hoje = I.hojeBRT(agora || new Date()), d = x.publicado_em.slice(0, 10);
    if (d === hoje) return 'hoje ' + hm(x.publicado_em);
    if (d === I.menosDias(hoje, 1)) return 'ontem ' + hm(x.publicado_em);
    return dm(x.publicado_em) + (d.slice(0, 4) !== hoje.slice(0, 4) ? '/' + d.slice(0, 4) : '') + ' ' + hm(x.publicado_em);
  };
  // Hora da linha de notícia (a data fica no separador do dia): publicação com hora → "10:20"; só com data → "—";
  // sem data de publicação → "≈10:17", hora em que o robô detectou (marcada como estimada).
  I.hora = function (x) {
    var p = x && x.publicado_em;
    if (p && p.length > 10) return {txt: hm(p), dia: p.slice(0, 10), sem: false, tip: 'Publicado ' + dm(p) + ' ' + hm(p)};
    if (p) return {txt: '—', dia: p.slice(0, 10), sem: true, tip: 'A fonte informa só a data de publicação (' + dm(p) + ')'};
    if (x && x.detectado_em) return {txt: '≈' + hm(x.detectado_em), dia: x.detectado_em.slice(0, 10), sem: true, est: true, tip: 'Sem data de publicação na fonte: hora em que o robô detectou'};
    return {txt: '—', dia: '', sem: true, tip: 'Sem data'};
  };
  // Hora absoluta curta: "10:17" (hoje), "ontem 22:30", "06/11 14:35"
  I.horaAbs = function (iso, agora) {
    if (!iso) return '';
    var hj = I.hojeBRT(agora || new Date()), d = String(iso).slice(0, 10), t = hm(iso);
    if (!t) return dm(iso);
    return d === hj ? t : d === I.menosDias(hj, 1) ? 'ontem ' + t : dm(iso) + ' ' + t;
  };
  // Separador de dia nas listas de notícias: "Hoje · dom 08/11", "Ontem · sáb 07/11", "sex 06/11"
  I.rotuloDia = function (d, agora) {
    if (!d) return 'Sem data';
    var hj = I.hojeBRT(agora || new Date()), w = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(d + 'T12:00:00Z').getUTCDay()];
    return (d === hj ? 'Hoje · ' : d === I.menosDias(hj, 1) ? 'Ontem · ' : '') + w + ' ' + dm(d) + (d.slice(0, 4) !== hj.slice(0, 4) ? '/' + d.slice(0, 4) : '');
  };
  // Destaques: as n mais relevantes pela prioridade do robô (cita ativo da carteira, fonte primária, recência, várias fontes),
  // sem sensacionalismo nem conteúdo promocional na frente; exibidas da mais nova para a mais antiga.
  I.destaques = function (lista, n) {
    var pen = {sensacionalista: 30, promocional: 30, recomendacao: 20};
    var sc = function (x) { return I.relevancia(x) + 3 * Math.min(2, (x.tambem_em || []).length) - (pen[x.natureza] || 0); };
    return lista.slice().sort(function (a, b) { return (sc(b) - sc(a)) || pub(b).localeCompare(pub(a)); }).slice(0, n || 5)
      .sort(function (a, b) { return pub(b).localeCompare(pub(a)); });
  };
  // Últimas notícias: só itens com data de publicação nas últimas `horas`, mais recentes primeiro (imprensa e documentos oficiais).
  // filtro: 'carteira' (vínculo direto com ativo das carteiras; menção de passagem não conta), 'brasil', 'mundo', 'casas' (opinião de casa de análise), 'oficial' (CVM e
  // instituições), 'ri' (só documentos das companhias à CVM), 'gestoras' (cartas e research de gestoras + opiniões de casas).
  I.ultimas = function (itens, opt) {
    opt = opt || {};
    var agora = (opt.agora || new Date()).getTime(), lim = (opt.horas || 48) * 3600 * 1000, f = opt.filtro || 'tudo';
    return itens.filter(function (x) {
      if (!x.publicado_em || x.acervo || x.agrupado_em) return false;
      if (f === 'gestoras' && /^gestora_/.test(x.categoria || '')) { /* cartas e research entram neste filtro */ }
      else if (opt.so_noticias !== false && !(x.categoria === 'veiculo' || x.categoria === 'instituicao' || x.categoria === 'oficial_empresa')) return false;
      if (x.via && x.confiavel === false && !opt.todosVeiculos) return false;
      if (x.categoria === 'veiculo' && !opt.todosVeiculos && !((x.temas || []).length || (x.ativos || []).length || (x.etfs_tema || []).length || (x.setor_de || []).length || (x.macro_br || []).length)) return false;
      var t = Date.parse(x.publicado_em.length <= 10 ? x.publicado_em + 'T12:00:00-03:00' : x.publicado_em); if (!isFinite(t) || agora - t > lim || t - agora > 6 * 3600 * 1000) return false;
      if (f === 'carteira') return I.diretos(x).length > 0;
      if (f === 'macro') return (x.macro_br || []).length > 0;  // v3.10 · macro do Brasil
      if (f === 'brasil') return (x.regioes || []).indexOf('brasil') >= 0 || x.pais === 'Brasil';
      if (f === 'mundo') return x.pais !== 'Brasil' || (x.regioes || []).some(function (r) { return r !== 'brasil'; }) && (x.regioes || []).indexOf('brasil') < 0;
      if (f === 'casas') return x.natureza === 'opiniao_casa';
      if (f === 'gestoras') return x.natureza === 'opiniao_casa' || /^gestora_/.test(x.categoria || '');
      if (f === 'ri') return x.categoria === 'oficial_empresa';
      if (f === 'oficial') return x.categoria === 'oficial_empresa' || x.categoria === 'instituicao';
      return true;
    }).sort(function (a, b) { return b.publicado_em.localeCompare(a.publicado_em); });
  };
  // Vínculo do item com o ativo t — a mesma regra do robô (robo/analise.py: vinculo), cujas expressões chegam em TAXON.vinculo.
  // Itens novos já trazem x.vinculos; os coletados por versões anteriores são classificados aqui, só com o termo guardado.
  // direto = o ativo é assunto da manchete (ou documento da companhia); mencao = citado de passagem (lista, destaques, só no resumo).
  var VR = TX.vinculo || null, VRX = null;
  function vr() { if (!VRX && VR) VRX = {lista: (VR.lista || []).map(function (p) { return new RegExp(p); }), resultado: new RegExp(VR.resultado), codigo: new RegExp(VR.codigo, 'g')}; return VRX; }
  function casaTermo(tn, termo) {
    var k = norm(termo).replace(/^=/, '').trim(); if (k.length < 3) return false;
    if (k.length <= 6 && /^[a-z0-9]+$/.test(k)) return new RegExp('(^|[^a-z0-9])' + k + '(?![a-z0-9])').test(tn);
    return tn.indexOf(k) >= 0;
  }
  I.vinculo = function (x, t) {
    var v = x && x.vinculos && x.vinculos[t]; if (v) return v;
    if (x.categoria === 'oficial_empresa') return {tipo: 'direto', motivo: 'documento da companhia à CVM', evento: 'oficial'};
    var R = vr(); if (!R) return {tipo: 'direto', motivo: 'a manchete trata do ativo', evento: null};
    var tit = x.titulo || '', tn = ' ' + norm(tit) + ' ', porque = (x.ativos_porque || {})[t];
    if (porque !== 'busca específica do ativo') {
      var termos = (porque ? [porque] : []).concat([t]), raiz = /^([A-Z]{4})\d/.exec(t || '');
      var ok = termos.some(function (k) { return casaTermo(tn, k); }) || (raiz && new RegExp('(^|[^a-z0-9])' + raiz[1].toLowerCase() + '\\d{1,2}(?![a-z0-9])').test(tn));
      if (!ok) return {tipo: 'mencao', motivo: 'citado só no resumo, não na manchete', evento: null};
    }
    var cods = {}; (tit.match(R.codigo) || []).forEach(function (c) { cods[c] = 1; });
    if (Object.keys(cods).length >= 4 || R.lista.some(function (re) { return re.test(tn); })) return {tipo: 'mencao', motivo: 'aparece numa manchete que enumera várias empresas', evento: null};
    if (x.natureza === 'opiniao_casa') return {tipo: 'direto', motivo: 'opinião de casa de análise sobre o ativo', evento: 'recomendacao'};
    if (R.resultado.test(tn)) return {tipo: 'direto', motivo: 'a manchete trata do resultado da empresa', evento: 'resultado'};
    return {tipo: 'direto', motivo: 'a manchete trata do ativo', evento: null};
  };
  I.diretos = function (x) { return (x.ativos || []).filter(function (t) { return I.vinculo(x, t).tipo === 'direto'; }); };
  I.mencoes = function (x) { return (x.ativos || []).filter(function (t) { return I.vinculo(x, t).tipo !== 'direto'; }); };
  // Relevância para ordenar destaques: a prioridade do robô; item antigo que só cita ativo de passagem perde o bônus do ativo
  I.relevancia = function (x) {
    var p = I.pontos(x);
    if (!x.vinculos && (x.ativos || []).length && !I.diretos(x).length) p -= 8;
    return p;
  };
  // Ativos com notícia recente: [{t, n (diretas), m (menções), casas, ultimo, itens}], pela notícia direta mais recente.
  // Só menção de passagem não põe o ativo na lista (fica em .soMencao).
  I.porAtivo = function (itens, opt) {
    opt = opt || {};
    var agora = (opt.agora || new Date()).getTime(), lim = (opt.horas || 72) * 3600 * 1000, m = {}, mm = {};
    itens.forEach(function (x) {
      if (!x.publicado_em || x.acervo || x.agrupado_em) return;
      var t = Date.parse(x.publicado_em.length <= 10 ? x.publicado_em + 'T12:00:00-03:00' : x.publicado_em); if (!isFinite(t) || agora - t > lim) return;
      (x.ativos || []).forEach(function (a) { if (I.vinculo(x, a).tipo === 'direto') (m[a] = m[a] || []).push(x); else (mm[a] = mm[a] || []).push(x); });
    });
    var out = Object.keys(m).map(function (a) { var l = m[a].sort(function (p, q) { return q.publicado_em.localeCompare(p.publicado_em); }); return {t: a, n: l.length, m: (mm[a] || []).length, ultimo: l[0], itens: l, casas: l.filter(function (x) { return x.natureza === 'opiniao_casa'; }).length}; })
      .sort(function (p, q) { return q.ultimo.publicado_em.localeCompare(p.ultimo.publicado_em); });
    out.soMencao = Object.keys(mm).filter(function (a) { return !m[a]; }).sort().map(function (a) { return {t: a, m: mm[a].length}; });
    return out;
  };
  // Conteúdo de um ativo, separado pelo vínculo: direto (cita o ativo como assunto), mencoes (de passagem), tema (setor ou
  // índice do ETF, sem citar o ativo; x._v = 'setorial' | 'tematico'). Opiniões e documentos da CVM vêm só dos diretos.
  I.doAtivo = function (itens, t) {
    var direto = [], mencoes = [], tema = [], vis = {};
    itens.forEach(function (x) {
      if (x.acervo || x.agrupado_em || vis[x.id]) return; vis[x.id] = 1;
      if ((x.ativos || []).indexOf(t) >= 0) (I.vinculo(x, t).tipo === 'direto' ? direto : mencoes).push(x);
      else if ((x.etfs_tema || []).indexOf(t) >= 0) tema.push(x);
      else if ((x.setor_de || []).indexOf(t) >= 0) tema.push(x);
    });
    var o = function (a, b) { return pub(b).localeCompare(pub(a)); };
    direto.sort(o); mencoes.sort(o); tema.sort(o);
    var op = direto.filter(function (x) { return x.natureza === 'opiniao_casa'; });
    return {direto: direto, mencoes: mencoes, tema: tema, oficiais: direto.filter(function (x) { return x.categoria === 'oficial_empresa'; }),
      noticias: direto.filter(function (x) { return x.categoria !== 'oficial_empresa'; }),
      opinioes: {favoravel: op.filter(function (x) { return x.posicao === 'favoravel'; }), contraria: op.filter(function (x) { return x.posicao === 'contraria'; }),
        outras: op.filter(function (x) { return x.posicao !== 'favoravel' && x.posicao !== 'contraria'; }), total: op.length}};
  };
  // v3.5 · VG VIP: o robô guarda à parte (ativos_vip / vinculos_vip) os ativos que só existem nas carteiras VIP. A aba VG VIP
  // lê os dois conjuntos; a seção Oregon continua lendo só ativos/vinculos, então as carteiras nunca se misturam.
  I.vinculoVip = function (x, t) {
    if ((x.ativos || []).indexOf(t) >= 0) return I.vinculo(x, t);
    var v = (x.vinculos_vip || {})[t]; if (v) return v;
    return x.categoria === 'oficial_empresa' ? {tipo: 'direto', motivo: 'documento da companhia à CVM', evento: 'oficial'} : {tipo: 'direto', motivo: 'a manchete trata do ativo', evento: null};
  };
  I.temVip = function (x, t) { return (x.ativos || []).indexOf(t) >= 0 || (x.ativos_vip || []).indexOf(t) >= 0; };
  I.doAtivoVip = function (itens, t) {
    var direto = [], mencoes = [], vis = {};
    itens.forEach(function (x) {
      if (x.acervo || x.agrupado_em || vis[x.id] || !I.temVip(x, t)) return; vis[x.id] = 1;
      (I.vinculoVip(x, t).tipo === 'direto' ? direto : mencoes).push(x);
    });
    var o = function (a, b) { return pub(b).localeCompare(pub(a)); };
    direto.sort(o); mencoes.sort(o);
    var op = direto.filter(function (x) { return x.natureza === 'opiniao_casa'; });
    return {direto: direto, mencoes: mencoes, tema: [], oficiais: direto.filter(function (x) { return x.categoria === 'oficial_empresa'; }),
      noticias: direto.filter(function (x) { return x.categoria !== 'oficial_empresa'; }),
      opinioes: {favoravel: op.filter(function (x) { return x.posicao === 'favoravel'; }), contraria: op.filter(function (x) { return x.posicao === 'contraria'; }),
        outras: op.filter(function (x) { return x.posicao !== 'favoravel' && x.posicao !== 'contraria'; }), total: op.length}};
  };
  I.vinculoTema = function (x, t) { return (x.etfs_tema || []).indexOf(t) >= 0 ? 'tematico' : (x.setor_de || []).indexOf(t) >= 0 ? 'setorial' : null; };
  I.POSICAO = {favoravel: 'a favor', contraria: 'contra', neutra: 'neutra', mista: 'mista'};
  // Contraponto documentado: outra fonte concreta. Opinião com sentido → opiniões de sentido oposto sobre o mesmo ativo;
  // notícia de ativo → opiniões publicadas sobre ele; carta/research → outras fontes sobre o mesmo tema (divergência só lendo).
  I.contrapontos = function (itens, x) {
    var at = x.ativos || [], vis = {}, out = [], rot = '';
    function ok(y) { if (!y || y.id === x.id || y.acervo || y.agrupado_em || vis[y.id]) return false; vis[y.id] = 1; return true; }
    if (at.length && (x.posicao === 'favoravel' || x.posicao === 'contraria')) {
      var oposto = x.posicao === 'favoravel' ? 'contraria' : 'favoravel';
      out = itens.filter(function (y) { return ok(y) && y.natureza === 'opiniao_casa' && (y.posicao === oposto || y.posicao === 'mista') && (y.ativos || []).some(function (t) { return at.indexOf(t) >= 0; }); });
      rot = 'Opiniões em sentido ' + (oposto === 'contraria' ? 'contrário' : 'favorável') + ' sobre ' + at.join(', ') + ' publicadas por outras fontes:';
    } else if (at.length) {
      out = itens.filter(function (y) { return ok(y) && y.natureza === 'opiniao_casa' && y.posicao && (y.ativos || []).some(function (t) { return at.indexOf(t) >= 0; }); });
      rot = 'Opiniões publicadas sobre ' + at.join(', ') + ' (o sentido vem do título):';
    } else if ((x.temas || []).length && x.categoria !== 'veiculo') {
      var org = x.organizacao || x.fonte, lim = Date.parse(I.pub(x) || '') - 30 * 864e5;
      out = itens.filter(function (y) { return ok(y) && y.categoria !== 'veiculo' && (y.organizacao || y.fonte) !== org && (y.temas || []).some(function (t) { return t !== 'carta_gestor' && x.temas.indexOf(t) >= 0; }) && (!isFinite(lim) || Date.parse(I.pub(y) || '') >= lim); });
      rot = 'Outras fontes sobre o mesmo tema nos 30 dias anteriores (se divergem, só a leitura dos textos dirá):';
    }
    out.sort(function (a, b) { return I.pub(b).localeCompare(I.pub(a)); });
    return {itens: out.slice(0, 5), rotulo: rot};
  };
  I.pontos = function (x) { return (x && x.prioridade && x.prioridade.pontos) || 0; };
  I.nivel = function (x) { return (x && x.prioridade && x.prioridade.nivel) || 'baixa'; };
  I.hojeBRT = function (d) { d = d || new Date(); try { var s = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'}).format(d); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; } catch (e) {} return d.toISOString().slice(0, 10); };
  I.menosDias = function (iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  // Junta listas de itens sem repetir (o mesmo id pode estar em recentes e no arquivo do mês), mais recentes primeiro
  // Veículos do Grupo XP não aparecem em lugar nenhum (decisão da Oregon), nem o histórico gravado antes do bloqueio.
  // v3.10 (decisão do Lucas em 09/11/2026): o InfoMoney entra só como notícia no painel, marcado como Grupo XP (I.grupoXP),
  // e fica fora de pauta da semana, fechamento e sugestões do comitê. Os demais veículos do grupo continuam fora de tudo.
  var XP_RX = /\b(expert ?xp|conte[uú]dos xp|xp investimentos|rico investimentos|clear corretora)\b/i;
  I.bloqueado = function (x) { return XP_RX.test([x.organizacao, x.fonte].join(' ')); };
  I.grupoXP = function (x) { return !!x && (/\binfomoney\b|grupo xp/i.test([x.organizacao, x.fonte, x.aviso_fonte].join(' ')) || I.bloqueado(x)); };
  I.macroBR = function (x) { return (x && x.macro_br) || []; };  // v3.10 · subtemas de macro do Brasil marcados pelo robô
  I.juntar = function (listas) {
    var vis = {}, out = [];
    listas.forEach(function (l) { (l || []).forEach(function (x) { if (!x || !x.id || vis[x.id] || x.agrupado_em || I.bloqueado(x)) return; vis[x.id] = 1; out.push(x); }); });
    out.sort(function (a, b) { return pub(b).localeCompare(pub(a)); });
    return out;
  };
  // Busca e filtros da Biblioteca (funções puras, testadas no Node)
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  I.norm = norm;
  /* v3.7 · tipo de evento corporativo (mesma tabela do robô, analise.EVENTOS): só para item de empresa */
  var EV_RX = (TX.eventos || []).map(function (e) { return {k: e[0], n: e[1], rx: new RegExp(e[2]), fora: e[3] ? new RegExp(e[3]) : null}; });
  var EV_SIN = {fusao: ['m&a', 'aquisicao', 'fusao', 'ma'], gestao: ['ceo', 'cfo', 'gestao'], divida: ['debenture', 'debentures', 'bond', 'divida'], oferta: ['follow-on', 'followon', 'ipo', 'oferta']};
  I.EVENTOS = EV_RX.map(function (e) { return [e.k, e.n]; });
  I.eventoNome = function (k) { var e = EV_RX.filter(function (o) { return o.k === k; })[0]; return e ? e.n : k; };
  I.eventosDe = function (x) {
    if (x.eventos) return x.eventos;
    if (x._ev) return x._ev;
    var emp = (x.ativos || []).length || (x.ativos_vip || []).length || x.categoria === 'oficial_empresa', t = norm(x.titulo);
    x._ev = emp ? EV_RX.filter(function (e) { return e.rx.test(t) && !(e.fora && e.fora.test(t)); }).map(function (e) { return e.k; }) : [];
    return x._ev;
  };
  /* v3.7 · marca por tipo de notícia: a mesma letra e cor em todo o painel */
  I.MARCAS = {fato: ['F', 'Fato relevante ou documento à CVM'], resultado: ['R', 'Resultado da empresa'], opiniao: ['O', 'Opinião de casa de análise'],
    carta: ['C', 'Carta de gestora'], research: ['E', 'Estudo ou research'], noticia: ['N', 'Notícia']};
  I.marca = function (x) {
    if (x.categoria === 'oficial_empresa') return {k: 'fato', t: x.tipo === 'fato_relevante' ? 'Fato relevante' : 'Documento à CVM'};
    if (x.natureza === 'opiniao_casa') return {k: 'opiniao', t: I.MARCAS.opiniao[1]};
    if ((x.ativos || []).some(function (t) { var v = I.vinculo(x, t); return v.tipo === 'direto' && v.evento === 'resultado'; })) return {k: 'resultado', t: I.MARCAS.resultado[1]};
    if (x.tipo === 'carta' || /^gestora_/.test(x.categoria || '') && /carta/i.test(x.titulo || '')) return {k: 'carta', t: I.MARCAS.carta[1]};
    if (/^gestora_|^instituicao$|^academia$/.test(x.categoria || '') || /^(research|paper|relatorio|discurso|macro)$/.test(x.tipo || '')) return {k: 'research', t: I.MARCAS.research[1]};
    return {k: 'noticia', t: I.MARCAS.noticia[1]};
  };
  // v3.5 · relevância. Veículo pouco conhecido (achado pela busca) sem fato da empresa: recolhido no Radar, na ficha e na pauta.
  I.desconhecido = function (x) { return !!(x && x.via && x.confiavel === false); };
  I.baixaRelevancia = function (x) {
    if (!I.desconhecido(x) || x.categoria !== 'veiculo' || x.natureza === 'opiniao_casa') return false;
    return !I.diretos(x).some(function (t) { var ev = I.vinculo(x, t).evento; return ev === 'resultado' || ev === 'recomendacao' || ev === 'oficial'; });
  };
  // Mesmo fato em vários veículos ("PRIO lucra 468%" em cinco sites): um item principal (veículo conhecido primeiro) e os demais
  var PARADA = {'para': 1, 'com': 1, 'que': 1, 'dos': 1, 'das': 1, 'nos': 1, 'nas': 1, 'por': 1, 'uma': 1, 'sobre': 1, 'apos': 1, 'mais': 1, 'mas': 1, 'como': 1, 'seu': 1, 'sua': 1, 'the': 1, 'and': 1, 'veja': 1};
  function fichas(t) { return norm(t || '').replace(/[^a-z0-9%,. ]/g, ' ').split(/\s+/).map(function (w) { return w.replace(/[.,]+$/, ''); }).filter(function (w) { return w.length > 2 && !PARADA[w]; }); }
  I.agruparFatos = function (itens, horas) {
    var lim = (horas || 48) * 3600e3, gs = [];
    (itens || []).forEach(function (x) {
      var tk = fichas(x.titulo), nums = tk.filter(function (w) { return /\d/.test(w) && !/^[1-4]t\d{2}$/.test(w) && !/^20\d\d$/.test(w); }), d = I.diretos(x), q = Date.parse(pub(x).length <= 10 ? pub(x) + 'T12:00:00-03:00' : pub(x));
      var g = d.length ? gs.filter(function (g0) {
        if (!g0.d.some(function (a) { return d.indexOf(a) >= 0; }) || !isFinite(q) || Math.abs(g0.q - q) > lim) return false;
        var inter = tk.filter(function (w) { return g0.tk.indexOf(w) >= 0; }).length, uni = {}; tk.concat(g0.tk).forEach(function (w) { uni[w] = 1; });
        return inter / (Object.keys(uni).length || 1) >= 0.34 || (inter >= 2 && nums.some(function (w) { return g0.nums.indexOf(w) >= 0; }));
      })[0] : null;
      if (g) g.todos.push(x); else gs.push({tk: tk, nums: nums, d: d, q: q, todos: [x]});
    });
    return gs.map(function (g) {
      var prin = g.todos.filter(function (y) { return !I.desconhecido(y); })[0] || g.todos[0];
      return {x: prin, outros: g.todos.filter(function (y) { return y !== prin; })};
    });
  };
  // No mesmo dia, veículos conhecidos antes dos pouco conhecidos (a ordem original vale dentro de cada grupo)
  I.ordenarConfiaveis = function (l) {
    return l.map(function (x, i) { return {x: x, i: i, d: pub(x).slice(0, 10), u: I.desconhecido(x) ? 1 : 0}; })
      .sort(function (a, b) { return a.d === b.d ? (a.u - b.u) || (a.i - b.i) : a.i - b.i; }).map(function (o) { return o.x; });
  };
  // Preço-alvo em reais escrito numa opinião, por casa (v3.5): "R$ 38,00" · "R$ 21,00 (Itaú BBA); R$ 19,00 (J.P. Morgan)" ·
  // "R$ 33,20 (PETR4); R$ 35,50 (PETR3)" → [{casa, v}]. Alvo de outra classe da ação e em dólar fica de fora; nada é deduzido.
  I.alvosDe = function (x, t) {
    var s = (x && x.preco_alvo) || '', casas = (x && x.casas) || [], out = [], soltos = [], re = /R\$\s?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:\(([^)]*)\))?/g, m;
    function num(v) { v = /,/.test(v) ? v.replace(/\./g, '').replace(',', '.') : v; v = parseFloat(v); return isFinite(v) && v > 0 ? v : null; }
    while ((m = re.exec(s))) {
      if (/US\$\s?$/.test(s.slice(Math.max(0, m.index - 3), m.index + 2))) continue;
      var v = num(m[1]), p = (m[2] || '').trim();
      if (v == null) continue;
      if (/^[A-Z]{4}\d{1,2}$/.test(p)) { if (p === t) soltos.push(v); continue; }
      if (p) { var c = casas.filter(function (k) { var a = norm(k), b = norm(p); return a.indexOf(b) >= 0 || b.indexOf(a) >= 0; })[0]; if (c) out.push({casa: c, v: v}); continue; }
      soltos.push(v);
    }
    if (soltos.length === 1 && casas.length >= 1 && !out.length) out.push({casa: casas[0], v: soltos[0]});
    return out;
  };
  /* v3.7 · busca com filtros. "frase exata", fonte:valor, desde:10/2026, ate:15/11/2026, ativo:PETR4, evento:recompra,
     tipo:carta (fato, resultado, opiniao, carta, research, noticia) e -palavra para excluir. O resto: todas as palavras. */
  function dataOp(v, fim) {
    var m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v))) return v;
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    if ((m = /^(\d{1,2})\/(\d{4})$/.exec(v))) { var mm = ('0' + m[1]).slice(-2); return m[2] + '-' + mm + (fim ? '-31' : '-01'); }
    if ((m = /^(\d{4})$/.exec(v))) return v + (fim ? '-12-31' : '-01-01');
    return '';
  }
  I.parseBusca = function (txt) {
    var o = {frases: [], termos: [], fora: [], fonte: [], ativo: [], evento: [], tipo: [], de: '', ate: '', ops: false};
    String(txt || '').replace(/(-?)(?:([A-Za-zÀ-ÿ]+):)?"([^"]+)"|(\S+)/g, function (all, neg, op, frase, palavra) {
      var k = op, v = frase;
      if (palavra) { var m = /^(-?)([A-Za-zÀ-ÿ]+):(.+)$/.exec(palavra); if (m && /^(fonte|veiculo|desde|de|ate|ativo|evento|tipo)$/.test(norm(m[2]))) { k = m[2]; v = m[3]; neg = m[1]; } else { k = null; v = palavra; } }
      k = k ? norm(k) : null;
      if (k === 'veiculo') k = 'fonte';
      if (k === 'de') k = 'desde';
      if (k === 'desde' || k === 'ate') { var d = dataOp(v, k === 'ate'); if (d) { o[k === 'desde' ? 'de' : 'ate'] = d; o.ops = true; } return all; }
      if (k && o[k]) { o[k].push(k === 'ativo' ? String(v).toUpperCase() : norm(v)); o.ops = true; return all; }
      if (frase && !op) { o.frases.push(norm(frase)); o.ops = true; return all; }
      var w = norm(v); if (!w) return all;
      if (neg === '-' || (palavra && palavra.charAt(0) === '-' && w.length > 1)) { o.fora.push(w.replace(/^-/, '')); o.ops = true; } else o.termos.push(w);
      return all;
    });
    return o;
  };
  I.filtrar = function (itens, f) {
    f = f || {};
    var pb = I.parseBusca(f.q || ''), q = pb.termos.join(' '), de = f.de || pb.de || '', ate = f.ate || pb.ate || '';
    return itens.filter(function (x) {
      if (f.tema && (x.temas || []).indexOf(f.tema) < 0) return false;
      if (f.regiao && (x.regioes || []).indexOf(f.regiao) < 0) return false;
      if (f.tipo && x.tipo !== f.tipo) return false;
      if (f.categoria && x.categoria !== f.categoria) return false;
      if (f.org && (x.organizacao || x.fonte) !== f.org) return false;
      if (f.ativo && (x.ativos || []).indexOf(f.ativo) < 0) return false;
      if (f.nivel && I.nivel(x) !== f.nivel) return false;
      var d = pub(x).slice(0, 10);
      if (de && d < de) return false;
      if (ate && d > ate) return false;
      if (q || pb.frases.length || pb.fora.length) { var alvo = norm([x.titulo, x.resumo, x.organizacao, x.fonte, x.autor, (x.temas || []).map(I.temaNome).join(' '), (x.ativos || []).join(' '), (x.ativos_vip || []).join(' ')].join(' '));
        if (q && q.split(/\s+/).some(function (w) { return alvo.indexOf(w) < 0; })) return false;
        if (pb.frases.some(function (w) { return alvo.indexOf(w) < 0; })) return false;
        if (pb.fora.some(function (w) { return alvo.indexOf(w) >= 0; })) return false; }
      if (pb.fonte.length) { var fo = norm((x.fonte || '') + ' ' + (x.organizacao || '')); if (!pb.fonte.some(function (w) { return fo.indexOf(w) >= 0; })) return false; }
      if (pb.ativo.length) { var at = (x.ativos || []).concat(x.ativos_vip || []); if (!pb.ativo.some(function (t) { return at.indexOf(t) >= 0; })) return false; }
      if (pb.evento.length) { var ev = I.eventosDe(x); if (!pb.evento.some(function (w) { return ev.some(function (k) { return k === w || norm(I.eventoNome(k)).indexOf(w) >= 0 || (EV_SIN[k] || []).indexOf(w) >= 0; }); })) return false; }
      if (pb.tipo.length) { var mk = I.marca(x).k; if (!pb.tipo.some(function (w) { return mk === w || norm(I.MARCAS[mk][1]).indexOf(w) >= 0; })) return false; }
      return true;
    });
  };
  I.contagens = function (itens, campo) { var o = {}; itens.forEach(function (x) { var v = x[campo]; (Array.isArray(v) ? v : [v]).forEach(function (k) { if (k) o[k] = (o[k] || 0) + 1; }); }); return o; };
  // Ordem para o briefing local, quando hoje.json não existe: pontos, depois data
  I.ordenar = function (itens) { return itens.slice().sort(function (a, b) { return (I.pontos(b) - I.pontos(a)) || pub(b).localeCompare(pub(a)); }); };
  // Pilar da Oregon → fator de risco acompanhado (para ligar conteúdo a ETFs sem inventar menção)
  I.FATOR_PILAR = {P1: 'selic', P2: 'pre', P3: 'spread', P4: 'real', P9: 'ust', P10: 'spread', P11: 'sp', P12: 'em', P13: 'btc'};
  I.exportarAprendizados = function (lista) { return JSON.stringify({produto: 'Oregon Intelligence', tipo: 'aprendizados', exportado_em: new Date().toISOString(), itens: lista}, null, 1); };
  I.lerImportacao = function (txt) {
    var j = JSON.parse(txt); var arr = Array.isArray(j) ? j : (j && Array.isArray(j.itens) ? j.itens : null);
    if (!arr) throw new Error('arquivo sem a lista de aprendizados');
    return arr.filter(function (a) { return a && typeof a === 'object' && a.id && (a.nota || a.titulo); }).map(function (a) { return {id: String(a.id), quando: a.quando || new Date().toISOString(), item_id: a.item_id || null, titulo: String(a.titulo || '').slice(0, 300), fonte: String(a.fonte || '').slice(0, 120), link: /^https?:\/\//i.test(a.link || '') ? a.link : null, temas: Array.isArray(a.temas) ? a.temas.slice(0, 6) : [], tipo: ['aprendizado', 'tese', 'duvida', 'mudanca'].indexOf(a.tipo) >= 0 ? a.tipo : 'aprendizado', nota: String(a.nota || '').slice(0, 4000)}; });
  };
  if (typeof module !== 'undefined') module.exports = I;
  return I;
})();

(function (A, C, I) {
  'use strict';
  if (typeof document === 'undefined' || !A) return;
  var h = A.h, S = A.S;
  var E = {versao: null, macro: null, recentes: null, hoje: null, coleta: null, semanal: null, fontes: null, res: null, meses: {}, carregando: false, erro: null, ultimo: null, timer: null, falhas: 0};
  A.intel = E;
  var SITE_PADRAO = 'https://lucaslimaequity-a11y.github.io/robo-oregon/';
  function noClaude() { return !!(window.claude && window.claude.use) || STORE.mode === 'db'; }
  function base() {
    try { if (/^https?:$/.test(location.protocol) && !noClaude()) return new URL('data/', location.href).href; } catch (e) {}
    return SITE_PADRAO + 'data/';  // no claude.ai e no arquivo local: tenta o site público; se não der, a tela diz
  }
  async function getJSON(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 12000);
    try { var r = await fetch(url, {signal: ctl ? ctl.signal : undefined, cache: 'no-store'}); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    finally { clearTimeout(t); }
  }
  function marca() { return '?t=' + Date.now(); }
  function motivo(e) { var m = String(e && (e.message || e) || ''); return /HTTP 404/.test(m) ? 'arquivo ainda não publicado pelo robô' : /HTTP/.test(m) ? m : /abort/i.test(m) ? 'sem resposta' : /fetch|network|Failed/i.test(m) ? 'sem acesso ao endereço (rede ou bloqueio desta visualização)' : (m || 'falha'); }
  function renderSeguro() {
    var ae = document.activeElement;
    if (document.querySelector('.drawer') || document.querySelector('.cmdk-bg') || (ae && ae.closest && ae.closest('#main') && /INPUT|TEXTAREA|SELECT/.test(ae.tagName))) { clearTimeout(E.rsT); E.rsT = setTimeout(renderSeguro, 1500); return; }
    (A.rerender || A.render)();
  }
  async function carregarTudo() {
    var b = base(), st = {};
    async function um(nome, ms) { try { var j = await getJSON(b + nome + marca(), ms); st[nome] = {ok: true}; return j; } catch (e) { st[nome] = {ok: false, msg: motivo(e), ausente: /404/.test(String(e && e.message))}; return undefined; } }
    var r = await Promise.all([um('macro.json', 15000), um('recentes.json', 30000), um('hoje.json'), um('coleta.json', 20000), um('semanal.json', 15000), um('biblioteca/opinioes.json', 20000), um('biblioteca/pesquisas.json', 15000), um('resultados.json', 20000), um('biblioteca/research.json', 20000)]);
    if (r[0] !== undefined) E.macro = r[0];
    if (r[1] !== undefined) E.recentes = r[1];
    if (r[2] !== undefined) E.hoje = r[2];
    if (r[3] !== undefined) E.coleta = r[3];
    if (r[4] !== undefined) E.semanal = r[4];
    if (r[8] !== undefined) E.research = r[8];  // research de 90 dias (v3.4)
    if (r[5] !== undefined) E.opinioes = r[5];  // opiniões de 12 meses (publicado a partir da v3.3; ausente antes disso)
    if (r[6] !== undefined) E.pesquisas = r[6];  // pesquisas sobre a relação ativo × fator (v3.4)
    if (r[7] !== undefined) { E.res = r[7] && r[7].empresas ? r[7] : null; E.resLido = true; E.resAusente = !E.res; }  // resultados da CVM (temporada no Hoje e fichas)
    E.status = st;
    E.ultimo = new Date().toISOString();
  }
  async function atualizar(manual) {
    if (E.carregando) return; E.carregando = true; E.erro = null;
    var mudou = true;
    try {
      var v = null;
      try { v = await getJSON(base() + 'versao.json' + marca(), 8000); E.falhas = 0; } catch (e) { E.falhas++; E.erro = motivo(e); }
      if (v && v.produto !== 'Oregon Intelligence') { E.versaoAntiga = v; }  // robô antigo ainda rodando: a tela avisa
      if (v && E.versao && v.gerado_em === E.versao.gerado_em && !manual) mudou = false;
      if (v) E.versao = v;
      if (mudou && (v || !E.recentes)) await carregarTudo();
    } finally { E.carregando = false; if (mudou || manual) renderSeguro(); else if (A.renderTop) A.renderTop(); }
  }
  A.intelAtualizar = function () { return atualizar(true); };
  A.intelIniciar = function () {
    setTimeout(function () { atualizar(false); }, 30);
    E.timer = setInterval(function () { if (!document.hidden) atualizar(false); }, 2 * 60000);  // versao.json tem poucos bytes
    document.addEventListener('visibilitychange', function () { if (!document.hidden && E.ultimo && Date.now() - new Date(E.ultimo).getTime() > 2 * 60000) atualizar(false); });
  };
  // Meses da biblioteca sob demanda (cada mês é um arquivo); devolve o que já está em memória e busca o resto
  A.carregarMes = function (mes) {
    if (E.meses[mes]) return E.meses[mes].promessa || Promise.resolve(E.meses[mes].itens);
    var p = getJSON(base() + 'biblioteca/' + mes + '.json' + marca(), 40000).then(function (j) { E.meses[mes] = {itens: (j && j.itens) || [], ok: true}; renderSeguro(); return E.meses[mes].itens; }, function (e) { E.meses[mes] = {itens: [], ok: false, msg: motivo(e)}; renderSeguro(); return []; });
    E.meses[mes] = {itens: [], promessa: p, carregando: true};
    return p;
  };
  // Estante (v3.5): acervo permanente de autores e séries clássicas, carregado só quando a aba é aberta
  A.carregarEstante = function () {
    if (E.estante || E.estanteP) return E.estanteP || Promise.resolve(E.estante);
    E.estanteP = getJSON(base() + 'biblioteca/estante.json' + marca(), 40000).then(function (j) { E.estante = j && j.itens ? j : {itens: [], colecoes: []}; E.estanteP = null; renderSeguro(); return E.estante; },
      function (e) { E.estante = {itens: [], colecoes: [], erro: motivo(e)}; E.estanteP = null; renderSeguro(); return E.estante; });
    return E.estanteP;
  };
  // v3.6 · arquivos publicados pelo robô carregados sob demanda (termômetro das cartas, fundos, proventos, clássico da semana)
  E.arq = E.arq || {};
  A.arquivo = function (nome) {
    var a = E.arq[nome];
    if (a && (a.dados || a.erro)) return a;
    if (!a) {
      E.arq[nome] = {carregando: true};
      getJSON(base() + nome + marca(), 40000).then(function (j) { E.arq[nome] = {dados: j || {}}; renderSeguro(); }, function (e) { E.arq[nome] = {erro: motivo(e), ausente: /404/.test(String(e && e.message))}; renderSeguro(); });
    }
    return E.arq[nome];
  };
  A.mesesDisponiveis = function () { return (E.versao && E.versao.meses) || []; };
  // Opiniões de casas de análise dos últimos 12 meses (biblioteca/opinioes.json) e o conjunto usado nas fichas dos ativos
  A.opinioes12m = function () { return (E.opinioes && E.opinioes.itens) || []; };
  A.itensAtivo = function () { return I.juntar([A.itens(), A.opinioes12m()]); };
  // Cartas, research e instituições com data nos últimos 90 dias (biblioteca/research.json) somados ao que já está carregado
  A.itensResearch = function () { return I.juntar([A.itens(), (E.research && E.research.itens) || []]); };
  A.carregarFontes = function () {
    if (E.fontes || E.fontesBuscando) return;
    E.fontesBuscando = true;
    getJSON(base() + 'fontes.json' + marca(), 20000).then(function (j) { E.fontes = j && j.fontes ? j.fontes : (Array.isArray(j) ? j : []); }, function () { E.fontes = []; E.fontesFalhou = true; }).then(function () { E.fontesBuscando = false; renderSeguro(); });
  };
  // Resultados da CVM (resultados.json): baixado quando uma ficha pede, uma vez por sessão (10 min de espera após falha)
  A.resultadosDe = function (t) {
    var vencido = E.resFalhou && Date.now() - E.resFalhou > 10 * 60000;
    if ((!E.resLido || vencido) && !E.resBuscando) {
      E.resBuscando = true;
      E.resPromise = getJSON(base() + 'resultados.json' + marca(), 30000)
        .then(function (j) { E.res = j && j.empresas ? j : null; E.resFalhou = null; E.resAusente = !E.res; }, function (e) { E.res = null; E.resFalhou = Date.now(); E.resAusente = /HTTP 404/.test(String(e && e.message)); })
        .then(function () { E.resBuscando = false; E.resLido = true; renderSeguro(); });
    }
    return {carregando: !!E.resBuscando, promessa: E.resPromise || null, falhou: !!E.resFalhou && !E.resAusente, dados: E.res || null, emp: E.res && E.res.empresas ? (E.res.empresas[t] || null) : null, fora: E.res && E.res.fora ? (E.res.fora[t] || null) : null};
  };
  // Todos os itens em memória (recentes + meses já carregados), sem repetição
  A.itens = function () { var L = [E.recentes && E.recentes.itens]; Object.keys(E.meses).sort().reverse().forEach(function (m) { L.push(E.meses[m].itens); }); return I.juntar(L); };
  A.itemPorId = function (id) { var t = A.itens(); for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i]; return null; };
  A.itensDe = function (t) { return A.itens().filter(function (x) { return (x.ativos || []).indexOf(t) >= 0; }); };
  A.itensSetor = function (sid) { return A.itens().filter(function (x) { return (x.setores || []).indexOf(sid) >= 0; }); };
  A.itensFator = function (k) { return A.itens().filter(function (x) { return (x.fatores || []).indexOf(k) >= 0; }); };
  A.itensTema = function (t) { return A.itens().filter(function (x) { return (x.temas || []).indexOf(t) >= 0; }); };

  /* ---------- leitura e aprendizados (neste navegador; no claude.ai, no banco do painel) ---------- */
  A.lido = function (id) { return !!STORE.get('leituras', id); };
  A.marcarLido = async function (x, lido) { if (lido === false) { await STORE.del('leituras', x.id); return; } await STORE.put('leituras', x.id, {quando: STORE.now(), titulo: x.titulo, fonte: x.organizacao || x.fonte, temas: x.temas || []}); };
  A.aprendizados = function () { return STORE.list('aprendizados').sort(function (a, b) { return String(b.quando).localeCompare(String(a.quando)); }); };
  A.salvarAprendizado = async function (reg) {
    var id = reg.id || STORE.newId('ap');
    await STORE.put('aprendizados', id, {quando: reg.quando || STORE.now(), item_id: reg.item_id || null, titulo: reg.titulo || '', fonte: reg.fonte || '', link: A.link(reg.link) || null, temas: reg.temas || [], tipo: reg.tipo || 'aprendizado', nota: String(reg.nota || '').trim()});
    return id;
  };

  /* ---------- ergonomia: última visita, ativos consultados, "ler depois", profundidade (tudo neste navegador) ---------- */
  var LSK = 'oregon-intel-v3:';
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(LSK + k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(LSK + k, JSON.stringify(v)); } catch (e) {} }
  // A visita anterior é a referência de "novo para você" durante toda esta sessão; a atual vira referência da próxima.
  var VIS = (function () { var v = lsGet('visita', {}); var ref = v.ultima || null; return {ref: ref}; })();
  function marcarVisita() { lsSet('visita', {ultima: new Date().toISOString()}); }
  try { window.addEventListener('pagehide', marcarVisita); document.addEventListener('visibilitychange', function () { if (document.hidden) marcarVisita(); }); setTimeout(marcarVisita, 90000); } catch (e) {}
  A.visitaAnterior = function () { return VIS.ref; };
  // Item novo para você: detectado pelo robô depois da sua visita anterior (a hora de publicação pode ser anterior)
  A.novoParaVoce = function (x) { if (!VIS.ref || !x) return false; var d = x.detectado_em || x.publicado_em; return !!d && Date.parse(d) > Date.parse(VIS.ref); };
  A.ativosRecentes = function () { return lsGet('ativos', []); };
  A.registrarAtivo = function (t) { if (!t) return; var l = lsGet('ativos', []).filter(function (x) { return x !== t; }); l.unshift(t); lsSet('ativos', l.slice(0, 8)); };
  A.prof = function () { var p = lsGet('prof', 'briefing'); return ['rapida', 'briefing', 'aprofundada'].indexOf(p) >= 0 ? p : 'briefing'; };
  A.setProf = function (p) { lsSet('prof', p); A.rerender(); };
  A.salvo = function (id) { return !!STORE.get('salvos', id); };
  A.salvar = async function (x, sim) {
    if (sim === false) { await STORE.del('salvos', x.id); return; }
    await STORE.put('salvos', x.id, {quando: STORE.now(), titulo: x.titulo, link: A.link(x.link), fonte: x.organizacao || x.fonte, publicado_em: x.publicado_em || null, item: x});
  };
  A.salvos = function () { return STORE.list('salvos').sort(function (a, b) { return String(b.quando).localeCompare(String(a.quando)); }); };
  A.lsGet = lsGet; A.lsSet = lsSet;

  /* ---------- vistas de conteúdo ---------- */
  var TIPO_CLS = {carta: 'c-carta', research: 'c-research', paper: 'c-research', macro: 'c-macro', dado_oficial: 'c-oficial', documento_oficial: 'c-oficial', discurso: 'c-oficial', relatorio: 'c-research', video: 'c-video', noticia: 'c-noticia', blog: 'c-research', podcast: 'c-video', fato_relevante: 'c-oficial'};
  function quandoTxt(x) { return I.quando(x); }
  A.quandoTxt = quandoTxt;
  function orgDe(x) { return x.categoria === 'oficial_empresa' ? 'CVM · ' + (x.organizacao || '') : x.via ? x.fonte : (x.organizacao || x.fonte); }
  A.orgDe = orgDe;
  function chipsItem(x, opt) {
    opt = opt || {};
    var ch = [];
    if (x.categoria !== 'veiculo' && x.categoria !== 'oficial_empresa') ch.push(A.chip(I.tipoNome(x.tipo), 'tp ' + (TIPO_CLS[x.tipo] || '')));
    if (x.natureza === 'opiniao_casa') ch.push(A.chip('Opinião' + ((x.casas || []).length ? ' · ' + x.casas.join(', ') : ' de analistas') + (x.posicao ? ' · ' + I.POSICAO[x.posicao] : ''), 'casa' + (x.posicao ? ' p-' + x.posicao : ''), 'Opinião de terceiros, como relatada no título público. O sentido (a favor/contra) é lido do título, não do relatório. Não é recomendação do Oregon.'));
    if (x.aviso_fonte) ch.push(A.chip(x.aviso_fonte.split(' — ')[0], 'g-baixa', x.aviso_fonte));
    if (x.via && x.confiavel === false) ch.push(A.chip('veículo pouco conhecido', 'g-baixa', 'Achado pela busca do ' + x.via + '; confira na fonte antes de usar.'));
    if (x.categoria === 'oficial_empresa') ch.push(A.chip(x.categoria_cvm || 'CVM', 'tp c-oficial', 'Documento entregue pela companhia à CVM'));
    if (opt.comNivel && x.categoria !== 'veiculo') { var n = I.nivel(x); if (n === 'alta') ch.push(A.chip('prioridade alta', 'g-critica', (x.prioridade && x.prioridade.porque || []).join(' · '))); }
    if (x.analise && x.analise.profunda) ch.push(A.chip('leitura IA', 'o-ia', 'Leitura por IA sobre o título e o resumo público'));
    if (x.natureza === 'promocional' || x.natureza === 'sensacionalista') ch.push(A.chip(x.natureza, 'g-baixa'));
    if (A.lido(x.id)) ch.push(A.chip('lido', 'o-obs'));
    return ch;
  }
  // Etiqueta do ativo citado: cheia quando o vínculo é direto, tracejada quando é menção de passagem
  function tagAtivo(x, t) {
    var v = I.vinculo(x, t), men = v.tipo !== 'direto';
    return h('button', {class: 'tag tk' + (men ? ' men' : ''), title: (men ? 'Menção de passagem: ' : 'Vínculo direto: ') + v.motivo, onclick: function (e) { e.stopPropagation(); A.abrirFicha(t); }}, t);
  }
  // Cartão de conteúdo (cartas, research, leituras do dia): a hora vem primeiro; o título abre a leitura; ↗ abre a fonte original
  A.itemCard = function (x, opt) {
    opt = opt || {};
    var org = orgDe(x), lk = A.link(x.link);
    var card = h('article', {class: 'nw ' + (TIPO_CLS[x.tipo] || '') + (A.lido(x.id) ? ' lido' : '') + (x.acervo ? ' acervo' : ''), 'data-id': x.id});
    card.appendChild(h('div', {class: 'nw-top'}, h('time', {class: 'nw-when' + (x.publicado_em ? '' : ' sem'), datetime: x.publicado_em || ''}, quandoTxt(x)), h('span', {class: 'nw-src'}, org), chipsItem(x, opt)));
    card.appendChild(h('h3', {class: 'nw-t'}, h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, x.titulo), lk ? h('a', {class: 'nw-ext', href: lk, target: '_blank', rel: 'noopener', title: 'Abrir a fonte original', 'aria-label': 'Abrir a fonte original'}, '↗') : null));
    if (x.resumo && !opt.semResumo) card.appendChild(h('p', {class: 'nw-r'}, x.resumo));
    var tags = (x.ativos || []).slice(0, 4).map(function (t) { return tagAtivo(x, t); })
      .concat((x.etfs_tema || []).filter(function (t) { return (x.ativos || []).indexOf(t) < 0; }).slice(0, 3).map(function (t) { return h('button', {class: 'tag tk tema', title: 'Notícia do índice ou do tema do ETF, não do fundo', onclick: function () { A.abrirFicha(t); }}, t + ' · tema'); }))
      .concat(opt.semTemas ? [] : (x.temas || []).slice(0, 2).map(function (t) { return h('button', {class: 'tag', onclick: function () { A.go('bib', 'busca'); if (A.bibFiltro) A.bibFiltro({tema: t}); }}, I.temaNome(t)); }));
    if (x.tambem_em && x.tambem_em.length) tags.push(h('span', {class: 'tag mu', title: x.tambem_em.map(function (t) { return t.fonte; }).join(', ')}, '+' + x.tambem_em.length + ' fonte(s)'));
    if (tags.length) card.appendChild(h('div', {class: 'nw-tags'}, tags));
    return card;
  };
  // Linha compacta (painel de notícias da ficha): hora · título · veículo ↗ · sinal curto (opinião, CVM, menção)
  A.itemLinha = function (x, t, outros) {
    var lk = A.link(x.link), men = t && (x.ativos || []).indexOf(t) >= 0 && I.vinculo(x, t).tipo !== 'direto', corpo;
    var li = h('li', {class: 'nl' + (A.lido(x.id) ? ' lido' : '') + (men ? ' men' : ''), 'data-id': x.id}, h('time', {class: 'nw-when' + (x.publicado_em ? '' : ' sem')}, quandoTxt(x)),
      corpo = h('div', null, h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, A.marcaEl(x), x.titulo),
        h('div', {class: 'nl-src'}, x.categoria === 'oficial_empresa' ? 'CVM · ' + (x.categoria_cvm || 'documento') : (x.fonte && x.via ? x.fonte : x.organizacao || x.fonte),
          lk ? h('a', {class: 'nw-ext', href: lk, target: '_blank', rel: 'noopener', title: 'Abrir a matéria original', 'aria-label': 'Abrir a matéria original'}, '↗') : null,
          marcadores(x), outros && outros.length ? outrosLinha(outros, t, function () { return corpo; }) : null)));
    return li;
  };
  // na lista compacta, o mesmo fato em outros veículos abre logo abaixo da linha
  function outrosLinha(outros, t, alvo) {
    var b = h('button', {class: 'nr-grp', 'aria-expanded': 'false', title: 'O mesmo fato em: ' + outros.map(orgDe).join(', '), onclick: function () {
      var c = alvo(), ab = c.querySelector('.nl-out');
      if (ab) { ab.remove(); b.setAttribute('aria-expanded', 'false'); return; }
      c.appendChild(h('ul', {class: 'nls nl-out'}, outros.map(function (y) { return A.itemLinha(y, t); })));
      b.setAttribute('aria-expanded', 'true');
    }}, '+' + outros.length + (outros.length > 1 ? ' veículos' : ' veículo'));
    return b;
  }
  // Lista compacta já agrupada (mesmo fato) e, no mesmo dia, veículos conhecidos antes dos pouco conhecidos
  A.linhasAgrupadas = function (l, t, max) {
    var gs = I.agruparFatos(I.ordenarConfiaveis(l));
    return {n: gs.length, ul: h('ul', {class: 'nls'}, gs.slice(0, max || gs.length).map(function (g) { return A.itemLinha(g.x, t, g.outros); }))};
  };
  A.listaLinhas = function (itens, max, vazio, t) { if (!itens.length) return h('p', {class: 'empty'}, vazio || 'Sem notícias recentes.'); return h('ul', {class: 'nls'}, itens.slice(0, max || itens.length).map(function (x) { return A.itemLinha(x, t); })); };
  A.listaItens = function (itens, opt) { opt = opt || {}; if (!itens.length) return h('p', {class: 'empty'}, opt.vazio || 'Nada aqui ainda.'); return h('div', {class: 'nwlist'}, itens.slice(0, opt.max || itens.length).map(function (x) { return A.itemCard(x, opt); })); };

  // Sinais curtos ao lado do título: opinião (com sentido), documento da CVM, fonte sinalizada, veículo pouco conhecido
  function marcadores(x) {
    var m = [];
    if (x.natureza === 'opiniao_casa') m.push(h('span', {class: 'mk casa' + (x.posicao ? ' p-' + x.posicao : ''), title: 'Opinião ' + ((x.casas || []).join(', ') || 'de analistas') + (x.posicao ? ' · ' + I.POSICAO[x.posicao] : ' · sem sentido explícito') + (x.recomendacao || x.preco_alvo ? ' (recomendação e preço-alvo como publicados)' : ' (lido do título)')},
      ((x.casas || [])[0] || 'opinião') + (x.posicao === 'favoravel' ? ' ▲' : x.posicao === 'contraria' ? ' ▼' : '') + (x.recomendacao ? ' · ' + x.recomendacao : '') + (x.preco_alvo ? ' · alvo ' + x.preco_alvo : '')));
    if (x.categoria === 'oficial_empresa') m.push(h('span', {class: 'mk cvm', title: 'Documento entregue pela companhia à CVM'}, x.tipo === 'fato_relevante' ? 'fato relevante' : 'CVM'));
    I.eventosDe(x).slice(0, 2).forEach(function (k) { m.push(h('span', {class: 'mk evc evc-' + k, title: 'Tipo de evento (pela manchete): ' + I.eventoNome(k)}, I.eventoNome(k))); });
    if (x.aviso_fonte) m.push(h('span', {class: 'mk av', title: x.aviso_fonte}, '!'));
    if (x.via && x.confiavel === false) m.push(h('span', {class: 'mk av', title: 'Veículo pouco conhecido, achado pela busca do ' + x.via + '. Confira na fonte.'}, '?'));
    return m;
  }
  // Coluna "ativo/tema" da linha: ativos com vínculo direto; senão menção (tracejada); senão tema de ETF; senão o assunto
  function alvoLinha(x) {
    var d = I.diretos(x), men = I.mencoes(x), out = d.slice(0, 2).map(function (t) { return tagAtivo(x, t); });
    if (!out.length && men.length) out = men.slice(0, 1).map(function (t) { return tagAtivo(x, t); });
    if (!out.length && (x.etfs_tema || []).length) out = [h('button', {class: 'tag tk tema', title: 'Notícia do índice ou do tema do ETF, não do fundo', onclick: function (e) { e.stopPropagation(); A.abrirFicha(x.etfs_tema[0]); }}, x.etfs_tema[0])];
    if (!out.length && (x.temas || []).length) out = [h('span', {class: 'nr-tema'}, I.temaNome(x.temas[0]))];
    var resto = d.length + (d.length ? 0 : men.length) - out.length;
    if (resto > 0 && (d.length || men.length)) out.push(h('span', {class: 'nr-mais'}, '+' + resto));
    return out;
  }
  // Linha de notícia (Hoje, Mundo): hora | veículo | título | ativo/tema | ↗. O título abre e fecha um resumo no próprio lugar.
  var ABERTO = {};
  A.itemRow = function (x, opt) {
    opt = opt || {};
    var lk = A.link(x.link), ab = !opt.abrir && !!ABERTO[x.id], id = 'nr-' + x.id, hr = I.hora(x), org = orgDe(x);
    var row = h('article', {class: 'nw nr' + (A.lido(x.id) ? ' lido' : '') + (ab ? ' aberto' : '') + (A.novoParaVoce(x) ? ' novo' : ''), 'data-id': x.id});
    var bt = h('button', {class: 'nr-t nwl', 'aria-expanded': opt.abrir ? null : ab ? 'true' : 'false', 'aria-controls': opt.abrir ? null : id, title: A.novoParaVoce(x) ? 'Novo desde a sua última visita' : null, onclick: function () {
      if (opt.abrir) { A.abrirItem(x); return; }
      ABERTO[x.id] = !ABERTO[x.id];
      var d = row.querySelector('.nr-d'); if (d) d.remove();
      if (ABERTO[x.id]) row.appendChild(detalheRow(x, id));
      row.classList.toggle('aberto', !!ABERTO[x.id]); bt.setAttribute('aria-expanded', ABERTO[x.id] ? 'true' : 'false');
    }}, A.marcaEl(x), h('span', {class: 'nr-tx'}, x.titulo));
    row.append(h('time', {class: 'nw-when' + (hr.sem ? ' sem' : ''), datetime: x.publicado_em || x.detectado_em || '', title: hr.tip + (x.publicado_em ? ' · ' + I.quando(x) : '')}, hr.txt),
      h('span', {class: 'nw-src', title: org}, org),
      h('div', {class: 'nr-tt'}, bt, marcadores(x), opt.outros ? outrosBtn(opt.outros, row) : null, opt.extra ? opt.extra(x) : null),
      h('span', {class: 'nr-a'}, opt.alvo ? opt.alvo(x) : alvoLinha(x)),
      lk ? h('a', {class: 'nw-ext', href: lk, target: '_blank', rel: 'noopener', title: 'Abrir a matéria original', 'aria-label': 'Abrir a matéria original'}, '↗') : h('span', {class: 'nw-ext off', 'aria-hidden': 'true'}));
    if (ab) row.appendChild(detalheRow(x, id));
    return row;
  };
  // "+N veículos": o mesmo fato em outros veículos, aberto no próprio lugar
  function outrosBtn(outros, row) {
    var b = h('button', {class: 'nr-grp', 'aria-expanded': 'false', title: 'O mesmo fato em ' + outros.length + (outros.length > 1 ? ' outros veículos: ' : ' outro veículo: ') + outros.map(orgDe).join(', '), onclick: function (ev) {
      ev.stopPropagation();
      var aberto = row.querySelector('.nr-out');
      if (aberto) { aberto.remove(); b.setAttribute('aria-expanded', 'false'); return; }
      row.appendChild(h('div', {class: 'nr-out'}, A.listaRows(outros, {agrupar: false, dias: false, abrir: true})));
      b.setAttribute('aria-expanded', 'true');
    }}, '+' + outros.length + (outros.length > 1 ? ' veículos' : ' veículo'));
    return b;
  }
  function detalheRow(x, id) {
    var lk = A.link(x.link), d = h('div', {class: 'nr-d', id: id}), an = x.analise || {};
    if (an.base === 'resumo' || (!an.v && x.resumo)) d.appendChild(h('p', {class: 'nw-r'}, curto(x.resumo, 320)));
    else d.appendChild(h('p', {class: 'nr-so'}, 'Só a manchete foi coletada; o texto está na fonte original.'));
    var pq = porQueImporta(x).concat(relacaoOregon(x).map(function (r) { return {r: r.r, t: r.txt}; })).slice(0, 3);
    if (pq.length) d.appendChild(h('ul', {class: 'nr-pq'}, pq.map(function (f) { return h('li', null, rotulo(f.r), ' ', f.t); })));
    var bs = h('button', {class: 'btn sm', onclick: async function () { await A.salvar(x, !A.salvo(x.id)); bs.textContent = A.salvo(x.id) ? 'Salvo' : 'Ler depois'; }}, A.salvo(x.id) ? 'Salvo' : 'Ler depois');
    d.appendChild(h('div', {class: 'nr-act'}, h('button', {class: 'btn sm', onclick: function () { A.abrirItem(x); }}, 'Ler mais'),
      lk ? h('a', {class: 'btn sm pri', href: lk, target: '_blank', rel: 'noopener'}, 'Abrir a fonte ↗') : null, bs, A.botaoComite ? A.botaoComite(x) : null,
      h('span', {class: 'muted nr-dt'}, datasTxt(x, true))));
    return d;
  }
  A.marcaEl = function (x) { var m = I.marca(x); return h('i', {class: 'mt mt-' + m.k, title: m.t, 'aria-label': m.t + ':'}, I.MARCAS[m.k][0]); };
  A.legendaMarcas = function () {
    return h('p', {class: 'mt-leg', 'aria-label': 'Legenda dos tipos'}, Object.keys(I.MARCAS).map(function (k) { return h('span', null, h('i', {class: 'mt mt-' + k}, I.MARCAS[k][0]), ' ' + I.MARCAS[k][1].replace(' ou documento à CVM', ' ou CVM').replace(' de casa de análise', ' de casa')); }));
  };
  // Lista de linhas com separador por dia (a hora de cada linha é a de publicação; o dia fica no separador)
  A.listaRows = function (itens, opt) {
    opt = opt || {};
    if (!itens.length) return h('p', {class: 'empty'}, opt.vazio || 'Nada aqui ainda.');
    var box = h('div', {class: 'nrl'}), dia = null, grupos = opt.agrupar === false ? itens.map(function (x) { return {x: x, outros: []}; }) : I.agruparFatos(itens);
    // dentro do mesmo dia, veículos conhecidos antes dos pouco conhecidos (a ordem por hora continua em cada grupo)
    if (opt.dias !== false) grupos = grupos.map(function (g, i) { return {g: g, i: i, d: I.hora(g.x).dia, u: I.desconhecido(g.x) ? 1 : 0}; })
      .sort(function (a, b) { return a.d === b.d ? (a.u - b.u) || (a.i - b.i) : a.i - b.i; }).map(function (o) { return o.g; });
    grupos.slice(0, opt.max || grupos.length).forEach(function (g) {
      var x = g.x, d = I.hora(x).dia;
      if (opt.dias !== false && d !== dia) { dia = d; box.appendChild(h('div', {class: 'nr-day'}, I.rotuloDia(d))); }
      box.appendChild(A.itemRow(x, g.outros.length ? Object.assign({}, opt, {outros: g.outros}) : opt));
    });
    return box;
  };

  /* ---------- leitura de um item (janela ao clicar na notícia) ----------
     Editorial e curta: título, fonte e data; resumo da fonte quando houver; por que importa; relação com a carteira só
     quando sustentada; contrapontos só quando documentados; link original sempre à vista; aprofundar recolhido.
     Rótulos: Fonte (texto publicado) · Verificado (dados da coleta e das carteiras) · Sistema (classificação automática). */
  var ROT = {fonte: ['Fonte', 'r-fonte', 'Texto publicado pela fonte'], fato: ['Verificado', 'r-fato', 'Dado da coleta, da CVM ou das carteiras aprovadas'], sistema: ['Sistema', 'r-inferencia', 'Classificação automática por regras sobre título e resumo'], ia: ['IA', 'r-inferencia', 'Leitura por IA sobre título e resumo público']};
  function rotulo(k) { var r = ROT[k] || ROT.sistema; return h('span', {class: 'rot ' + r[1], title: r[2]}, r[0]); }
  function curto(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').replace(/\s*(Leia aqui|Leia mais|Continue lendo)\.?\s*$/i, '').trim();
    if (s.length <= n) return s;
    var c = s.slice(0, n), p = Math.max(c.lastIndexOf('. '), c.lastIndexOf('; '));
    return (p > n * 0.5 ? c.slice(0, p + 1) : c.replace(/\s+\S*$/, '') + '…');
  }
  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function dataLonga(iso) {
    if (!iso) return '';
    var d = String(iso).slice(0, 10), w = DIAS[new Date(d + 'T12:00:00Z').getUTCDay()], m = String(iso).match(/T(\d{2}):(\d{2})/);
    return w + ', ' + d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) + (m ? ' às ' + m[1] + ':' + m[2] : '');
  }
  // Três datas distintas: publicação (da fonte), atualização (da fonte) e detecção (do robô)
  function datasTxt(x, curtoTxt) {
    if (x.publicado_em) {
      var rel = I.quando(x), p = [(x.data_e_atualizacao ? 'Atualizado ' : 'Publicado ') + dataLonga(x.publicado_em) + (/^(há|hoje|ontem)/.test(rel) && x.publicado_em.length > 10 ? ' (' + rel + ')' : '')];
      if (x.data_futura && x.data_edicao) p[0] = 'Detectado ' + dataLonga(x.publicado_em) + ' · a fonte data a edição de ' + dataLonga(x.data_edicao).replace(/ às .*/, '');
      if (x.data_e_atualizacao) p.push('a página não informa a data de publicação');
      else if (x.atualizado_em && x.atualizado_em.slice(0, 16) !== x.publicado_em.slice(0, 16)) p.push('atualizado ' + dataLonga(x.atualizado_em));
      if (!curtoTxt && x.detectado_em) p.push('detectado pelo robô ' + dataLonga(x.detectado_em));
      return p.join(' · ');
    }
    if (x.acervo) return 'Acervo: já estava na página quando o robô a leu pela primeira vez' + (x.referencia ? ' · refere-se a ' + x.referencia.slice(5, 7) + '/' + x.referencia.slice(0, 4) : '');
    return 'Sem data de publicação na fonte · detectado pelo robô ' + (x.detectado_em ? dataLonga(x.detectado_em) : '');
  }
  function nomeAtivo(t) { var c = typeof CORE !== 'undefined' && CORE.ATV ? CORE.ATV[t] : null; return c && c.nome ? c.nome : t; }
  function pesos(t) {
    var pw = A.pesosDoAtivo ? A.pesosDoAtivo(t) : []; if (!pw.length) return '';
    var mx = pw[0];
    return 'em ' + pw.length + (pw.length > 1 ? ' carteiras aprovadas' : ' carteira aprovada') + ', até ' + A.pct(mx.w, 1) + ' (' + mx.m.rotulo + ')';
  }
  // Por que merece atenção: só sinais verificáveis (tipo de documento, opinião publicada, resultado, outras fontes, fonte primária)
  function porQueImporta(x) {
    var out = [], d = I.diretos(x), org = x.organizacao || x.fonte, an = x.analise || {};
    if (x.categoria === 'oficial_empresa') out.push({r: 'fato', t: (x.tipo === 'fato_relevante' ? 'Fato relevante entregue pela própria companhia à CVM: por norma, informação que pode influir na cotação.' : 'Documento entregue pela própria companhia à CVM (' + (x.categoria_cvm || 'documento') + ').')});
    if (x.natureza === 'opiniao_casa') out.push({r: 'fonte', t: ((x.casas || []).length ? x.casas.join(', ') : 'Analistas não identificados') + (x.posicao ? ' em sentido ' + (x.posicao === 'favoravel' ? 'favorável' : x.posicao === 'contraria' ? 'contrário' : I.POSICAO[x.posicao]) : ', sem sentido explícito') + (d.length ? ' sobre ' + d.join(', ') : '') + (x.verificacao === 'pagina' ? ', conferido na página publicada por ' + org + '.' : x.pagina_lida_em && x.casa_fonte ? ', na página de research da própria casa (lida pelo robô).' : ', segundo o título publicado por ' + (x.via ? x.fonte : org) + '. O relatório da casa não foi lido.')});
    d.forEach(function (t) { if (I.vinculo(x, t).evento === 'resultado') out.push({r: 'sistema', t: 'Trata do resultado de ' + nomeAtivo(t) + ' (' + t + '), pela manchete.'}); });
    if (x.categoria === 'instituicao') out.push({r: 'fato', t: 'Fonte primária oficial: ' + org + '.'});
    if (/^gestora_/.test(x.categoria || '') && (x.tipo === 'carta' || x.tipo === 'research')) out.push({r: 'fonte', t: 'Visão própria da ' + org + ' (' + I.tipoNome(x.tipo).toLowerCase() + '), não notícia.'});
    if ((x.tambem_em || []).length) out.push({r: 'fato', t: 'Também publicado por ' + x.tambem_em.length + ' outra(s) fonte(s): ' + x.tambem_em.slice(0, 3).map(function (y) { return y.fonte; }).join(', ') + '.'});
    (an.porque || []).forEach(function (f) { out.push({r: 'ia', t: f.t}); });
    if (x.natureza === 'sensacionalista' || x.natureza === 'promocional') out.push({r: 'sistema', t: 'Título ' + x.natureza + ': confira na fonte antes de usar.'});
    if (x.via && x.confiavel === false) out.push({r: 'sistema', t: 'Veículo fora da lista de veículos conhecidos, achado pela busca do ' + x.via + ': confira na fonte.'});
    if (x.aviso_fonte) out.push({r: 'fato', t: 'Fonte sinalizada: ' + x.aviso_fonte + '.'});
    return out;
  }
  // Relação com a Oregon: ativo (direto ou de passagem, com os pesos aprovados), setor, tema de ETF e fatores — só o que tem base
  function relacaoOregon(x) {
    var out = [];
    (x.ativos || []).forEach(function (t) {
      var v = I.vinculo(x, t), p = pesos(t);
      var resto = (v.tipo === 'direto' ? 'empresa diretamente afetada — ' : 'menção incidental — ') + v.motivo + (p ? '; ' + p : '') + '.', nm = nomeAtivo(t);
      out.push({t: t, r: 'sistema', men: v.tipo !== 'direto', txt: (nm !== t ? nm + ' (' + t + ')' : t) + ': ' + resto, txtSem: (nm !== t ? nm + ': ' : '') + resto});
    });
    if ((x.setor_de || []).length) out.push({r: 'sistema', txt: 'Setor e cadeia' + (x.setor_nome ? ' (' + x.setor_nome + ')' : '') + ': hipótese de efeito sobre ' + x.setor_de.join(', ') + '; a notícia não cita a empresa.', ts: x.setor_de});
    var et = (x.etfs_tema || []).filter(function (t) { return (x.ativos || []).indexOf(t) < 0; });
    if (et.length) out.push({r: 'sistema', txt: 'Tema geral' + (x.tema_etf ? ' (' + x.tema_etf + ')' : '') + ': ' + et.join(', ') + ' — notícia do índice ou do tema, não fato do fundo.', ts: et});
    if ((x.fatores || []).length) out.push({r: 'sistema', txt: 'Fator de risco acompanhado: ' + x.fatores.map(I.fatorNome).join(', ') + ' (pelos termos do texto).'});
    return out;
  }
  // Para entender a relação: o mecanismo como a ficha verificada ou a tese interna o descrevem, o que se publica sobre a
  // relação (pesquisa feita pelo robô no Bing Notícias, com a data) e a pesquisa pronta no Google. Nada aqui é conclusão.
  var PERG = {selic: 'Como a Selic e os juros de curto prazo afetam', pre: 'Como a curva de juros prefixada afeta', real: 'Como o juro real (IPCA+) afeta', ust: 'Como os juros dos Treasuries afetam',
    usd: 'Como o dólar afeta', spread: 'Como o spread de crédito afeta', ibov: 'Como a bolsa brasileira afeta', sp: 'Como a bolsa americana afeta', em: 'Como os mercados emergentes afetam', brent: 'Como o petróleo afeta', btc: 'Como o bitcoin afeta'};
  function sensDe(t) { try { return (A.prem && A.prem().sens[t]) || null; } catch (e) { return null; } }
  function etfDe(t) { var C0 = typeof CORE !== 'undefined' ? CORE : null; return (C0 && C0.D && C0.D.etfs && C0.D.etfs[t]) || null; }
  A.perguntaRelacao = function (t, f) { var nm = nomeAtivo(t); return (PERG[f] || 'O que move') + ' ' + (nm !== t ? nm + ' (' + t + ')' : t) + '?'; };
  A.pesquisa = function (t, f) { var P = E.pesquisas && E.pesquisas.pares; return P ? P[t + '|' + f] || P[t + '|*'] || null : null; };
  function buscaGoogle(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }
  function buscaBing(q) { return 'https://www.bing.com/news/search?q=' + encodeURIComponent(q) + '&qft=sortbydate%3d%221%22'; }
  function entenderRelacao(x) {
    var C0 = typeof CORE !== 'undefined' ? CORE : null, ATV = (C0 && C0.ATV) || {};
    var t = I.diretos(x)[0] || (x.etfs_tema || [])[0] || (x.setor_de || [])[0] || null, f = null, linhas = [];
    if (t) {
      var sv = sensDe(t); f = sv && sv.f || (x.fatores || [])[0] || null;
      var e = etfDe(t), a = ATV[t] || {}, tx = A.teseDe ? A.teseDe(t) : null, T = tx && tx.tese;
      if (e && (e.objetivo || e.papel_na_carteira)) linhas.push(h('li', null, rotulo('fato'), ' ', h('b', null, 'Ficha verificada do ' + t + ': '), curto(e.papel_na_carteira || e.objetivo, 260)));
      else if (T && T.resumo) linhas.push(h('li', null, rotulo('sistema'), ' ', h('b', null, 'Tese Oregon (texto interno): '), curto(T.resumo, 240)));
      else if (a.motores) linhas.push(h('li', null, rotulo('sistema'), ' ', h('b', null, 'Drivers na tese interna: '), curto(a.motores.split(' · ').slice(0, 3).join('; '), 220)));
      if (f) linhas.push(h('li', null, rotulo('sistema'), ' ', h('b', null, 'Premissa interna de sensibilidade: '), I.fatorNome(f) + '. É hipótese de trabalho da carteira, não elasticidade medida.'));
    } else if ((x.fatores || []).length) {
      f = x.fatores[0];
      var sens = (A.prem && A.prem().sens) || {}, exp = Object.keys(sens).filter(function (k) { return sens[k] && sens[k].f === f && ATV[k] && ATV[k].status !== 'placeholder'; });
      if (exp.length) linhas.push(h('li', null, rotulo('sistema'), ' ', h('b', null, 'Ativos da carteira com premissa de sensibilidade a ' + I.fatorNome(f) + ': '), exp.slice(0, 8).map(function (k, i) { return h('span', null, i ? ', ' : '', h('button', {class: 'btn link', onclick: function () { fechar(); A.abrirFicha(k); }}, k)); }), exp.length > 8 ? ' e mais ' + (exp.length - 8) : ''));
      t = exp[0] || null;
    }
    if (!t && !f) return null;
    var q = t ? A.perguntaRelacao(t, f) : (PERG[f] || 'O que move') + ' a carteira?', pq = t ? A.pesquisa(t, f) : null;
    var box = h('div', {class: 'lr-rel'}, h('p', {class: 'lr-q'}, q));
    if (linhas.length) box.appendChild(h('ul', {class: 'lr-l'}, linhas));
    if (pq && (pq.itens || []).length) box.appendChild(h('div', null, h('p', {class: 'lr-sub'}, 'O que se publica sobre isso · pesquisa do robô em ' + (pq.provedor || 'Bing Notícias') + (pq.atualizado_em ? ', ' + I.horaAbs(pq.atualizado_em) : '') + ' (“' + pq.consulta + '”)'),
      h('ul', {class: 'lr-l refs'}, pq.itens.slice(0, 4).map(function (y) { var lk = A.link(y.link); return h('li', {class: 'lr-ref'}, y.publicado_em ? h('time', {class: 'nw-when'}, I.quando(y)) : null, ' ', lk ? h('a', {href: lk, target: '_blank', rel: 'noopener'}, y.titulo) : y.titulo, h('span', {class: 'muted'}, ' · ' + (y.fonte || '') + (y.cita === 'indice' ? ' · sobre o índice' : ''))); }))));
    box.appendChild(h('div', {class: 'lr-busca'}, h('a', {class: 'btn sm pri', href: buscaGoogle(q.replace(/\?$/, '')), target: '_blank', rel: 'noopener'}, 'Pesquisar no Google ↗'),
      h('a', {class: 'btn sm', href: buscaBing(t ? (nomeAtivo(t) !== t ? '"' + nomeAtivo(t) + '" ' : t + ' ') + (f ? I.fatorNome(f).split(' / ')[0] : '') : I.fatorNome(f)), target: '_blank', rel: 'noopener'}, 'Notícias no Bing ↗'),
      h('span', {class: 'muted lr-bnota'}, 'Abre fora do Oregon; os resultados não são verificados.')));
    return box;
  }
  // Contrapontos documentados: opiniões em sentido oposto sobre o mesmo ativo, ou contrapontos do próprio texto (IA). Nada genérico.
  function contrapontosDoc(x) {
    var out = [];
    if (I.diretos(x).length && (x.posicao === 'favoravel' || x.posicao === 'contraria')) {
      // só sentido oposto e de outra casa: a mesma casa noticiada por outro veículo, ou uma opinião "mista", não é contraponto
      var oposto = x.posicao === 'favoravel' ? 'contraria' : 'favoravel', c = I.contrapontos(A.itensAtivo ? A.itensAtivo() : [], x);
      c.itens.filter(function (y) { return y.posicao === oposto && !(y.casas || []).some(function (k) { return (x.casas || []).indexOf(k) >= 0; }); }).forEach(function (y) { out.push({item: y}); });
      return {itens: out, rot: 'Opiniões em sentido ' + (oposto === 'contraria' ? 'contrário' : 'favorável') + ' sobre ' + I.diretos(x).join(', ') + ', de outras casas:'};
    }
    ((x.analise || {}).contra_texto || []).forEach(function (f) { out.push({t: f.t}); });
    return {itens: out, rot: 'Contrapontos apresentados no próprio texto (leitura por IA):'};
  }
  function linhaRef(y) {
    var lk = A.link(y.link);
    return h('li', {class: 'lr-ref'}, h('time', {class: 'nw-when'}, I.quando(y)), ' ', h('button', {class: 'nwl', onclick: function () { A.abrirItem(y); }}, y.titulo),
      h('span', {class: 'muted'}, ' · ' + orgDe(y)), lk ? h('a', {class: 'nw-ext', href: lk, target: '_blank', rel: 'noopener', 'aria-label': 'Abrir a fonte'}, '↗') : null);
  }
  function visaoAnterior(x) {
    var d = I.diretos(x), casas = x.casas || [];
    if (!d.length || !casas.length) return null;
    var pub = I.pub(x);
    return (A.itensAtivo ? A.itensAtivo() : []).filter(function (y) {
      return y.id !== x.id && y.natureza === 'opiniao_casa' && I.pub(y) < pub && (y.casas || []).some(function (c) { return casas.indexOf(c) >= 0; }) && I.diretos(y).some(function (t) { return d.indexOf(t) >= 0; });
    }).sort(function (a, b) { return I.pub(b).localeCompare(I.pub(a)); })[0] || null;
  }
  function opiniaoView(x) {
    var linhas = [], ant = visaoAnterior(x);
    function li(k, v) { if (v) linhas.push(h('div', null, h('dt', null, k), h('dd', null, v))); }
    li('Casa', (x.casas || []).join(', ') || null);
    li('Analista', x.analista || null);
    li('Recomendação', x.recomendacao || null);
    li('Preço-alvo', x.preco_alvo ? x.preco_alvo + (x.horizonte ? ' · ' + x.horizonte : '') : null);
    li('Sentido', x.posicao ? I.POSICAO[x.posicao] + (x.recomendacao || x.verificacao === 'pagina' ? '' : ' (lido do título)') : null);
    li('Observação', x.nota_pesquisa || null);
    if (ant) li('Visão anterior', h('span', null, h('button', {class: 'nwl', onclick: function () { A.abrirItem(ant); }}, I.quando(ant)), ': ',
      [ant.recomendacao, ant.preco_alvo ? 'alvo ' + ant.preco_alvo : null].filter(Boolean).join(' · ') || (ant.posicao ? I.POSICAO[ant.posicao] : 'sem recomendação escrita'),
      (ant.recomendacao && x.recomendacao && ant.recomendacao !== x.recomendacao) || (ant.preco_alvo && x.preco_alvo && ant.preco_alvo !== x.preco_alvo) ? h('b', {class: 'lr-mud'}, ' · mudou') : null));
    if (!linhas.length) return null;
    return h('div', null, h('dl', {class: 'lr-dl'}, linhas), h('p', {class: 'lr-sub'}, x.verificacao === 'pagina' ? 'Conferido na página da fonte. Campos ausentes não estavam escritos.' : 'Campos ausentes não estavam escritos no título, no resumo ou na página da casa.'));
  }
  A.leituraView = function (x) {
    var lk = A.link(x.link), an = x.analise || {}, box = h('div', {class: 'lr'});
    var kick = x.categoria === 'oficial_empresa' ? 'Documento à CVM · ' + (x.categoria_cvm || I.tipoNome(x.tipo)) : x.natureza === 'opiniao_casa' ? 'Opinião publicada · ' + (I.CATEGORIA[x.categoria] || '') : I.tipoNome(x.tipo) + ' · ' + (I.CATEGORIA[x.categoria] || x.categoria || '');
    box.appendChild(h('p', {class: 'lr-k'}, kick));
    box.appendChild(h('h2', {class: 'lr-t'}, x.titulo));
    box.appendChild(h('p', {class: 'lr-m'}, h('b', null, orgDe(x)), x.autor && x.autor !== orgDe(x) ? ' · ' + x.autor : '', x.via ? h('span', {class: 'muted'}, ' · via ' + x.via) : null, h('br'),
      h('span', {class: x.publicado_em ? '' : 'lr-est'}, datasTxt(x))));
    var lido = A.lido(x.id), btL = h('button', {class: 'btn sm', onclick: async function () { await A.marcarLido(x, !A.lido(x.id)); btL.textContent = A.lido(x.id) ? 'Desmarcar leitura' : 'Marcar como lido'; }}, lido ? 'Desmarcar leitura' : 'Marcar como lido');
    var btS = h('button', {class: 'btn sm', onclick: async function () { await A.salvar(x, !A.salvo(x.id)); btS.textContent = A.salvo(x.id) ? 'Salvo para ler' : 'Ler depois'; }}, A.salvo(x.id) ? 'Salvo para ler' : 'Ler depois');
    box.appendChild(h('div', {class: 'lr-acts'}, lk ? h('a', {class: 'btn pri', href: lk, target: '_blank', rel: 'noopener'}, 'Abrir a fonte original ↗') : h('span', {class: 'muted'}, 'Item sem link válido.'),
      x.pdf && A.link(x.pdf) && x.pdf !== x.link ? h('a', {class: 'btn sm', href: A.link(x.pdf), target: '_blank', rel: 'noopener'}, 'PDF') : null, btS, A.botaoComite ? A.botaoComite(x) : null, btL));
    function sec(tit, rot, corpo, cls) { return h('section', {class: 'lr-s' + (cls ? ' ' + cls : '')}, h('h3', null, tit, rot ? rotulo(rot) : null), corpo); }
    // 0. opinião publicada: casa, analista, recomendação, preço-alvo e horizonte só quando escritos; mudança frente à visão anterior da mesma casa
    if (x.natureza === 'opiniao_casa') { var op = opiniaoView(x); if (op) box.appendChild(sec('Opinião publicada', 'fonte', op, 'lr-op')); }
    // 1. o que diz a fonte
    if ((an.resumo_ia || []).length) box.appendChild(sec('Resumo', 'ia', h('ul', {class: 'lr-l'}, an.resumo_ia.map(function (f) { return h('li', null, f.t); }))));
    else if (an.base === 'resumo' || (!an.v && x.resumo && x.resumo.length >= 40)) box.appendChild(sec('Resumo da fonte', 'fonte', h('p', {class: 'lr-r'}, curto(x.resumo, 420))));
    else box.appendChild(h('p', {class: 'lr-so'}, x.categoria === 'oficial_empresa' ? 'O robô registra o documento entregue à CVM, mas não lê o arquivo. O conteúdo está no link original.' : 'Só a manchete foi coletada: o robô não leu o texto. Para entender o fato, abra a fonte original.'));
    // 2. por que importa
    var pq = porQueImporta(x);
    if (pq.length) box.appendChild(sec('Por que importa', null, h('ul', {class: 'lr-l'}, pq.map(function (f) { return h('li', null, rotulo(f.r), ' ', f.t); }))));
    // 3. relação com a Oregon
    var rel = relacaoOregon(x), ent = entenderRelacao(x);
    if (rel.length || ent) box.appendChild(sec('Relação com a Oregon', null, h('div', null, rel.length ? h('ul', {class: 'lr-l'}, rel.map(function (r) {
      return h('li', {class: r.men ? 'men' : null}, rotulo(r.r), ' ', r.t ? h('button', {class: 'tag tk' + (r.men ? ' men' : ''), onclick: function () { fechar(); A.abrirFicha(r.t); }}, r.t) : null, r.t ? ' ' : null, r.t ? r.txtSem : r.txt);
    })) : null, ent)));
    // 4. contrapontos documentados (só quando existem)
    var ct = contrapontosDoc(x);
    if (ct.itens.length) box.appendChild(sec('Contrapontos documentados', ct.itens[0].item ? 'fonte' : 'ia', h('div', null, h('p', {class: 'lr-sub'}, ct.rot),
      h('ul', {class: 'lr-l refs'}, ct.itens.slice(0, 4).map(function (c) { return c.item ? linhaRef(c.item) : h('li', null, c.t); })))));
    // 5. aprofundar (recolhido)
    var fundo = h('div', {class: 'lr-fundo'});
    var mais = [], vis = {}; vis[x.id] = 1;
    I.diretos(x).slice(0, 2).forEach(function (t) { I.doAtivo(A.itens ? A.itens() : [], t).direto.forEach(function (y) { if (!vis[y.id] && mais.length < 5) { vis[y.id] = 1; mais.push(y); } }); });
    if (mais.length) fundo.appendChild(h('div', null, h('h4', null, 'Mais sobre ' + I.diretos(x).slice(0, 2).join(' e ')), h('ul', {class: 'lr-l refs'}, mais.map(linhaRef))));
    if (!I.diretos(x).length && !ct.itens.length) { var oc = I.contrapontos(A.itens ? A.itens() : [], x); if (oc.itens.length) fundo.appendChild(h('div', null, h('h4', null, 'Outras fontes sobre o tema'), h('p', {class: 'lr-sub'}, 'Mesmo tema nos 30 dias anteriores; se divergem, só a leitura dos textos dirá.'), h('ul', {class: 'lr-l refs'}, oc.itens.slice(0, 4).map(linhaRef)))); }
    if ((x.tambem_em || []).length) fundo.appendChild(h('div', null, h('h4', null, 'O mesmo fato em outras fontes'), h('ul', {class: 'lr-l'}, x.tambem_em.map(function (t) { return h('li', null, A.link(t.link) ? h('a', {href: A.link(t.link), target: '_blank', rel: 'noopener'}, t.fonte + ' ↗') : t.fonte); }))));
    var perg = (an.acompanhar_ia || []).length ? an.acompanhar_ia : (an.acompanhar || []);
    if (!perg.length) (x.temas || []).slice(0, 2).forEach(function (t) { (((I.TX.roteiro || {})[t] || {}).monitorar || []).slice(0, 2).forEach(function (q) { if (perg.indexOf(q) < 0) perg.push(q); }); });
    if (perg.length) fundo.appendChild(h('div', null, h('h4', null, 'Para verificar'), h('p', {class: 'lr-sub'}, 'Dados e eventos do roteiro do tema. São perguntas para você, não argumentos de nenhuma fonte.'), h('ul', {class: 'lr-l'}, perg.slice(0, 4).map(function (q) { return h('li', null, q); }))));
    if ((an.numeros || []).length) fundo.appendChild(h('p', {class: 'lr-sub'}, h('b', null, 'Números citados na manchete ou no resumo: '), an.numeros.join(' · ')));
    var cls = (x.temas || []).map(I.temaNome).concat((x.regioes || []).map(I.regiaoNome));
    fundo.appendChild(h('p', {class: 'lr-sub'}, h('b', null, 'Classificação do robô: '), (cls.join(', ') || 'sem tema identificado') + (x.prioridade ? ' · prioridade ' + x.prioridade.nivel + ' (' + x.prioridade.pontos + ' pontos: ' + (x.prioridade.porque || []).join('; ') + ')' : '') + '. A prioridade só ordena; nada é escondido.'));
    fundo.appendChild(h('div', null, h('h4', null, 'Anotar aprendizado'), A.formAprendizado(x)));
    box.appendChild(h('details', {class: 'lr-mais'}, h('summary', null, 'Aprofundar'), fundo));
    box.appendChild(h('p', {class: 'lr-nota'}, an.profunda ? 'Leitura por IA sobre o título e o resumo público, não sobre o texto completo.' : 'Leitura por regras sobre o título e o resumo público, sem acesso ao texto completo.',
      ' Rótulos: ', rotulo('fonte'), ' texto publicado · ', rotulo('fato'), ' coleta, CVM e carteiras · ', rotulo('sistema'), ' classificação automática.'));
    return box;
  };
  A.analiseView = A.leituraView;  // nome antigo (v3.2)
  function fechar() { var d = document.querySelector('.drawer'); if (d) d.remove(); }
  A.abrirItem = function (x) {
    var d = A.drawer(x.organizacao || x.fonte || 'Leitura', A.leituraView(x));
    d.classList.add('leitura');
    return d;
  };
  A.formAprendizado = function (x, existente) {
    var reg = existente || {tipo: 'aprendizado', nota: ''};
    var tipo = h('select', {class: 'inp'}, [['aprendizado', 'Aprendizado'], ['tese', 'Tese que quero acompanhar'], ['mudanca', 'Mudei de visão'], ['duvida', 'Dúvida para estudar']].map(function (o) { return h('option', {value: o[0], selected: reg.tipo === o[0] || null}, o[1]); }));
    var nota = h('textarea', {class: 'inp w', style: 'min-height:80px', placeholder: 'O que este conteúdo me ensinou, a premissa que ele assume, o que eu discordo…'}); nota.value = reg.nota || '';
    var onde = STORE.mode === 'db' ? 'no banco deste painel' : 'neste navegador (exporte em Biblioteca → Aprendizados para levar a outro aparelho)';
    return h('div', {class: 'form-ap'}, h('div', {class: 'row', style: 'gap:8px;flex-wrap:wrap'}, tipo, h('button', {class: 'btn pri', onclick: async function () {
      if (!nota.value.trim()) { A.toast('Escreva a nota antes de salvar.'); return; }
      await A.salvarAprendizado({id: reg.id, quando: reg.quando, item_id: x ? x.id : (reg.item_id || null), titulo: x ? x.titulo : reg.titulo, fonte: x ? (x.organizacao || x.fonte) : reg.fonte, link: x ? x.link : reg.link, temas: x ? x.temas : reg.temas, tipo: tipo.value, nota: nota.value});
      A.toast('Aprendizado salvo ' + onde + '.'); if (x) { try { await A.marcarLido(x, true); } catch (e) {} }
      var d = document.querySelector('.drawer'); if (d) d.remove(); A.rerender();
    }}, existente ? 'Salvar alteração' : 'Salvar no registro')), nota, h('p', {class: 'hint'}, 'Fica salvo ' + onde + '.'));
  };

  /* ---------- agenda (calendários oficiais: IBGE, Copom, Fed, Focus) ---------- */
  A.agendaView = function (max) {
    var ag = E.macro && E.macro.agenda, hoje = I.hojeBRT();
    if (!ag || !ag.itens) return h('p', {class: 'muted'}, E.carregando ? 'Buscando a agenda…' : 'Agenda não publicada pelo robô.');
    var vistos = {}, prox = ag.itens.filter(function (a) { if (a.data < hoje) return false; var k = a.evento || a.titulo || a.produto; if (vistos[k]) return false; vistos[k] = 1; return true; }).slice(0, max || 8);
    if (!prox.length) return h('p', {class: 'muted'}, 'Nada agendado nos próximos ' + ag.dias + ' dias nas fontes oficiais.');
    var dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    return h('ul', {class: 'agenda'}, prox.map(function (a) {
      var nome = a.evento || a.titulo || a.produto || 'Evento', d = new Date(a.data + 'T12:00:00Z');
      return h('li', {class: (a.data === hoje ? 'hoje ' : '') + 'ag-' + (a.tipo || '')}, h('div', {class: 'ag-d'}, h('b', null, A.dataBR(a.data).slice(0, 5)), h('small', null, (a.data === hoje ? 'hoje' : dias[d.getUTCDay()]) + (a.hora ? ' ' + a.hora : ''))),
        h('div', null, A.link(a.link) ? h('a', {href: A.link(a.link), target: '_blank', rel: 'noopener'}, nome) : nome, h('small', {class: 'muted', style: 'display:block'}, (a.fonte || '') + (a.previsto ? ' · data prevista' : ''))));
    }));
  };
  function hm(iso) { try { return new Date(iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}); } catch (e) { return ''; } }
  A.hm = hm;
  // Estado dos dados no topo: hora da última rodada e situação
  A.dadosPill = function () {
    var v = E.versao, abs = '', rel = '', cls, atras = false;
    if (!v) { abs = E.carregando ? 'buscando…' : 'sem dados'; cls = E.erro ? 'critico' : 'parcial'; }
    else { var idade = (Date.now() - new Date(v.gerado_em).getTime()) / 60000; abs = I.horaAbs(v.gerado_em); rel = I.quando({publicado_em: v.gerado_em}); cls = idade > 120 ? 'parcial' : 'completo'; atras = idade > 180; }
    return h('button', {class: 'dstat' + (atras ? ' atras' : ''), title: 'Última coleta concluída pelo robô' + (rel ? ' (' + rel + ')' : '') + '. Ele lê as fontes a cada 30 minutos, das 7h às 22h30 (não é tempo real). Toque para ver a coleta por fonte.', onclick: function () { A.go('bib', 'fontes'); }},
      h('i', {class: 'dot ' + cls}), h('span', {class: 'ds-l'}, v ? 'Coleta ' : ''), h('b', null, abs), rel ? h('span', {class: 'ds-r'}, ' · ' + rel) : null, atras ? h('span', {class: 'ds-a'}, ' · robô atrasado') : null);
  };
  // Faixa de aviso quando o robô novo ainda não rodou ou os dados não chegam
  A.intelFaixa = function () {
    if (E.versao && E.versao.produto === 'Oregon Intelligence') return null;
    if (E.versaoAntiga) return h('div', {class: 'alert warn'}, h('b', null, 'O robô publicado ainda é a versão anterior (cotações). '), 'O site mostra o que existe. Para ligar a coleta de conteúdo, atualize o arquivo .github/workflows/robo.yml no GitHub com o conteúdo de docs/workflow_robo.yml e rode “Oregon Intelligence” em Actions (docs/ATUALIZACAO.md).');
    if (E.erro) return h('div', {class: 'alert warn slim'}, h('b', null, 'Sem acesso aos dados do robô agora: '), E.erro + '. ' + (noClaude() ? 'Nesta visualização (claude.ai) o navegador pode não alcançar o site público; abra o painel em ' + SITE_PADRAO + '.' : 'As carteiras, fichas e teses abaixo não dependem dele.'));
    if (!E.versao && !E.carregando) return h('div', {class: 'alert warn slim'}, 'O robô ainda não publicou dados (primeira rodada pendente). Em Actions → Oregon Intelligence → Run workflow.');
    return null;
  };
})(typeof APP !== 'undefined' ? APP : null, typeof CORE !== 'undefined' ? CORE : null, INTEL);
