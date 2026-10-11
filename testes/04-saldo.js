/* SALDO E RESUMO DO MÊS — a régua do caixa: o que passou pela conta.
   Débito e Pix saem na data; crédito só quando a fatura é paga; boleto "a
   pagar" e empréstimo indireto não mexem no saldo; transferência muda a conta
   mas não o total; saldo inicial e correção de saldo sem inventar lançamento. */
const { iniciar } = require('./ajuda');

iniciar('04 · saldo e resumo', async t => {
  const p = await t.abrir();
  await p.evaluate(() => __semear({
    contas: [
      { id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5, saldoInicial: '1.000,00', saldoInicialEm: __mes(-1, 1) },
      { id: 'c2', nome: 'Carteira', temCredito: false }
    ],
    lancamentos: [
      { id: 1, tipo: 'receita', descricao: 'Salário', valor: '5.000,00', data: __mes(0, 1), conta: 'Itaú', formaModo: 'À Vista / Débito' },
      { id: 2, tipo: 'despesa', descricao: 'Mercado', valor: '200,00', data: __mes(0, 2), conta: 'Itaú', formaModo: 'Pix', categoria: 'Alimentação' },
      { id: 3, tipo: 'despesa', descricao: 'Restaurante', valor: '300,00', data: __mes(0, 3), conta: 'Itaú', formaModo: 'Crédito à Vista', categoria: 'Lazer' },
      { id: 4, tipo: 'despesa', descricao: 'Boleto da luz', valor: '150,00', data: __mes(0, 20), conta: 'Itaú', formaModo: 'Pix', categoria: 'Casa', aPagar: true },
      { id: 5, tipo: 'receita', descricao: 'Mãe pagou por mim', valor: '500,00', data: __mes(0, 3), conta: '', formaModo: 'À Vista / Débito', emprestimoPara: 'Mãe', emprestimoTipo: 'indireto', emprestimoVence: __mes(1, 3) },
      { id: 6, tipo: 'despesa', descricao: 'Feira mês passado', valor: '100,00', data: __mes(-1, 5), conta: 'Itaú', formaModo: 'Pix', categoria: 'Alimentação' }
    ],
    transferencias: [{ id: 9, data: __mes(0, 4), origem: 'Itaú', destino: 'Carteira', valor: '50,00' }]
  }));
  await t.recarregar(p);
  const mesAtual = () => p.evaluate(() => { irParaFatura(...(() => { const [a, m] = __chaveMes(0).split('-').map(Number); return [m - 1, a]; })(), true); return JSON.parse(JSON.stringify(resumoFaturaAtual)); });
  const consulta = tx => p.evaluate(tx => { const s = semAcento(tx); return montarRespostaPergunta(s, periodoDaPergunta(s)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); }, tx);

  t.secao('O MÊS ATUAL');
  let r = await mesAtual();
  console.log('   ', JSON.stringify({ recebido: r.totalRecebimentos, debito: r.saiuEmDebito, credito: r.compradoNoCredito, aberto: r.faturaEmAberto, aPagar: r.aPagarNoMes, contas: r.porContaAcumulado }));
  t.ok(r.totalRecebimentos === 5000, 'recebido: R$ 5.000 (o empréstimo indireto não é receita: o dinheiro nunca passou por conta nenhuma)');
  t.ok(r.saiuEmDebito === 200 && r.saiuDaConta === 200, 'saiu da conta: só o Pix de R$ 200');
  t.ok(r.compradoNoCredito === 300 && r.faturaEmAberto === 300, 'o crédito (R$ 300) fica à parte, como fatura em aberto');
  t.ok(r.aPagarNoMes === 150, 'o boleto ainda não pago (R$ 150) também fica à parte');
  t.ok(r.porContaAcumulado['Itaú'] === 5650 && r.porContaAcumulado['Carteira'] === 50, 'Itaú: 1.000 inicial − 100 (mês passado) + 5.000 − 200 − 50 transferidos = R$ 5.650; Carteira: R$ 50');
  const tela = await p.evaluate(() => {
    __aba('abaFaturas');
    return { saldo: __texto('#faturaSaldo'), aviso: __texto('#avisoFaturaAberta') };
  });
  t.ok(/5\.700,00/.test(tela.saldo), 'o card mostra o saldo somado das contas: ' + tela.saldo);
  t.ok(/fatura em aberto: R\$ 300,00/.test(tela.aviso) && /boletos a pagar: R\$ 150,00/.test(tela.aviso), 'e avisa da fatura em aberto e do boleto a pagar');
  t.ok(/R\$ 300,00 foi no crédito e ainda não saiu da conta/.test(await consulta('saldo deste mes')), 'a Consulta rápida lembra dos R$ 300 no crédito que ainda não saíram');

  t.secao('MÊS PASSADO');
  const passado = await p.evaluate(() => {
    const [a, m] = __chaveMes(-1).split('-').map(Number);
    irParaFatura(m - 1, a, true);
    return { itau: resumoFaturaAtual.porContaAcumulado['Itaú'], rotulo: __texto('#rotuloSaldoFatura') };
  });
  t.ok(passado.itau === 900 && /^saldo no fim do mês$/i.test(passado.rotulo), 'no mês passado, o retrato daquele fim de mês: R$ 900');
  const antesDoInicio = await p.evaluate(() => {
    const [a, m] = __chaveMes(-2).split('-').map(Number);
    irParaFatura(m - 1, a, true);
    return resumoFaturaAtual.porContaAcumulado['Itaú'] || 0;
  });
  t.ok(antesDoInicio === 0, 'antes do mês do saldo inicial, ele não aparece (não inventa passado)');

  t.secao('PAGAR A FATURA TIRA DA CONTA');
  const pagar = (modo, valor, dia) => p.evaluate(([modo, valor, dia]) => {
    const [a, m] = __chaveMes(0).split('-').map(Number);
    abrirPagarFatura('Itaú', m - 1, a);
    setModoPagamentoFatura(modo);
    if (valor) document.getElementById('faturaValorPago').value = valor;
    document.getElementById('faturaDataPagamento').value = __mes(0, dia);
    confirmarPagarFatura();
  }, [modo, valor, dia]);
  await pagar('parcial', 'R$ 100,00', 5);
  const emParte = await consulta('saldo deste mes');
  t.ok(/R\$ 200,00 foi no crédito e ainda não saiu da conta/.test(emParte) && /sendo R\$ 100,00 de fatura paga/.test(emParte),
    'paga em parte (R$ 100): a Consulta rápida passa a dizer que só R$ 200 ainda não saíram');
  await pagar('total', null, 6);
  r = await mesAtual();
  t.ok(r.saiuDaConta === 500 && r.faturasPagasNoMes === 300 && r.faturaEmAberto === 0, 'paga o resto: saiu da conta passa a R$ 500 e não há mais fatura em aberto');
  t.ok(r.porContaAcumulado['Itaú'] === 5350, 'Itaú: R$ 5.350');

  t.secao('CORRIGIR O SALDO');
  const corr = await p.evaluate(() => {
    const qtd = lancamentos.length;
    contaAcoesId = 'c1';
    abrirCorrigirSaldo();
    const calculado = __texto('#saldoCalculadoConta');
    document.getElementById('saldoRealConta').value = '5.400,00';
    previewCorrecaoSaldo();
    const previa = __texto('#previaCorrecaoSaldo');
    confirmarCorrecaoSaldo();
    fecharModal('modalAviso');
    return { calculado, previa, qtdIgual: lancamentos.length === qtd, inicial: contas.find(c => c.id === 'c1').saldoInicial,
      historico: correcoesSaldo.map(c => c.conta + ':' + c.antes + '→' + c.depois), saldo: resumoFaturaAtual.porContaAcumulado['Itaú'] };
  });
  console.log('   ', JSON.stringify(corr));
  t.ok(/5\.350,00/.test(corr.calculado) && /Faltavam R\$ 50,00/.test(corr.previa), 'mostra o calculado (R$ 5.350) e a diferença de R$ 50');
  t.ok(corr.qtdIgual && corr.inicial === '1050,00' && corr.saldo === 5400, 'corrige pelo saldo inicial (R$ 1.050), sem criar receita nem despesa');
  t.ok(corr.historico.join() === 'Itaú:5350→5400', 'e guarda a correção no histórico');

  t.secao('CONSULTA RÁPIDA FALA A MESMA LÍNGUA');
  const resposta = await consulta('saldo deste mes');
  console.log('   ', resposta);
  t.ok(/entrou R\$ 5\.000,00, saiu da conta R\$ 500,00 \(sendo R\$ 300,00 de fatura paga\)/.test(resposta), '"saldo" na Consulta rápida: entrou 5.000, saiu 500, sendo 300 de fatura');
  t.ok(!/foi no crédito/.test(resposta), 'com a fatura paga, não fala mais em crédito que "ainda não saiu da conta"');
  t.ok(/R\$ 150,00 são boletos que ainda estão na sua mão/.test(resposta), 'e lembra do boleto a pagar');
});
