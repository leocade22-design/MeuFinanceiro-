/* TESTE DO LABORATÓRIO
   Abre o app de verdade e o laboratório no MESMO endereço (como no GitHub
   Pages, onde os dois dividem o armazenamento do navegador) e confere:
   1. isolamento: nada que se faz no laboratório toca as gavetas, o cache ou o
      service worker do app de verdade;
   2. a cópia de dados, que só vai de lá pra cá;
   3. a Fase 1 (orçamento e limites por mês).

   Rodar (da raiz do repositório):
       node lab/gerar-lab.js && node lab/testes/teste-laboratorio.js
   Precisa do Playwright; se ele não estiver no projeto, aponte a variável
   PLAYWRIGHT para a pasta dele. As fotos vão para lab/testes/fotos/. */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const RAIZ = path.join(__dirname, '..', '..');
const FOTOS = path.join(__dirname, 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FALHOU: ') + m); if (!c) falhas++; };
const secao = t => console.log('\n┌─ ' + t + ' ─┐');

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.pdf': 'application/pdf' };
function servir() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/MeuFinanceiro-/, '');
      let arq = path.join(RAIZ, caminho.endsWith('/') ? caminho + 'index.html' : caminho);
      if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { resp.writeHead(404); resp.end(); return; }
      resp.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
      fs.createReadStream(arq).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const srv = await servir();
  const BASE = `http://127.0.0.1:${srv.address().port}/MeuFinanceiro-/`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const erros = [];
  const abrir = async (url) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => erros.push(url + ': ' + e.message));
    p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForTimeout(900);
    return p;
  };
  const gavetasPrincipais = p => p.evaluate(() => {
    const o = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === 'valoresOcultos' || (k.startsWith('meu_financeiro_') && !k.startsWith('meu_financeiro_lab_'))) o[k] = localStorage.getItem(k);
    }
    return o;
  });

  /* ═══ O APP DE VERDADE, COM DADOS ═══ */
  const app = await abrir(BASE + 'index.html');
  console.log('app de verdade, versão', await app.evaluate(() => APP_VERSION));
  const datas = await app.evaluate(() => {
    const hoje = obterDataBrasilia();
    const mes = hoje.slice(0, 8);
    const ant = somarMeses(hoje, -1).slice(0, 8);
    contas = [{ id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5 }, { id: 'c2', nome: 'Carteira', temCredito: false }];
    salvarContas();
    lancamentos = [
      { id: 1, tipo: 'receita', descricao: 'Salário', valor: '5.000,00', data: mes + '01', conta: 'Itaú', formaModo: 'À Vista / Débito' },
      { id: 2, tipo: 'despesa', descricao: 'Mercado', valor: '410,00', data: mes + '02', conta: 'Itaú', formaModo: 'Crédito à Vista', categoria: 'Alimentação' },
      { id: 3, tipo: 'despesa', descricao: 'Show', valor: '450,00', data: mes + '03', conta: 'Itaú', formaModo: 'Pix', categoria: 'Lazer' },
      { id: 4, tipo: 'despesa', descricao: 'Uber', valor: '100,00', data: mes + '03', conta: 'Itaú', formaModo: 'Crédito à Vista', categoria: 'Transporte' },
      { id: 5, tipo: 'despesa', descricao: 'Mercado mês passado', valor: '300,00', data: ant + '10', conta: 'Itaú', formaModo: 'Pix', categoria: 'Alimentação' }
    ];
    salvarLocalStorage();
    orcamentosCategoria = { 'Alimentação': 500, 'Lazer': 300, 'Transporte': 400 };
    salvarOrcamentos();
    localStorage.setItem('meu_financeiro_lembretes', '1');   // não pode vir pro laboratório
    return { mes, ant };
  });
  await app.reload(); await app.waitForTimeout(1200);
  const antes = await gavetasPrincipais(app);
  const iguaisAoAntes = (agora) => {
    const dif = Object.keys(Object.assign({}, antes, agora)).filter(k => antes[k] !== agora[k]);
    dif.forEach(k => console.log('   DIFERENÇA em ' + k + ' | antes=' + String(antes[k]).slice(0, 150) + ' | agora=' + String(agora[k]).slice(0, 150)));
    return !dif.length;
  };
  console.log('gavetas do app de verdade:', Object.keys(antes).length);

  /* ═══ 1) PRIMEIRA VISITA AO LABORATÓRIO ═══ */
  secao('1) PRIMEIRA VISITA');
  const lab = await abrir(BASE + 'lab/index.html');
  await lab.waitForTimeout(800);
  const visita = await lab.evaluate(() => ({
    titulo: document.title,
    faixa: (document.getElementById('faixaLab') || {}).innerText || '',
    oferta: !document.getElementById('modalCopiaApp').classList.contains('escondido'),
    resumo: document.getElementById('resumoCopiaApp').innerText.replace(/\s+/g, ' '),
    cancelar: document.getElementById('btnCopiaCancelar').textContent,
    versao: document.getElementById('versaoApp').textContent,
    lancamentos: lancamentos.length
  }));
  console.log('  ', JSON.stringify(visita));
  ok(visita.titulo === 'Meu Financeiro LAB' && /LABORATÓRIO/.test(visita.faixa), 'título "Meu Financeiro LAB" e faixa LABORATÓRIO no topo');
  ok(visita.oferta && /5 lançamentos/.test(visita.resumo) && visita.cancelar === 'Começar vazio', 'na primeira visita oferece copiar os dados (5 lançamentos lá) ou começar vazio');
  ok(visita.lancamentos === 0 && /laboratório lab-.* · base /.test(visita.versao), 'laboratório começa vazio; Ajustes mostra a versão do laboratório e a base');
  await (await lab.$('#modalCopiaApp .modal-content')).screenshot({ path: path.join(FOTOS, 'lab_copiar.png') });

  /* ═══ 2) A CÓPIA SÓ VAI DE LÁ PRA CÁ ═══ */
  secao('2) COPIAR OS DADOS');
  await lab.click('#btnCopiaConfirmar');
  await lab.waitForTimeout(1500);
  const copia = await lab.evaluate(() => ({
    lancamentos: lancamentos.length, contas: contas.map(c => c.nome).join(','),
    metas: JSON.stringify(orcamentosCategoria),
    lembretes: localStorage.getItem('meu_financeiro_lab_lembretes'),
    oferta: !document.getElementById('modalCopiaApp').classList.contains('escondido')
  }));
  ok(copia.lancamentos === 5 && copia.contas === 'Itaú,Carteira', 'depois da cópia: os 5 lançamentos e as 2 contas');
  ok(copia.lembretes === null, 'lembretes NÃO vêm (o celular não avisa em dobro)');
  ok(!copia.oferta, 'depois da cópia a oferta não aparece de novo');
  await lab.screenshot({ path: path.join(FOTOS, 'lab_topo.png'), clip: { x: 0, y: 0, width: 412, height: 330 } });
  ok(iguaisAoAntes(await gavetasPrincipais(lab)), 'as gavetas do app de verdade continuam idênticas');

  /* ═══ 3) MEXER NO LABORATÓRIO NÃO TOCA O APP ═══ */
  secao('3) ISOLAMENTO');
  const escritas = await lab.evaluate(() => {
    const vistas = [];
    const set = Storage.prototype.setItem, rem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k, v) { vistas.push(k); return set.call(this, k, v); };
    Storage.prototype.removeItem = function (k) { vistas.push(k); return rem.call(this, k); };
    lancamentos.unshift({ id: 99, tipo: 'despesa', descricao: 'Teste do lab', valor: '1,00', data: obterDataBrasilia(), conta: 'Itaú', formaModo: 'Pix', categoria: 'Outros' });
    salvarLocalStorage(); atualizarTudo();
    alternarVisibilidade(); alternarVisibilidade();   // o olho, ida e volta
    aplicarTema('claro'); localStorage.setItem(CHAVE_TEMA, 'claro');
    Storage.prototype.setItem = set; Storage.prototype.removeItem = rem;
    return [...new Set(vistas)];
  }).catch(e => ['ERRO ' + e.message]);
  console.log('   gavetas gravadas:', escritas.join(', '));
  ok(escritas.length > 0 && escritas.every(k => k.startsWith('meu_financeiro_lab_')), 'tudo o que o laboratório grava tem o prefixo meu_financeiro_lab_');
  ok(iguaisAoAntes(await gavetasPrincipais(lab)), 'o app de verdade continua com os mesmos dados e o mesmo tema');
  const fonte = fs.readFileSync(path.join(RAIZ, 'lab', 'index.html'), 'utf8');
  ok(!/meu_financeiro_(?!lab_)/.test(fonte) && !/'valoresOcultos'/.test(fonte), 'lab/index.html não tem nenhum nome de gaveta do app de verdade');

  /* ═══ 4) SERVICE WORKER E CACHE SEPARADOS ═══ */
  secao('4) SERVICE WORKER E CACHE');
  const sw = await lab.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const regs = await navigator.serviceWorker.getRegistrations();
    return { escopos: regs.map(r => r.scope), caches: await caches.keys() };
  });
  console.log('  ', JSON.stringify(sw));
  ok(sw.escopos.some(e => /\/MeuFinanceiro-\/lab\/$/.test(e)) && sw.escopos.some(e => /\/MeuFinanceiro-\/$/.test(e)), 'dois service workers: o do app (/MeuFinanceiro-/) e o do laboratório (/lab/)');
  ok(sw.caches.some(c => c.startsWith('meu-financeiro-lab-')) && sw.caches.some(c => /^meu-financeiro-\d/.test(c)), 'dois caches com nomes diferentes');
  const depoisDeForcar = await (async () => {
    await lab.evaluate(() => { forcarAtualizacao(); });
    await lab.waitForTimeout(2500);
    return lab.evaluate(async () => ({ caches: await caches.keys(), escopos: (await navigator.serviceWorker.getRegistrations()).map(r => r.scope) }));
  })();
  ok(depoisDeForcar.caches.some(c => /^meu-financeiro-\d/.test(c)) && depoisDeForcar.escopos.some(e => /\/MeuFinanceiro-\/$/.test(e)),
    '"forçar atualização" no laboratório não apaga o cache nem o service worker do app');

  /* ═══ 5) FASE 1: METAS DO MÊS ═══ */
  secao('5) FASE 1 · CARD METAS DO MÊS');
  await lab.evaluate(() => {
    aplicarTema('escuro'); localStorage.setItem(CHAVE_TEMA, 'escuro');
    lancamentos = lancamentos.filter(l => l.id !== 99); salvarLocalStorage();
    const bt = [...document.querySelectorAll('.nav-tab')].find(x => (x.getAttribute('onclick') || '').includes('abaGraficos'));
    mudarAba('abaGraficos', bt);
    if (!secaoEstaAberta('metas')) alternarSecao('metas');
    atualizarResumoEGraficos();
  });
  const card = () => lab.evaluate(() => ({
    titulo: document.querySelector('[data-card="metas"] h3').textContent,
    resumo: document.getElementById('resumoMetas').textContent,
    box: document.getElementById('planoDoMesBox').innerText.replace(/\s+/g, ' '),
    linhas: [...document.querySelectorAll('#listaMetasCategoria .meta-item')].map(x => ({ cat: x.dataset.categoria, txt: x.innerText.replace(/\s+/g, ' '),
      cor: (x.querySelector('.meta-item-topo > span') || {}).style ? x.querySelector('.meta-item-topo > span').style.color : '' })),
    vig: planejamento.vigencias.map(v => v.desde + ':' + JSON.stringify(v.limites))
  }));
  let c1 = await card();
  console.log('   vigências:', JSON.stringify(c1.vig));
  ok(c1.titulo === 'Metas do mês', 'o card virou "Metas do mês"');
  ok(c1.vig.length === 1 && c1.vig[0].startsWith(datas.ant.slice(0, 7) + ':') && /Alimentação":500/.test(c1.vig[0]), 'as metas de antes viraram o plano inicial, valendo desde o lançamento mais antigo');
  const corDe = cat => (c1.linhas.find(l => l.cat === cat) || {}).cor;
  console.log('   ', c1.linhas.map(l => l.txt).join(' | '));
  ok(corDe('Lazer') === 'var(--vermelho)' && corDe('Alimentação') === 'var(--amarelo)' && corDe('Transporte') === 'var(--verde)',
    'cores: Lazer 150% vermelho · Alimentação 82% amarelo (aviso em 80%) · Transporte 25% verde');
  ok(/passou R\$ 150,00/.test(c1.linhas.find(l => l.cat === 'Lazer').txt) && /faltam R\$ 90,00/.test(c1.linhas.find(l => l.cat === 'Alimentação').txt), 'cada limite diz quanto falta ou quanto passou');
  ok(/Orçamento R\$ 960,00 de R\$ 1\.200,00/.test(c1.box) && /teto = soma dos limites de 3 categorias/.test(c1.box), 'sem orçamento digitado, o teto é a soma dos limites (R$ 1.200)');

  secao('6) FASE 1 · PLANEJAR O MÊS');
  await lab.evaluate(() => {
    abrirPlanejarMes();
    setModoRendaPlano('digitada');
    document.getElementById('planoRendaValor').value = 'R$ 5.000,00';
    document.getElementById('planoGastoTotal').value = 'R$ 3.000,00';
    previaPlanoMes();
  });
  const previa = await lab.evaluate(() => document.getElementById('previaPlanoMes').innerText);
  ok(/Vale para .* e os próximos meses/.test(previa), 'a janela avisa: vale para este mês e os próximos');
  await (await lab.$('#modalPlanejarMes .modal-content')).screenshot({ path: path.join(FOTOS, 'lab_planejar.png') });
  await lab.evaluate(() => salvarPlanoMes());
  c1 = await card();
  console.log('   ', c1.box.slice(0, 220));
  ok(/Orçamento R\$ 960,00 de R\$ 3\.000,00/.test(c1.box) && /Renda do mês \(digitada\) R\$ 5\.000,00/.test(c1.box), 'orçamento R$ 3.000 e renda digitada R$ 5.000');
  await lab.evaluate(() => document.querySelector('[data-card="metas"]').scrollIntoView());
  await (await lab.$('[data-card="metas"]')).screenshot({ path: path.join(FOTOS, 'lab_metas_do_mes.png') });

  secao('7) FASE 1 · O QUE CONTA COMO GASTO');
  const regras = await lab.evaluate(({ mes }) => {
    const ch = obterDataBrasilia().slice(0, 7);
    const antes = gastoDoOrcamento(ch);
    // aporte, consórcio e um reembolso já recebido
    investimentos.push({ id: 'i1', valor: '1.000,00', origem: 'Itaú', tipoAtivo: 'Tesouro Direto', data: mes + '04', lancamentoId: 50 });
    lancamentos.push({ id: 50, tipo: 'despesa', descricao: 'Aporte', valor: '1.000,00', data: mes + '04', conta: 'Itaú', formaModo: 'Pix', categoria: 'Investimento', aporteId: 'i1' });
    consorcios.push({ id: 'k1', nome: 'Consórcio', fixoId: 'f-k1', valorParcela: '394,78' });
    lancamentos.push({ id: 51, tipo: 'despesa', descricao: 'Consórcio', valor: '394,78', data: mes + '05', conta: 'Itaú', formaModo: 'Pix', categoria: 'Outros', fixoId: 'f-k1' });
    const comInvest = gastoDoOrcamento(ch);
    lancamentos.push({ id: 52, tipo: 'despesa', descricao: 'Jantar com o Borges', valor: '200,00', data: mes + '05', conta: 'Itaú', formaModo: 'Pix', categoria: 'Alimentação',
      emprestimoPara: 'Borges', emprestimoRateio: [{ nome: 'Borges', valor: '100,00', quitado: true }], emprestimoVence: mes + '20' });
    const comJantar = gastoDoOrcamento(ch);
    const liquidoJantar = valorLiquidoDespesa(lancamentos.find(l => l.id === 52));
    // renda somada das receitas: reembolso, empréstimo recebido e estorno ficam de fora
    lancamentos.push({ id: 53, tipo: 'receita', descricao: 'Borges me pagou', valor: '100,00', data: mes + '06', conta: 'Itaú', formaModo: 'Pix', reembolsoDe: 52 });
    lancamentos.push({ id: 54, tipo: 'receita', descricao: 'Mãe me emprestou', valor: '300,00', data: mes + '06', conta: 'Itaú', formaModo: 'Pix', emprestimoPara: 'Mãe', emprestimoTipo: 'direto' });
    lancamentos.push({ id: 55, tipo: 'receita', descricao: 'Ajuste de fatura — estorno', valor: '20,00', data: mes + '01', conta: 'Itaú', formaModo: 'Crédito à Vista', ajusteFatura: true });
    lancamentos.push({ id: 56, tipo: 'receita', descricao: 'Freela', valor: '800,00', data: mes + '07', conta: 'Itaú', formaModo: 'Pix' });
    const renda = rendaSomadaDasReceitas(ch);
    salvarLocalStorage(); salvarInvest(); salvarConsorcios();
    return { antes, comInvest, comJantar, liquidoJantar, renda };
  }, datas);
  console.log('   ', JSON.stringify(regras));
  ok(Math.abs(regras.comInvest - regras.antes) < 0.001, 'aporte (R$ 1.000) e parcela de consórcio (R$ 394,78) não entram no gasto do orçamento');
  ok(Math.abs(regras.comJantar - regras.antes - 100) < 0.001 && Math.abs(regras.liquidoJantar - 100) < 0.001, 'jantar de R$ 200 meio a meio, Borges já pagou: entram só os R$ 100 que são seus');
  ok(Math.abs(regras.renda - 5800) < 0.001, 'renda somada: salário + freela = R$ 5.800 (sem reembolso, empréstimo nem estorno)');

  secao('8) FASE 1 · HISTÓRICO POR MÊS');
  const hist = await lab.evaluate(() => {
    const atual = chaveDoMesAtual(), ant = deslocarChaveMes(atual, -1);
    // muda o limite de Lazer só a partir deste mês
    mesMetasOffset = 0; gravarLimite('Lazer', 600);
    const r1 = { atual: planoDoMes(atual).limites['Lazer'], ant: planoDoMes(ant).limites['Lazer'] };
    // corrige o mês passado: o atual não pode mudar junto
    mesMetasOffset = -1; gravarLimite('Transporte', 250);
    const r2 = { ant: planoDoMes(ant).limites['Transporte'], atual: planoDoMes(atual).limites['Transporte'], lazerAnt: planoDoMes(ant).limites['Lazer'] };
    // tirar um limite não apaga lançamento
    const qtd = lancamentos.length;
    mesMetasOffset = 0; gravarLimite('Alimentação', 0);
    const r3 = { semLimite: planoDoMes(atual).limites['Alimentação'] === undefined, antTem: planoDoMes(ant).limites['Alimentação'], lancamentos: lancamentos.length === qtd };
    const espelho = JSON.stringify(orcamentosCategoria);
    mesMetasOffset = 0; renderizarMetasCategorias();
    return { r1, r2, r3, espelho, vig: planejamento.vigencias.map(v => v.desde) };
  });
  console.log('   ', JSON.stringify(hist));
  ok(hist.r1.atual === 600 && hist.r1.ant === 300, 'limite novo de Lazer vale deste mês em diante; o mês passado continua com R$ 300');
  ok(hist.r2.ant === 250 && hist.r2.atual === 400 && hist.r2.lazerAnt === 300, 'corrigir o mês passado não muda este mês');
  ok(hist.r3.semLimite && hist.r3.antTem === 500 && hist.r3.lancamentos, 'tirar o limite de Alimentação: some daqui pra frente, fica no passado, e nenhum lançamento é apagado');
  ok(hist.espelho === JSON.stringify({ Transporte: 400, Lazer: 600 }) || hist.espelho === JSON.stringify({ Lazer: 600, Transporte: 400 }), 'as "metas" que o resto do app lê espelham o mês atual');

  secao('9) FASE 1 · QUANTO POSSO GASTAR, BACKUP E RENOMEAR');
  const extra = await lab.evaluate(() => {
    const resposta = quantoPossoGastar().replace(/<[^>]+>/g, '');
    const payload = {}; labAoExportar(payload);
    const temPlano = !!(payload.planejamento && payload.planejamento.vigencias.length);
    const copia = JSON.parse(JSON.stringify(payload.planejamento));
    labAoImportar({ orcamentosCategoria: { 'Saúde': 200 } });
    const deBackupAntigo = planejamento.vigencias.map(v => JSON.stringify(v.limites));
    labAoImportar({ planejamento: copia });
    const voltou = planejamento.vigencias.length === copia.vigencias.length;
    labAoRenomearCategoria('Lazer', 'Diversão');
    const renomeou = planejamento.vigencias.every(v => v.limites['Lazer'] === undefined) && planejamento.vigencias.some(v => v.limites['Diversão'] === 600);
    return { resposta, temPlano, deBackupAntigo, voltou, renomeou };
  });
  console.log('   ', extra.resposta);
  ok(/de R\$ 3\.000,00 \(seu orçamento do mês é isso\)/.test(extra.resposta), '"Quanto posso gastar" usa o orçamento de R$ 3.000');
  ok(extra.temPlano && extra.voltou, 'o backup leva o planejamento e traz de volta');
  ok(extra.deBackupAntigo.length === 1 && extra.deBackupAntigo[0] === '{"Saúde":200}', 'backup antigo (sem planejamento) vira plano a partir das metas dele');
  ok(extra.renomeou, 'renomear a categoria leva os limites junto, em todos os meses');
  const ganchos = ['labAoExportar', 'labAoImportar', 'labAoRenomearCategoria'].every(g => fonte.includes('window.' + g + '('));
  ok(ganchos, 'os três ganchos estão no lab/index.html gerado');

  /* ═══ 10) O APP DE VERDADE CONTINUA IGUAL ═══ */
  secao('10) APP DE VERDADE');
  await app.reload(); await app.waitForTimeout(1200);
  const final = await app.evaluate(() => ({ lanc: lancamentos.length, titulo: document.title,
    metas: document.querySelector('[data-card="metas"] h3').textContent, temPlano: typeof planejamento !== 'undefined' }));
  ok(final.lanc === 5 && final.titulo === 'Meu Financeiro' && final.metas === 'Metas por categoria' && !final.temPlano, 'o app de verdade abre igual: 5 lançamentos, "Metas por categoria", sem nada da Fase 1');
  ok(iguaisAoAntes(await gavetasPrincipais(app)), 'e as gavetas dele estão exatamente como antes');

  console.log('\nerros de js:', erros.length ? erros : 'nenhum'); if (erros.length) falhas++;
  console.log(falhas ? `\n✘ ${falhas} FALHA(S)` : '\n✔ tudo certo');
  await b.close(); srv.close();
  process.exit(falhas ? 1 : 0);
})();
