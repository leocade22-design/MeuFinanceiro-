/* GASTOS FIXOS E CONSÓRCIOS — o fixo projeta 12 meses à frente; no cartão a
   cobrança é sozinha, fora dele nasce "a pagar" e só sai da conta com a baixa
   ("Paguei"). Editar vale do mês atual pra frente; excluir apaga só o futuro.
   O consórcio gera as próprias parcelas e para na última. */
const { iniciar } = require('./ajuda');

iniciar('06 · gastos fixos e consórcios', async t => {
  const p = await t.abrir();
  await p.evaluate(() => __semear({ contas: [
    { id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5 },
    { id: 'c2', nome: 'Carteira', temCredito: false }
  ] }));
  await t.recarregar(p);
  const novoFixo = (desc, valor, conta, dia) => p.evaluate(({ desc, valor, conta, dia }) => {
    abrirFormFixo();
    document.getElementById('descFixo').value = desc;
    document.getElementById('valorFixo').value = valor;
    document.getElementById('contaFixo').value = conta;
    atualizarFormaFixoVisibilidade();
    document.getElementById('diaFixo').value = String(dia);
    salvarFixoModal({ preventDefault() {} });
    return fixos[fixos.length - 1].id;
  }, { desc, valor, conta, dia });

  t.secao('PROJEÇÃO DE 12 MESES');
  const idNet = await novoFixo('Netflix', 'R$ 55,90', 'Itaú', 12);
  const idAcad = await novoFixo('Academia', 'R$ 99,90', 'Carteira', 28);
  const proj = await p.evaluate(({ idNet, idAcad }) => {
    const net = lancamentos.filter(l => l.fixoId === idNet).sort((a, b) => a.data.localeCompare(b.data));
    const acad = lancamentos.filter(l => l.fixoId === idAcad).sort((a, b) => a.data.localeCompare(b.data));
    return {
      qtdNet: net.length, primeiro: net[0].data, ultimo: net[net.length - 1].data, esperadoPrimeiro: __mes(0, 12), esperadoUltimo: __mes(12, 12),
      formaNet: net[0].formaModo, aPagarNet: net.some(l => l.aPagar), aPagarAcad: acad.every(l => l.aPagar), valor: acad[0].valor
    };
  }, { idNet, idAcad });
  t.ok(proj.qtdNet === 13 && proj.primeiro === proj.esperadoPrimeiro && proj.ultimo === proj.esperadoUltimo, 'do mês atual até 12 meses à frente: 13 lançamentos, no dia escolhido');
  t.ok(/Crédito/.test(proj.formaNet) && !proj.aPagarNet, 'no cartão: vai pra fatura sozinho, nada "a pagar"');
  t.ok(proj.aPagarAcad && proj.valor === '99,90', 'fora do cartão (Carteira): nasce "a pagar"');
  const gerarDeNovo = await p.evaluate(() => { const n = lancamentos.length; gerarLancamentosFixos(); return lancamentos.length - n; });
  t.ok(gerarDeNovo === 0, 'rodar o gerador de novo não duplica nada');

  t.secao('"PAGUEI": A BAIXA DO BOLETO');
  const baixa = await p.evaluate(idAcad => {
    const mes = __chaveMes(0);
    const [a, m] = mes.split('-').map(Number);
    irParaFatura(m - 1, a, true);
    const antes = { saiu: resumoFaturaAtual.saiuDaConta, aPagar: resumoFaturaAtual.aPagarNoMes };
    abrirPagamentoRecorrente(idAcad, mes);
    document.getElementById('dataPagarRecorrente').value = __mes(0, 2);
    document.getElementById('comoPagarRecorrente').value = 'pix';
    document.getElementById('contaPagarRecorrente').value = 'Carteira';
    confirmarPagamentoRecorrente();
    const l = lancamentos.find(x => x.fixoId === idAcad && mesDaParcelaConsorcio(x) === mes);
    const pago = { aPagar: !!l.aPagar, em: l.consorcioPagoEm, forma: l.formaModo, data: l.data };   // antes do desfazer mexer nele
    irParaFatura(m - 1, a, true);
    const depois = { saiu: resumoFaturaAtual.saiuDaConta, aPagar: resumoFaturaAtual.aPagarNoMes };
    // desfazer a baixa volta a ser previsão
    abrirPagamentoRecorrente(idAcad, mes);
    desfazerPagamentoRecorrente();
    const l2 = lancamentos.find(x => x.fixoId === idAcad && mesDaParcelaConsorcio(x) === mes);
    return { antes, depois, pago, esperado: __mes(0, 2),
      desfeito: { aPagar: !!l2.aPagar, data: l2.data }, esperadoDesfeito: __mes(0, 28) };
  }, idAcad);
  console.log('   ', JSON.stringify({ antes: baixa.antes, depois: baixa.depois }));
  t.ok(baixa.antes.aPagar === 99.9 && baixa.antes.saiu === 0, 'antes da baixa: R$ 99,90 a pagar, nada saiu da conta');
  t.ok(!baixa.pago.aPagar && baixa.pago.em === baixa.esperado && baixa.pago.forma === 'Pix' && baixa.pago.data === baixa.esperado, 'Paguei: deixa de ser "a pagar", com a data e a forma da baixa (Pix)');
  t.ok(Math.abs(baixa.depois.saiu - 99.9) < 0.001 && baixa.depois.aPagar === 0, 'e passa a contar como saída do mês');
  t.ok(baixa.desfeito.aPagar && baixa.desfeito.data === baixa.esperadoDesfeito, 'desfazer a baixa volta a ser "a pagar", no dia do cadastro');

  t.secao('EDITAR E EXCLUIR');
  const edit = await p.evaluate(idNet => {
    // um mês passado, como se o fixo existisse antes
    const l0 = lancamentos.find(l => l.fixoId === idNet && l.data === __mes(0, 12));
    lancamentos.push(Object.assign({}, l0, { id: novoIdLancamento(), data: __mes(-1, 12) }));
    salvarLocalStorage();
    abrirFormFixo(idNet);
    document.getElementById('valorFixo').value = 'R$ 59,90';
    salvarFixoModal({ preventDefault() {} });
    const doFixo = lancamentos.filter(l => l.fixoId === idNet);
    const passado = doFixo.find(l => l.data === __mes(-1, 12)).valor;
    const futuros = doFixo.filter(l => l.data >= obterDataBrasilia()).map(l => l.valor);
    excluirFixo(idNet);
    const sobrou = lancamentos.filter(l => l.fixoId === idNet).map(l => l.data);
    return { passado, futuros: [...new Set(futuros)], sobrou, hoje: obterDataBrasilia(), existe: fixos.some(f => f.id === idNet) };
  }, idNet);
  t.ok(edit.passado === '55,90' && edit.futuros.join() === '59,90', 'mudar o valor vale daqui pra frente: o mês passado fica R$ 55,90');
  t.ok(!edit.existe && edit.sobrou.every(d => d <= edit.hoje) && edit.sobrou.length >= 1, 'excluir o fixo apaga só o que ainda não chegou; o histórico fica');

  t.secao('CONSÓRCIO');
  const cons = await p.evaluate(() => {
    abrirFormConsorcio();
    document.getElementById('nomeConsorcio').value = 'Consórcio Curto';
    document.getElementById('parcelaConsorcio').value = 'R$ 100,00';
    document.getElementById('totalParcelasConsorcio').value = '5';
    document.getElementById('diaConsorcio').value = '10';
    document.getElementById('inicioConsorcio').value = __mes(-2, 10);
    document.getElementById('contaConsorcio').value = 'Carteira';
    salvarConsorcioModal({ preventDefault() {} });
    const c = consorcios[consorcios.length - 1];
    const parcelas = parcelasDoConsorcio(c).map(l => mesDaParcelaConsorcio(l));
    const tot = totaisConsorcio(c);
    return { temFixo: fixos.some(f => f.id === c.fixoId && f.consorcioId === c.id), parcelas, primeiro: __chaveMes(-2), ultimo: __chaveMes(2),
      pagas: tot.qtdPagas, falta: tot.falta, restantes: tot.restantes, id: c.id };
  });
  console.log('   parcelas:', cons.parcelas.join(' '));
  t.ok(cons.temFixo, 'o consórcio cria o próprio gasto fixo (é ele que gera o boleto)');
  t.ok(cons.parcelas.length === 5 && cons.parcelas[0] === cons.primeiro && cons.parcelas[4] === cons.ultimo, '5 parcelas, do mês de início até a última — e para aí, sem projetar além');
  t.ok(cons.pagas >= 2 && cons.restantes === 5 - cons.pagas && cons.falta === cons.restantes * 100, 'as que já venceram contam como pagas; o resto é o que falta (' + cons.pagas + ' pagas)');
  const enc = await p.evaluate(id => {
    abrirEncerrarConsorcio(id);
    document.getElementById('motivoEncerramentoConsorcio').value = 'vendi a cota';
    confirmarEncerramentoConsorcio();
    const c = consorcios.find(x => x.id === id);
    const hoje = obterDataBrasilia();
    return { encerrado: c.encerradoManual, motivo: c.motivoEncerramento, futuras: lancamentos.filter(l => l.fixoId === c.fixoId && l.data > hoje).length,
      historico: lancamentos.filter(l => l.fixoId === c.fixoId && l.data <= hoje).length };
  }, cons.id);
  t.ok(enc.encerrado && enc.motivo === 'vendi a cota' && enc.futuras === 0 && enc.historico >= 2, 'encerrar o grupo apaga só as parcelas futuras e guarda o motivo');
});
