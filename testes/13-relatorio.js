/* RELATÓRIO DO CONSULTOR — o retrato das finanças em blocos: visão geral
   com os últimos meses, para onde vai o dinheiro (categoria, conta, grupo),
   compromissos dos próximos meses, investimentos, empréstimos e as dicas
   tiradas dos próprios números. Sai em tela, texto e PDF. */
const { iniciar } = require('./ajuda');

iniciar('13 · relatório do consultor', async t => {
  const p = await t.abrir();
  await p.evaluate(() => {
    const L = [];
    let id = 1;
    const desp = (k, dia, descricao, valor, categoria, extra) => L.push(Object.assign({ id: id++, tipo: 'despesa', descricao, valor, data: __mes(k, dia),
      conta: 'Itaú', formaModo: 'Crédito à Vista', numParcelas: '1', categoria }, extra || {}));
    const rec = (k, dia, descricao, valor) => L.push({ id: id++, tipo: 'receita', descricao, valor, data: __mes(k, dia), conta: 'PicPay', formaModo: 'Pix' });
    // três meses fechados parecidos: renda 5.000, mercado ~800, lazer ~300
    [-3, -2, -1].forEach(k => {
      rec(k, 5, 'Salário', '5.000,00');
      desp(k, 6, 'Mercado', '800,00', 'Alimentação');
      desp(k, 10, 'Cinema', '300,00', 'Lazer');
      desp(k, 12, 'Aluguel', '1.500,00', 'Casa', { conta: 'PicPay', formaModo: 'Pix' });
    });
    // este mês: lazer disparou logo no dia 1
    rec(0, 1, 'Salário', '5.000,00');
    desp(0, 1, 'Show', '2.000,00', 'Lazer');
    // juros do rotativo num mês passado
    desp(-1, 1, 'Juros do rotativo', '120,00', 'Juros e encargos', { encargoFatura: 'Itaú|x' });
    // uma compra parcelada que segue nos próximos meses
    [1, 2, 3].forEach(k => desp(k, 8, `TV (${k}/3)`, '400,00', 'Casa', { grupoId: 'tv', formaModo: 'Crédito Parcelado', numParcelas: '3' }));
    // alguém me deve faz tempo
    desp(-2, 15, 'Jantar', '200,00', 'Alimentação', { emprestimoPara: 'Bia', emprestimoVence: __mes(-2, 20) });
    __semear({
      contas: [{ id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5 }, { id: 'c2', nome: 'PicPay', temCredito: false }],
      lancamentos: L,
      fixos: [{ id: 'fNet', descricao: 'Streaming', valor: '55,90', conta: 'Itaú', diaVencimento: 20, categoria: 'Lazer', formaModo: 'Crédito Parcelado', dataInicio: __mes(0, 1) }],
      grupos: [{ id: 'g1', nome: 'Viagem praia', status: 'aberto', dataCriacao: __mes(-1, 1) }],
      planejamento: { vigencias: [{ desde: __chaveMes(-3), renda: null, gastoTotal: null, aviso: 80, limites: { Lazer: 500 } }] }
    });
  });
  await t.recarregar(p);
  const r = await p.evaluate(() => {
    __aba('abaGraficos');
    abrirRelatorioConsultor();
    return { aberto: !document.getElementById('modalRelatorio').classList.contains('escondido'),
      texto: relatorioAtual.texto, html: document.getElementById('corpoRelatorio').innerHTML,
      titulos: [...document.querySelectorAll('#corpoRelatorio h4')].map(h => h.textContent) };
  });
  console.log(r.texto.split('\n').slice(0, 14).map(l => '   ' + l).join('\n'));
  t.ok(r.aberto && r.titulos.join('|') === 'Visão geral|Para onde vai o dinheiro|Compromissos dos próximos meses|Empréstimos e cobranças|O que eu faria',
    'o botão em Gráficos abre o relatório com as seções na ordem');
  t.ok(/renda R\$ 5\.000,00, gastos R\$ 2\.7\d\d,\d\d/.test(r.texto) && /Você guarda \d+% da renda/.test(r.texto), 'visão geral: médias dos meses fechados e quanto da renda sobra');
  t.ok(/Alimentação: R\$ [\d.]+,\d\d \(\d+% dos gastos\)/.test(r.texto) && /PicPay: R\$ 1\.500,00/.test(r.texto), 'para onde vai: por categoria e por conta (o aluguel no PicPay)');
  t.ok(/Parcelas em aberto: 1 compra, R\$ 1\.200,00 ainda por vir/.test(r.texto) && /Gastos fixos: 1, somando R\$ 55,90 por mês/.test(r.texto), 'compromissos: o fixo e a TV parcelada que ainda vem');
  t.ok(/Te devem R\$ 200,00/.test(r.texto) && /Bia: R\$ 200,00 \(R\$ 200,00 já vencidos\)/.test(r.texto), 'empréstimos: quem deve e o que já venceu');
  t.ok(/Meta de Lazer estourada: R\$ 2\.000,00 de R\$ 500,00/.test(r.texto), 'dica: meta estourada');
  t.ok(/de juros e encargos do cartão/.test(r.texto) && /venceram há mais de 30 dias/.test(r.texto) && /Não há reserva de emergência/.test(r.texto),
    'dicas: juros pagos ao banco, cobrança velha e a reserva que falta');
  t.ok(/<table>/.test(r.html) && !/<script/i.test(r.html), 'na tela, as tabelas viram tabela de verdade');

  const exportar = await p.evaluate(async () => {
    // área de transferência negada (como em alguns celulares): cai no textarea, sem erro
    const orig = navigator.clipboard && navigator.clipboard.writeText;
    if (navigator.clipboard) navigator.clipboard.writeText = () => Promise.reject(new Error('negado'));
    window.__ultimoAviso = null;
    await copiarRelatorio();
    if (navigator.clipboard && orig) navigator.clipboard.writeText = orig;
    fecharModal('modalAviso');
    // impressão: só o relatório fica visível
    window.print = () => {};
    imprimirRelatorio();
    const temRelatorio = document.querySelector('#areaImpressao .relatorio h4') !== null;
    const classe = document.body.classList.contains('imprimindo');
    window.dispatchEvent(new Event('afterprint'));
    return { aviso: window.__ultimoAviso, temRelatorio, classe, limpo: !document.body.classList.contains('imprimindo') && !document.getElementById('areaImpressao').innerHTML };
  });
  t.ok(exportar.temRelatorio && exportar.classe && exportar.limpo, 'PDF: o relatório vai pra área de impressão, e tudo volta ao normal depois');
  await p.emulateMedia({ media: 'print' });
  const naImpressao = await p.evaluate(() => {
    window.print = () => {};
    imprimirRelatorio();
    const vis = [...document.body.children].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id);
    window.dispatchEvent(new Event('afterprint'));
    return vis;
  });
  await p.emulateMedia({ media: 'screen' });
  t.ok(naImpressao.join() === 'areaImpressao', 'na hora de imprimir, só o relatório aparece');

  const oculto = await p.evaluate(() => {
    fecharModal('modalRelatorio');
    alternarVisibilidade();
    abrirRelatorioConsultor();
    const r = { acoes: document.getElementById('acoesRelatorio').classList.contains('escondido'), corpo: __texto('#corpoRelatorio') };
    fecharModal('modalRelatorio');
    alternarVisibilidade();
    return r;
  });
  t.ok(oculto.acoes && /valores estão ocultos/.test(oculto.corpo), 'com os valores ocultos, o relatório não mostra nem exporta número');
});
