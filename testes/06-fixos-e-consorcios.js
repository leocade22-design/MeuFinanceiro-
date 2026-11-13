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

  t.secao('MÊS SEM COBRANÇA (O CONSÓRCIO DO CARRO)');
  // Igual ao caso real: parcela 1 paga na adesão, o mês seguinte não teve
  // cobrança, mas o app projetou um boleto "a pagar" que agora está vencido.
  await p.evaluate(() => {
    fixos.push({ id: 'fCarro', descricao: 'Consórcio Carro', valor: '394,78', conta: 'Carteira', diaVencimento: 15, categoria: 'Investimento',
      formaModo: 'À Vista / Débito', emprestimoPara: '', diaCobranca: null, dataInicio: __mes(-2, 15), consorcioId: 'cCarro' });
    consorcios.push({ id: 'cCarro', nome: 'Consórcio Carro', bem: 'veículo', valorCarta: '50000,00', valorParcela: '394,78', totalParcelas: 80,
      diaVencimento: 15, conta: 'Carteira', dataInicio: __mes(-2, 15), contemplado: false, fixoId: 'fCarro', formaPagamento: 'À Vista / Débito',
      categoria: 'Investimento', historicoValores: [{ desde: __chaveMes(-2), valor: '394,78', motivo: 'início' }] });
    const base = { tipo: 'despesa', descricao: 'Consórcio Carro', conta: 'Carteira', formaModo: 'À Vista / Débito', numParcelas: '1',
      categoria: 'Investimento', observacao: 'Gasto fixo mensal', valor: '394,78', fixoId: 'fCarro' };
    lancamentos.push(Object.assign({}, base, { id: novoIdLancamento(), data: __mes(-2, 11), consorcioMesRef: __chaveMes(-2), consorcioPagoEm: __mes(-2, 11) }));
    lancamentos.push(Object.assign({}, base, { id: novoIdLancamento(), data: __mes(-1, 15), aPagar: true }));
    salvarFixos(); salvarConsorcios(); salvarLocalStorage();
  });
  await t.recarregar(p);
  const carro = await p.evaluate(() => {
    const c = consorcios.find(x => x.id === 'cCarro');
    const antes = { pagas: totaisConsorcio(c).qtdPagas, numMes0: numeroDaParcelaConsorcio(c, __chaveMes(0)), fim: ultimoMesConsorcio(c) };
    abrirMesSemCobranca('fCarro');
    const palpite = document.getElementById('mesSemCobranca').value;
    const previa = __texto('#previaMesSemCobranca');
    confirmarMesSemCobranca();
    const f = fixos.find(x => x.id === 'fCarro');
    const doMes = m => lancamentos.filter(l => l.fixoId === 'fCarro' && mesDaParcelaConsorcio(l) === __chaveMes(m)).length;
    const n = lancamentos.length; gerarLancamentosFixos();
    const card = montarCardConsorcio(c).textContent.replace(/\s+/g, ' ');
    return {
      antes, palpite, previa, pulados: f.mesesPulados, mesMenos1: doMes(-1), recriou: lancamentos.length - n,
      depois: { pagas: totaisConsorcio(c).qtdPagas, numMes0: numeroDaParcelaConsorcio(c, __chaveMes(0)), fim: ultimoMesConsorcio(c) },
      faltam: parcelasFaltantesDoFixo('fCarro'),
      naBaixa: ocorrenciasDoFixo('fCarro').some(oc => oc.mes === __chaveMes(-1)),
      boletoVencido: boletosParaAvisar().some(l => l.fixoId === 'fCarro' && l.data < obterDataBrasilia()),
      card: /sem cobrança em/.test(card) && /1 de 80/.test(card),
      esperado: { m1: __chaveMes(-1), fimAntes: __chaveMes(77), fimDepois: __chaveMes(78) }
    };
  });
  console.log('   prévia:', carro.previa);
  t.ok(carro.antes.pagas === 1, 'boleto "a pagar" vencido não conta como parcela paga: 1 de 80, não 2');
  t.ok(carro.antes.numMes0 === 3 && carro.antes.fim === carro.esperado.fimAntes, 'antes: a deste mês era a 3/80 e o fim, 77 meses à frente');
  t.ok(carro.palpite === carro.esperado.m1, 'a janela já sugere o mês do boleto vencido');
  t.ok(carro.pulados.join() === carro.esperado.m1 && carro.mesMenos1 === 0 && carro.recriou === 0, 'marcar tira o boleto do mês e o gerador não traz de volta');
  t.ok(carro.depois.numMes0 === 2 && carro.depois.fim === carro.esperado.fimDepois, 'a deste mês vira a 2/80 e o consórcio quita um mês depois');
  t.ok(carro.depois.pagas === 1, 'as parcelas pagas não mudam (continua 1)');
  t.ok(carro.faltam === 0 && !carro.naBaixa, 'o mês não aparece como "falta recriar" nem como opção de baixa');
  t.ok(!carro.boletoVencido, 'e some o aviso de boleto vencido');
  t.ok(carro.card, 'o card do consórcio mostra "sem cobrança em …" e "1 de 80"');

  const pago = await p.evaluate(() => {
    abrirMesSemCobranca('fCarro');
    const sel = document.getElementById('mesSemCobranca');
    const ofereceuPago = [...sel.options].some(o => o.value === __chaveMes(-2));
    sel.innerHTML = `<option value="${__chaveMes(-2)}">x</option>`;
    window.__ultimoAviso = null;
    confirmarMesSemCobranca();
    fecharModal('modalAviso');
    return { ofereceuPago, aviso: window.__ultimoAviso, pulados: fixos.find(x => x.id === 'fCarro').mesesPulados.length };
  });
  t.ok(!pago.ofereceuPago && pago.aviso === 'mesJaPago' && pago.pulados === 1, 'mês com pagamento registrado não é oferecido, e é recusado se vier mesmo assim');

  const desfeito = await p.evaluate(() => {
    desfazerMesSemCobranca('fCarro', __chaveMes(-1));
    const c = consorcios.find(x => x.id === 'cCarro');
    const l = lancamentos.find(x => x.fixoId === 'fCarro' && mesDaParcelaConsorcio(x) === __chaveMes(-1));
    fecharModal('modalMesSemCobranca');
    return { volta: !!l && !!l.aPagar, numMes0: numeroDaParcelaConsorcio(c, __chaveMes(0)), fim: ultimoMesConsorcio(c),
      pulados: fixos.find(x => x.id === 'fCarro').mesesPulados, fimEsperado: __chaveMes(77) };
  });
  t.ok(desfeito.volta && desfeito.numMes0 === 3 && desfeito.fim === desfeito.fimEsperado && !desfeito.pulados, 'desfazer traz o mês de volta "a pagar" e a numeração de antes');

  const outraData = await p.evaluate(() => {
    const l = lancamentos.find(x => x.fixoId === 'fCarro' && mesDaParcelaConsorcio(x) === __chaveMes(1));
    prepararEdicao(l.id);
    document.getElementById('dataCompra').value = __mes(2, 3);
    executarSalvarLancamento(parseVal(l.valor));
    const depois = lancamentos.find(x => x.id === l.id);
    const n = lancamentos.length; gerarLancamentosFixos();
    return { data: depois.data, mes: mesDaParcelaConsorcio(depois), esperado: __chaveMes(1), dataEsperada: __mes(2, 3),
      faltam: parcelasFaltantesDoFixo('fCarro'), novos: lancamentos.length - n };
  });
  t.ok(outraData.data === outraData.dataEsperada && outraData.mes === outraData.esperado && outraData.faltam === 0 && outraData.novos === 0,
    'mudar a data de uma parcela pro mês seguinte (editando o lançamento) não abre buraco nem duplica: ela continua sendo a do mês dela');

  const curto = await p.evaluate(() => {
    abrirFormConsorcio();
    document.getElementById('nomeConsorcio').value = 'Consórcio 4x';
    document.getElementById('parcelaConsorcio').value = 'R$ 50,00';
    document.getElementById('totalParcelasConsorcio').value = '4';
    document.getElementById('diaConsorcio').value = '20';
    document.getElementById('inicioConsorcio').value = __mes(1, 20);
    document.getElementById('contaConsorcio').value = 'Carteira';
    salvarConsorcioModal({ preventDefault() {} });
    const c = consorcios[consorcios.length - 1];
    const meses = () => parcelasDoConsorcio(c).map(l => mesDaParcelaConsorcio(l));
    const antes = meses();
    abrirMesSemCobranca(c.fixoId);
    document.getElementById('mesSemCobranca').value = __chaveMes(2);
    confirmarMesSemCobranca();
    const depois = meses();
    const numUltima = numeroDaParcelaConsorcio(c, depois[depois.length - 1]);
    desfazerMesSemCobranca(c.fixoId, __chaveMes(2));
    fecharModal('modalMesSemCobranca');
    return { antes, depois, numUltima, desfeito: meses(), m: [1, 2, 3, 4, 5].map(k => __chaveMes(k)) };
  });
  console.log('   4x:', curto.antes.join(' '), '→', curto.depois.join(' '), '→', curto.desfeito.join(' '));
  t.ok(curto.depois.join() === [curto.m[0], curto.m[2], curto.m[3], curto.m[4]].join() && curto.numUltima === 4,
    'consórcio de 4 parcelas com um mês sem cobrança: a 4ª nasce um mês depois');
  t.ok(curto.desfeito.join() === curto.antes.join(), 'desfazer volta ao calendário original, sem a parcela extra no fim');

  const emprestimo = await p.evaluate(() => {
    abrirFormFixo();
    document.getElementById('descFixo').value = 'Gympass - Bernardo';
    document.getElementById('valorFixo').value = 'R$ 189,90';
    document.getElementById('contaFixo').value = 'Itaú';
    atualizarFormaFixoVisibilidade();
    document.getElementById('diaFixo').value = '26';
    document.getElementById('emprestimoFixo').value = 'Bernardo';
    atualizarPrazoFixoVisibilidade();
    salvarFixoModal({ preventDefault() {} });
    const f = fixos[fixos.length - 1];
    abrirAcoesFixo(f.id);
    executarMesSemCobrancaFixo();
    document.getElementById('mesSemCobranca').value = __chaveMes(2);
    confirmarMesSemCobranca();
    fecharModal('modalMesSemCobranca');
    const meses = lancamentos.filter(l => l.fixoId === f.id).map(l => l.data.slice(0, 7));
    return { semMes2: !meses.includes(__chaveMes(2)), temMes3: meses.includes(__chaveMes(3)), qtd: meses.length };
  });
  t.ok(emprestimo.semMes2 && emprestimo.temMes3 && emprestimo.qtd === 12, 'vale pra qualquer recorrente: a cobrança do Gympass do Bernardo some só no mês marcado');
});
