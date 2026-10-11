/* EMPRÉSTIMOS E COBRANÇAS — quem me deve, quanto e como a dívida vai embora:
   meio a meio, rateio entre várias pessoas, valor cheio, receber, desfazer o
   recebimento, quitar sem movimentação, "Recebi um valor" (abate das mais
   antigas), empréstimo indireto e o grupo de gastos. */
const { iniciar } = require('./ajuda');

iniciar('05 · empréstimos', async t => {
  const p = await t.abrir();
  await p.evaluate(() => __semear({
    contas: [{ id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5 }],
    contatos: { Borges: { tel: '', tom: 'neutro' }, Ana: { tel: '', tom: 'neutro' } },
    grupos: [{ id: 'gr1', nome: 'Viagem Ubatuba', status: 'aberto', dataCriacao: __mes(0, 1) }]
  }));
  await t.recarregar(p);
  // O empréstimo é marcado no formulário por campos escondidos que a janela de
  // empréstimo preenche; aqui eles são preenchidos direto.
  const lancarEmprestado = (o, campos) => p.evaluate(({ o, campos }) => {
    const padrao = { emprestimoPara: '', emprestimoVence: '', emprestimoDividirComigo: '', emprestimoRateioIncluiVoce: '1', emprestimoCotas: '', emprestimoTipo: '' };
    Object.entries(Object.assign(padrao, campos)).forEach(([id, v]) => { document.getElementById(id).value = v; });
    if (o.dias != null) o.data = __dia(o.dias);   // dias atrás, contados na página
    __lancar(Object.assign({ conta: 'Itaú', forma: 'Pix', categoria: 'Lazer' }, o));
  }, { o, campos });
  const abertas = () => p.evaluate(() => cobrancasAbertas().map(c => ({ chave: c.chave, nome: c.nome, valor: Math.round(c.valor * 100) / 100, devo: !!c.devo, desc: c.lanc.descricao })));

  t.secao('COMO A DÍVIDA NASCE');
  await lancarEmprestado({ descricao: 'Jantar', valor: '200,00', dias: -10 }, { emprestimoPara: 'Borges', emprestimoVence: '', emprestimoDividirComigo: '1' });
  await lancarEmprestado({ descricao: 'Uber', valor: '60,00', dias: -5 }, { emprestimoPara: 'Borges, Ana', emprestimoRateioIncluiVoce: '1' });
  await lancarEmprestado({ descricao: 'Emprestei', valor: '300,00', dias: -3 }, { emprestimoPara: 'Ana' });
  let ab = await abertas();
  console.log('   ', ab.map(c => c.nome + ' ' + c.desc + ' ' + c.valor).join(' · '));
  const de = (nome, desc) => ab.filter(c => c.nome === nome && c.desc === desc).reduce((s, c) => s + c.valor, 0);
  t.ok(de('Borges', 'Jantar') === 100, 'jantar de R$ 200 meio a meio com o Borges: ele deve R$ 100');
  t.ok(de('Borges', 'Uber') === 20 && de('Ana', 'Uber') === 20, 'Uber de R$ 60 entre você, Borges e Ana: R$ 20 cada');
  t.ok(de('Ana', 'Emprestei') === 300, 'empréstimo de valor cheio: a Ana deve os R$ 300');
  const liquido = await p.evaluate(() => valorLiquidoDespesa(lancamentos.find(l => l.descricao === 'Jantar')));
  t.ok(liquido === 200, 'enquanto ninguém pagou, o jantar continua R$ 200 no valor líquido');

  t.secao('RECEBER');
  const receber = await p.evaluate(chave => {
    const antes = lancamentos.length;
    abrirReceberEmprestimo([chave]);
    document.getElementById('contaRecebimento').value = 'Itaú';
    confirmarRecebimentoEmprestimo();
    const r = lancamentos.find(l => l.reembolsoDe != null && l.tipo === 'receita');
    return { novos: lancamentos.length - antes, desc: r.descricao, valor: r.valor, pessoa: r.reembolsoPessoa,
      quitada: lancamentos.find(l => l.descricao === 'Emprestei').emprestimoQuitado,
      historico: historicoDeQuitadas().map(q => q.c.nome + ':' + q.como + ':' + q.conta) };
  }, ab.find(c => c.desc === 'Emprestei').chave);
  t.ok(receber.novos === 1 && receber.desc === 'Reembolso' && receber.valor === '300,00' && receber.pessoa === 'Ana', 'receber cria a receita "Reembolso" de R$ 300 ligada à Ana');
  t.ok(receber.quitada && receber.historico.includes('Ana:recebido:Itaú'), 'a cobrança vai pra "já quitadas", com como e onde caiu');
  const desfez = await p.evaluate(() => {
    const r = lancamentos.find(l => l.reembolsoDe != null && l.tipo === 'receita');
    excluirLancamento(r.id);
    return { reabriu: !lancamentos.find(l => l.descricao === 'Emprestei').emprestimoQuitado, abertas: cobrancasAbertas().filter(c => c.nome === 'Ana').length };
  });
  t.ok(desfez.reabriu && desfez.abertas === 2, 'apagar o reembolso reabre a cobrança (o dinheiro não existe mais)');

  t.secao('QUITAR SEM MOVIMENTAÇÃO');
  ab = await abertas();
  const semMov = await p.evaluate(chave => {
    const antes = lancamentos.length;
    quitarSemMovimentacao([chave]);
    const q = historicoDeQuitadas().find(x => x.c.lanc.descricao === 'Uber' && x.c.nome === 'Ana');
    return { novos: lancamentos.length - antes, como: q && q.como };
  }, ab.find(c => c.nome === 'Ana' && c.desc === 'Uber').chave);
  t.ok(semMov.novos === 0 && semMov.como === 'sem movimentação', 'quitar sem movimentação: some das abertas e nenhum lançamento é criado');

  t.secao('RECEBI UM VALOR (ABATE DAS MAIS ANTIGAS)');
  const abate = await p.evaluate(() => {
    abrirAbaterValor('Borges', false);
    document.getElementById('valorAbater').value = 'R$ 110,00';
    document.getElementById('contaAbater').value = 'Itaú';
    atualizarPreviaAbatimento();
    const previa = __texto('#previaAbatimento');
    const antes = lancamentos.length;
    confirmarAbatimento();
    return { previa, novos: lancamentos.length - antes,
      receitas: lancamentos.filter(l => l.reembolsoAvulso).map(l => l.valor).sort(),
      abertas: cobrancasAbertas().filter(c => c.nome === 'Borges').map(c => c.lanc.descricao + ':' + c.valor.toFixed(2)) };
  });
  console.log('   prévia:', abate.previa);
  t.ok(/Jantar/.test(abate.previa) && /Uber/.test(abate.previa) && /ainda deve R\$ 10,00/.test(abate.previa), 'prévia: quita o jantar (mais antigo) e abate parte do Uber; "ainda deve R$ 10"');
  t.ok(abate.novos === 2 && abate.receitas.join() === '10,00,100,00', 'um reembolso por compra: R$ 100 do jantar e R$ 10 do Uber');
  t.ok(abate.abertas.join() === 'Uber:10.00', 'sobra aberto só o resto do Uber: R$ 10');
  const passou = await p.evaluate(() => {
    abrirAbaterValor('Borges', false);
    document.getElementById('valorAbater').value = 'R$ 50,00';
    atualizarPreviaAbatimento();
    return { previa: __texto('#previaAbatimento'), bloqueado: document.getElementById('btnConfirmarAbater').disabled };
  });
  t.ok(/Passou R\$ 40,00/.test(passou.previa) && passou.bloqueado, 'valor maior que a dívida: avisa e não deixa confirmar');
  await p.evaluate(() => fecharModal('modalAbaterValor'));

  t.secao('EMPRÉSTIMO INDIRETO (PAGARAM POR MIM)');
  const indireto = await p.evaluate(() => {
    lancamentos.unshift({ id: novoIdLancamento(), tipo: 'receita', descricao: 'Mãe pagou o mercado', valor: '250,00', data: obterDataBrasilia(), conta: '',
      formaModo: 'À Vista / Débito', emprestimoPara: 'Mãe', emprestimoTipo: 'indireto', emprestimoVence: __mes(1, 10) });
    salvarLocalStorage(); atualizarTudo();
    const c = cobrancasAbertas().find(x => x.nome === 'Mãe');
    return { devo: c && c.devo, valor: c && c.valor, recebido: resumoFaturaAtual.totalRecebimentos };
  });
  t.ok(indireto.devo && indireto.valor === 250, 'vira uma dívida minha com a Mãe, de R$ 250');
  t.ok(indireto.recebido === 100 + 10, 'e não entra como receita: o "recebido" do mês são só os reembolsos (R$ 110)');

  t.secao('GRUPO DE GASTOS');
  await lancarEmprestado({ descricao: 'Pousada', valor: '900,00' }, { emprestimoPara: 'Borges, Ana', emprestimoRateioIncluiVoce: '1' });
  const grupo = await p.evaluate(() => {
    const l = lancamentos.find(x => x.descricao === 'Pousada');
    l.grupoViagemId = 'gr1'; l.grupoViagemNome = 'Viagem Ubatuba';
    salvarLocalStorage();
    const g = resumoGrupo('gr1');
    return { bruto: g.bruto, aReceber: g.aReceber, liquido: g.liquido };
  });
  t.ok(grupo.bruto === 900 && grupo.aReceber === 600, 'pousada de R$ 900 dividida em 3: o grupo mostra R$ 900 gastos e R$ 600 a receber');
});
