/* PLANEJAMENTO DO MÊS — o card "Metas do mês" dos Gráficos e a janela
   "Planejar o mês": as metas de antes viram o plano, as cores pelo aviso, o
   orçamento digitado ou somado dos limites, o que conta como gasto (sem aporte
   nem consórcio, com reembolso descontado), a renda, o histórico mês a mês, o
   backup, renomear e apagar categoria. No fim, a limpeza do que o antigo
   laboratório (/lab/) deixou no aparelho. */
const { iniciar } = require('./ajuda');
const fs = require('fs');

iniciar('11 · planejamento do mês', async t => {
  const p = await t.abrir();
  await p.evaluate(() => __semear({
    contas: [{ id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5 }, { id: 'c2', nome: 'Carteira', temCredito: false }],
    lancamentos: [
      { id: 1, tipo: 'receita', descricao: 'Salário', valor: '5.000,00', data: __mes(0, 1), conta: 'Itaú', formaModo: 'À Vista / Débito' },
      { id: 2, tipo: 'despesa', descricao: 'Mercado', valor: '410,00', data: __mes(0, 2), conta: 'Itaú', formaModo: 'Crédito à Vista', categoria: 'Alimentação' },
      { id: 3, tipo: 'despesa', descricao: 'Show', valor: '450,00', data: __mes(0, 3), conta: 'Itaú', formaModo: 'Pix', categoria: 'Lazer' },
      { id: 4, tipo: 'despesa', descricao: 'Uber', valor: '100,00', data: __mes(0, 3), conta: 'Itaú', formaModo: 'Crédito à Vista', categoria: 'Transporte' },
      { id: 5, tipo: 'despesa', descricao: 'Mercado mês passado', valor: '300,00', data: __mes(-1, 10), conta: 'Itaú', formaModo: 'Pix', categoria: 'Alimentação' }
    ],
    metas: { 'Alimentação': 500, 'Lazer': 300, 'Transporte': 400 }
  }));
  await t.recarregar(p);
  await p.evaluate(() => {
    __aba('abaGraficos');
    if (!secaoEstaAberta('metas')) alternarSecao('metas');
  });
  const card = () => p.evaluate(() => ({
    titulo: document.querySelector('[data-card="metas"] h3').textContent,
    resumo: document.getElementById('resumoMetas').textContent,
    box: __texto('#planoDoMesBox'),
    linhas: [...document.querySelectorAll('#listaMetasCategoria .meta-item')].map(x => ({
      cat: x.dataset.categoria, txt: x.innerText.replace(/\s+/g, ' '),
      cor: x.querySelector('.meta-item-topo > span').style.color })),
    vig: planejamento.vigencias.map(v => v.desde + ':' + JSON.stringify(v.limites))
  }));

  t.secao('AS METAS DE ANTES VIRAM O PLANO');
  let c = await card();
  console.log('   vigências:', JSON.stringify(c.vig));
  const mesPassado = await p.evaluate(() => __chaveMes(-1));
  t.ok(c.titulo === 'Metas do mês', 'o card se chama "Metas do mês"');
  t.ok(c.vig.length === 1 && c.vig[0].startsWith(mesPassado + ':') && /"Alimentação":500/.test(c.vig[0]),
    'as metas por categoria viraram o plano, valendo desde o mês do lançamento mais antigo');
  const corDe = cat => (c.linhas.find(l => l.cat === cat) || {}).cor;
  console.log('   ' + c.linhas.map(l => l.txt).join(' | '));
  t.ok(corDe('Lazer') === 'var(--vermelho)' && corDe('Alimentação') === 'var(--amarelo)' && corDe('Transporte') === 'var(--verde)',
    'cores: Lazer 150% vermelho · Alimentação 82% amarelo (aviso em 80%) · Transporte 25% verde');
  t.ok(/passou R\$ 150,00/.test(c.linhas.find(l => l.cat === 'Lazer').txt) && /faltam R\$ 90,00/.test(c.linhas.find(l => l.cat === 'Alimentação').txt),
    'cada limite diz quanto falta ou quanto passou');
  t.ok(/Orçamento R\$ 960,00 de R\$ 1\.200,00/.test(c.box) && /teto = soma dos limites de 3 categorias/.test(c.box),
    'sem orçamento digitado, o teto é a soma dos limites (R$ 1.200)');
  t.ok(/^80% do orçamento · 1 estourou$/.test(c.resumo), 'fechado, o card resume: ' + c.resumo);
  t.ok(await p.evaluate(() => JSON.stringify(orcamentosCategoria) === JSON.stringify(planoDoMes(chaveDoMesAtual()).limites)),
    'as metas que o resto do app lê espelham os limites deste mês');

  t.secao('PLANEJAR O MÊS');
  const janela = await p.evaluate(() => {
    abrirPlanejarMes();
    const titulo = __texto('#tituloPlanejarMes');
    setModoRendaPlano('digitada');
    document.getElementById('planoRendaValor').value = '';
    previaPlanoMes();
    const semRenda = __texto('#previaPlanoMes');
    document.getElementById('planoRendaValor').value = 'R$ 5.000,00';
    document.getElementById('planoGastoTotal').value = 'R$ 3.000,00';
    previaPlanoMes();
    return { titulo, semRenda, previa: __texto('#previaPlanoMes'), aviso: document.getElementById('planoAviso').value };
  });
  t.ok(/^Planejar \S+$/.test(janela.titulo) && janela.aviso === '80', 'a janela abre com o nome do mês e o aviso padrão em 80%');
  t.ok(/Digite quanto entra no mês/.test(janela.semRenda), '"Digitar" a renda sem valor não deixa salvar');
  t.ok(/Vale para .* e os próximos meses/.test(janela.previa), 'a janela avisa: vale para este mês e os próximos');
  await t.foto(p, 'planejar_mes.png', '#modalPlanejarMes .modal-content');
  await p.evaluate(() => salvarPlanoMes());
  c = await card();
  console.log('   ' + c.box.slice(0, 200));
  t.ok(/Orçamento R\$ 960,00 de R\$ 3\.000,00/.test(c.box) && /Renda do mês \(digitada\) R\$ 5\.000,00/.test(c.box), 'orçamento de R$ 3.000 e renda digitada de R$ 5.000');
  await p.evaluate(() => document.querySelector('[data-card="metas"]').scrollIntoView());
  await t.foto(p, 'metas_do_mes.png', '[data-card="metas"]');
  const resumos = await p.evaluate(() => {
    const guardado = JSON.stringify(planejamento);
    const resumoCom = vigencias => { planejamento = { vigencias }; renderizarMetasCategorias(); return __texto('#resumoMetas'); };
    const r = {
      soRenda: resumoCom([{ desde: chaveDoMesAtual(), renda: { modo: 'digitada', valor: 4000 }, gastoTotal: null, aviso: 80, limites: {} }]),
      nada: resumoCom([]),
      vazio: __texto('#planoDoMesBox')
    };
    planejamento = JSON.parse(guardado); renderizarMetasCategorias();
    return r;
  });
  t.ok(resumos.soRenda === 'renda R$ 4.000,00' && resumos.nada === 'nada planejado' && /Nada planejado ainda para/.test(resumos.vazio),
    'só com a renda, o card fechado mostra a renda; sem nada, "nada planejado"');

  t.secao('O QUE CONTA COMO GASTO');
  const regras = await p.evaluate(() => {
    const ch = chaveDoMesAtual();
    const antes = gastoDoOrcamento(ch);
    // um aporte, uma parcela de consórcio e um jantar rateado que o Borges já pagou
    investimentos.push({ id: 'i1', valor: '1.000,00', origem: 'Itaú', tipoAtivo: 'Tesouro Direto', data: __mes(0, 4), lancamentoId: 50 });
    lancamentos.push({ id: 50, tipo: 'despesa', descricao: 'Aporte', valor: '1.000,00', data: __mes(0, 4), conta: 'Itaú', formaModo: 'Pix', categoria: 'Investimento', aporteId: 'i1' });
    consorcios.push({ id: 'k1', nome: 'Consórcio', fixoId: 'f-k1', valorParcela: '394,78' });
    lancamentos.push({ id: 51, tipo: 'despesa', descricao: 'Consórcio', valor: '394,78', data: __mes(0, 5), conta: 'Itaú', formaModo: 'Pix', categoria: 'Outros', fixoId: 'f-k1' });
    const comInvest = gastoDoOrcamento(ch);
    lancamentos.push({ id: 52, tipo: 'despesa', descricao: 'Jantar com o Borges', valor: '200,00', data: __mes(0, 5), conta: 'Itaú', formaModo: 'Pix', categoria: 'Alimentação',
      emprestimoPara: 'Borges', emprestimoRateio: [{ nome: 'Borges', valor: '100,00', quitado: true }], emprestimoVence: __mes(0, 20) });
    const comJantar = gastoDoOrcamento(ch);
    // renda somada das receitas: reembolso, empréstimo recebido e estorno ficam de fora
    lancamentos.push({ id: 53, tipo: 'receita', descricao: 'Borges me pagou', valor: '100,00', data: __mes(0, 6), conta: 'Itaú', formaModo: 'Pix', reembolsoDe: 52 });
    lancamentos.push({ id: 54, tipo: 'receita', descricao: 'Mãe me emprestou', valor: '300,00', data: __mes(0, 6), conta: 'Itaú', formaModo: 'Pix', emprestimoPara: 'Mãe', emprestimoTipo: 'direto' });
    lancamentos.push({ id: 55, tipo: 'receita', descricao: 'Ajuste de fatura — estorno', valor: '20,00', data: __mes(0, 1), conta: 'Itaú', formaModo: 'Crédito à Vista', ajusteFatura: true });
    lancamentos.push({ id: 56, tipo: 'receita', descricao: 'Freela', valor: '800,00', data: __mes(0, 7), conta: 'Itaú', formaModo: 'Pix' });
    salvarLocalStorage(); salvarInvest(); salvarConsorcios();
    // a renda passa a ser somada das receitas
    abrirPlanejarMes(); setModoRendaPlano('receitas');
    const dica = __texto('#dicaRendaReceitas');
    salvarPlanoMes();
    return { antes, comInvest, comJantar, renda: rendaSomadaDasReceitas(ch), dica, box: __texto('#planoDoMesBox') };
  });
  console.log('   ', JSON.stringify({ antes: regras.antes, comInvest: regras.comInvest, comJantar: regras.comJantar, renda: regras.renda }));
  t.ok(Math.abs(regras.comInvest - regras.antes) < 0.001, 'aporte (R$ 1.000) e parcela de consórcio (R$ 394,78) não entram no gasto do orçamento');
  t.ok(Math.abs(regras.comJantar - regras.antes - 100) < 0.001, 'jantar de R$ 200 meio a meio, o Borges já pagou: entram só os R$ 100 que são seus');
  t.ok(Math.abs(regras.renda - 5800) < 0.001 && /Até agora: R\$ 5\.800,00/.test(regras.dica), 'renda somada: salário + freela = R$ 5.800 (sem reembolso, empréstimo nem estorno)');
  t.ok(/Renda do mês \(somada das receitas\) R\$ 5\.800,00/.test(regras.box) && /Orçamento R\$ 1\.060,00 de R\$ 3\.000,00/.test(regras.box),
    'o card mostra a renda somada e o orçamento com o jantar líquido (R$ 1.060)');

  t.secao('HISTÓRICO MÊS A MÊS');
  const hist = await p.evaluate(() => {
    const atual = chaveDoMesAtual(), ant = deslocarChaveMes(atual, -1);
    // muda o limite de Lazer só a partir deste mês, pela janela do limite
    mesMetasOffset = 0; abrirEdicaoMeta('Lazer');
    const titulo = __texto('#tituloEdicaoMeta'), dica = __texto('#dicaEdicaoMeta');
    document.getElementById('inputEdicaoMeta').value = '600'; confirmarEdicaoMeta();
    const r1 = { atual: planoDoMes(atual).limites['Lazer'], ant: planoDoMes(ant).limites['Lazer'] };
    // corrige o mês passado: este mês não pode mudar junto
    mudarMesMetas(-1); abrirEdicaoMeta('Transporte');
    const dicaPassado = __texto('#dicaEdicaoMeta');
    document.getElementById('inputEdicaoMeta').value = '250'; confirmarEdicaoMeta();
    const r2 = { ant: planoDoMes(ant).limites['Transporte'], atual: planoDoMes(atual).limites['Transporte'], lazerAnt: planoDoMes(ant).limites['Lazer'] };
    const passado = { box: __texto('#planoDoMesBox') };
    // tirar um limite não apaga lançamento
    mudarMesMetas(1);
    const qtd = lancamentos.length;
    abrirEdicaoMeta('Alimentação'); removerMetaEditando();
    const r3 = { semLimite: planoDoMes(atual).limites['Alimentação'] === undefined, antTem: planoDoMes(ant).limites['Alimentação'], lancamentos: lancamentos.length === qtd };
    // o mês que vem, e não passa de um mês à frente
    mudarMesMetas(1); mudarMesMetas(1); mudarMesMetas(1);
    const futuro = { offset: mesMetasOffset, box: __texto('#planoDoMesBox'), travado: document.querySelector('#planoDoMesBox [aria-label="Próximo mês"]').disabled };
    mesMetasOffset = 0; renderizarMetasCategorias();
    return { titulo, dica, dicaPassado, r1, r2, r3, passado, futuro, espelho: orcamentosCategoria };
  });
  console.log('   ', JSON.stringify({ r1: hist.r1, r2: hist.r2, r3: hist.r3, espelho: hist.espelho }));
  t.ok(/^Lazer · \S+$/.test(hist.titulo) && /e os próximos meses/.test(hist.dica), 'a janela do limite diz o mês e até onde vale');
  t.ok(hist.r1.atual === 600 && hist.r1.ant === 300, 'o limite novo de Lazer vale deste mês em diante; o mês passado continua com R$ 300');
  t.ok(hist.r2.ant === 250 && hist.r2.atual === 400 && hist.r2.lazerAnt === 300 && /Vale só para/.test(hist.dicaPassado), 'corrigir o mês passado não muda este mês');
  t.ok(/já fechou/.test(hist.passado.box) && /fechou R\$ 750,00 abaixo do orçamento/.test(hist.passado.box),
    'o mês passado aparece fechado: limites de R$ 1.050, gastou R$ 300 → R$ 750 abaixo');
  t.ok(hist.r3.semLimite && hist.r3.antTem === 500 && hist.r3.lancamentos, 'tirar o limite de Alimentação: some daqui pra frente, fica no passado, e nenhum lançamento é apagado');
  t.ok(hist.futuro.offset === 1 && hist.futuro.travado && /planejando à frente/.test(hist.futuro.box) && /o mês ainda não começou/.test(hist.futuro.box),
    'dá pra planejar o mês que vem, e não mais longe que isso');
  t.ok(JSON.stringify(Object.keys(hist.espelho).sort()) === '["Lazer","Transporte"]' && hist.espelho.Lazer === 600, 'o espelho acompanha: Lazer R$ 600 e Transporte R$ 400');

  t.secao('QUANTO POSSO GASTAR');
  const pode = await p.evaluate(() => { const s = semAcento('quanto posso gastar'); return montarRespostaPergunta(s, periodoDaPergunta(s)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); });
  console.log('   ' + pode);
  t.ok(/Gastou R\$ 1\.060,00 de R\$ 3\.000,00 \(seu orçamento do mês é isso\)/.test(pode) && /Aportes e consórcio ficam fora/.test(pode),
    '"quanto posso gastar" usa o orçamento de R$ 3.000, sem aporte nem consórcio');

  t.secao('BACKUP');
  await p.evaluate(() => { window.showSaveFilePicker = undefined; navigator.canShare = undefined; });
  const [download] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportarBackup())]);
  const texto = fs.readFileSync(await download.path(), 'utf8');
  const backup = JSON.parse(texto);
  const antes = await p.evaluate(() => JSON.stringify(planejamento));
  t.ok(backup.planejamento && JSON.stringify(backup.planejamento) === antes, 'o backup leva o planejamento inteiro');
  const importar = (conteudo) => p.evaluate(tx => importarBackup({ target: { files: [new File([tx], 'b.json', { type: 'application/json' })], value: 'x' } }), conteudo);
  await p.evaluate(() => localStorage.clear());
  await t.recarregar(p);
  await importar(texto);
  await p.waitForTimeout(800);
  t.ok(await p.evaluate(a => JSON.stringify(planejamento) === a && localStorage.getItem('meu_financeiro_planejamento_v1') === a, antes), 'e traz de volta, gravado no aparelho');
  const antigo = Object.assign({}, backup, { orcamentosCategoria: { 'Saúde': 200 } });
  delete antigo.planejamento;
  await importar(JSON.stringify(antigo));
  await p.waitForTimeout(800);
  const doAntigo = await p.evaluate(() => planejamento.vigencias.map(v => JSON.stringify(v.limites)));
  t.ok(doAntigo.length === 1 && doAntigo[0] === '{"Saúde":200}', 'backup antigo (sem planejamento) vira plano a partir das metas dele');
  await importar(texto);
  await p.waitForTimeout(800);

  t.secao('RENOMEAR E APAGAR CATEGORIA');
  const cats = await p.evaluate(() => {
    editarCategoria(categorias.indexOf('Lazer'));
    document.getElementById('nomeCategoria').value = 'Diversão';
    salvarCategoria();
    fecharModal('modalFormCategoria');
    const renomeou = planejamento.vigencias.every(v => v.limites['Lazer'] === undefined) && planejamento.vigencias.some(v => v.limites['Diversão'] === 600)
      && planejamento.vigencias.some(v => v.limites['Diversão'] === 300);
    const atual = chaveDoMesAtual(), ant = deslocarChaveMes(atual, -1);
    excluirCategoria(categorias.indexOf('Transporte'));
    document.getElementById('destinoExcluirCategoria').value = '';   // "não mover"
    confirmarExclusaoCategoria();
    return { renomeou, espelho: orcamentosCategoria['Diversão'],
      agora: planoDoMes(atual).limites['Transporte'], antes: planoDoMes(ant).limites['Transporte'],
      uber: (lancamentos.find(l => l.id === 4) || {}).categoria };
  });
  t.ok(cats.renomeou && cats.espelho === 600, 'renomear Lazer → Diversão leva os limites junto, em todos os meses');
  t.ok(cats.agora === undefined && cats.antes === 250 && cats.uber === 'Transporte', 'apagar Transporte tira o limite deste mês em diante; o mês passado e o lançamento ficam');

  t.secao('SOBRAS DO LABORATÓRIO');
  // recarrega antes: os reparos da abertura (o consórcio de teste ganha o gasto
  // fixo dele) não podem ser confundidos com a limpeza
  await t.recarregar(p);
  await p.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './lab/' });
    await new Promise(res => {
      const pronto = () => reg.active && reg.active.state === 'activated';
      if (pronto()) return res();
      const t0 = Date.now();
      const espera = setInterval(() => { if (pronto() || Date.now() - t0 > 5000) { clearInterval(espera); res(); } }, 50);
    });
    localStorage.setItem('meu_financeiro_lab_v1', '[{"id":1}]');
    localStorage.setItem('meu_financeiro_lab_planejamento_v1', '{"vigencias":[]}');
    localStorage.setItem('outro_site_preferencia', '1');
    await caches.open('meu-financeiro-lab-lab-2026.10.11-1');
    await caches.open('outro-site-cache');
  });
  const antesDaLimpeza = await p.evaluate(async () => ({ regs: (await navigator.serviceWorker.getRegistrations()).map(r => r.scope), lanc: lancamentos.length }));
  await t.recarregar(p);
  await p.waitForTimeout(1200);
  const depois = await p.evaluate(async () => {
    const chaves = [];
    for (let i = 0; i < localStorage.length; i++) chaves.push(localStorage.key(i));
    return { chaves, caches: await caches.keys(), regs: (await navigator.serviceWorker.getRegistrations()).map(r => r.scope), lanc: lancamentos.length };
  });
  console.log('   ', JSON.stringify({ antes: antesDaLimpeza.regs, depois: depois.regs, caches: depois.caches }));
  t.ok(antesDaLimpeza.regs.some(e => /\/MeuFinanceiro-\/lab\/$/.test(e)), '(preparo) um service worker no endereço do laboratório');
  t.ok(!depois.chaves.some(k => k.startsWith('meu_financeiro_lab_')) && depois.chaves.includes('outro_site_preferencia'),
    'as gavetas do laboratório somem; a de outro site fica');
  t.ok(!depois.regs.some(e => /\/lab\/$/.test(e)) && depois.regs.some(e => /\/MeuFinanceiro-\/$/.test(e)), 'o service worker do laboratório sai; o do app fica');
  t.ok(!depois.caches.some(n => n.startsWith('meu-financeiro-lab-')) && depois.caches.includes('outro-site-cache'), 'o cache do laboratório some; o de outro site fica');
  t.ok(depois.lanc === antesDaLimpeza.lanc, 'e os lançamentos continuam todos lá');
});
