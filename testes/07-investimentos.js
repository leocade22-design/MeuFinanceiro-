/* INVESTIMENTOS — o aporte nasce do lançamento (categoria Investimento +
   destino), os dois andam juntos (editar, excluir, restaurar), o valor do
   grupo é atualizado pelo total e o topo soma aportes + consórcio pago. */
const { iniciar } = require('./ajuda');

iniciar('07 · investimentos', async t => {
  const p = await t.abrir();
  await p.evaluate(() => __semear({
    contas: [{ id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5 }],
    investimentos: [{ id: 'i-antigo', valor: '1.000,00', origem: 'Itaú', tipoAtivo: 'Tesouro Direto', valorAtual: null, atualizadoEm: null, data: __mes(-3, 5) }]
  }));
  await t.recarregar(p);

  t.secao('APORTE PELO LANÇAMENTO');
  const aporte = await p.evaluate(() => {
    __lancar({ descricao: 'Aporte Tesouro', valor: '500,00', conta: 'Itaú', forma: 'Pix', categoria: 'Investimento', destino: 'ativo:Tesouro Direto' });
    __lancar({ descricao: 'Só despesa', valor: '50,00', conta: 'Itaú', forma: 'Pix', categoria: 'Investimento' });
    const l = lancamentos.find(x => x.descricao === 'Aporte Tesouro');
    const inv = investimentos.find(i => i.id === l.aporteId);
    return { temAporte: !!inv, valor: inv && inv.valor, grupo: inv && inv.tipoAtivo, ligado: inv && inv.lancamentoId === l.id,
      aportes: investimentos.length, soDespesa: !lancamentos.find(x => x.descricao === 'Só despesa').aporteId };
  });
  t.ok(aporte.temAporte && aporte.valor === '500,00' && aporte.grupo === 'Tesouro Direto' && aporte.ligado, 'categoria Investimento + destino Tesouro: cria o aporte de R$ 500, ligado ao lançamento');
  t.ok(aporte.aportes === 2 && aporte.soDespesa, 'sem destino marcado, fica só a despesa (nenhum aporte a mais)');

  t.secao('OS DOIS ANDAM JUNTOS');
  const juntos = await p.evaluate(() => {
    const l = lancamentos.find(x => x.descricao === 'Aporte Tesouro');
    const inv = investimentos.find(i => i.id === l.aporteId);
    abrirEditarAporte(inv.id);
    document.getElementById('valorAporteEditando').value = 'R$ 600,00';
    salvarEdicaoAporte();
    const editado = lancamentos.find(x => x.id === l.id).valor;
    excluirLancamento(l.id);
    const sumiu = !investimentos.some(i => i.id === inv.id);
    restaurarDaLixeira(lixeira.findIndex(x => x.id === l.id));
    const voltou = investimentos.some(i => i.id === inv.id) && lancamentos.some(x => x.id === l.id);
    abrirEditarAporte(inv.id);
    excluirAporte();
    const foiJunto = !lancamentos.some(x => x.id === l.id) && lixeira.some(x => x.id === l.id && x.__aporte);
    return { editado, sumiu, voltou, foiJunto };
  });
  t.ok(juntos.editado === '600,00', 'editar o aporte pra R$ 600 corrige o lançamento junto');
  t.ok(juntos.sumiu && juntos.voltou, 'excluir o lançamento leva o aporte; restaurar traz os dois de volta');
  t.ok(juntos.foiJunto, 'excluir o aporte leva o lançamento pra lixeira junto');

  t.secao('QUANTO VALE O GRUPO');
  const valor = await p.evaluate(() => {
    registrarAporte(1000, 'Itaú', 'Tesouro Direto', __mes(0, 2));   // agora o grupo tem 1.000 + 1.000
    abrirModalAtualizarValor('Tesouro Direto');
    const info = __texto('#infoAporteAtualizando');
    document.getElementById('valorAtualizadoAporte').value = 'R$ 2.300,00';
    salvarValorAtualizado();
    const itens = aportesDoGrupo('Tesouro Direto').map(i => i.valorAtual);
    setPeriodoInvestimentos('tudo');
    return { info, itens, total: __texto('#totalInvestido'), ganho: __texto('#ganhoPerdaTotal') };
  });
  console.log('   ', JSON.stringify(valor));
  t.ok(/2 aportes · R\$ 2\.000,00 aportado/.test(valor.info), 'a janela mostra 2 aportes e R$ 2.000 aportados');
  t.ok(valor.itens.sort().join() === '1150,00,1150,00', 'R$ 2.300 no total: repartidos na proporção (R$ 1.150 cada)');
  t.ok(/2\.000,00/.test(valor.total) && /vale R\$ 2\.300,00 hoje/.test(valor.ganho) && /\+R\$ 300,00 \(\+15,0%\)/.test(valor.ganho), 'topo: R$ 2.000 investidos, valem R$ 2.300 (+R$ 300, +15,0%, com vírgula)');

  t.secao('TOTAL INVESTIDO SOMA O CONSÓRCIO');
  const total = await p.evaluate(() => {
    abrirFormConsorcio();
    document.getElementById('nomeConsorcio').value = 'Consórcio';
    document.getElementById('parcelaConsorcio').value = 'R$ 200,00';
    document.getElementById('totalParcelasConsorcio').value = '10';
    document.getElementById('diaConsorcio').value = '1';
    document.getElementById('inicioConsorcio').value = __mes(-1, 1);
    document.getElementById('contaConsorcio').value = 'Itaú';
    salvarConsorcioModal({ preventDefault() {} });
    const pagoConsorcio = consorcioNoPeriodo(null);
    setPeriodoInvestimentos('tudo');
    const tudo = __texto('#totalInvestido');
    setPeriodoInvestimentos('mesAtual');
    const mes = { total: __texto('#totalInvestido'), rotulo: __texto('#rotuloTotalInvestido') };
    setPeriodoInvestimentos('tudo');
    return { pagoConsorcio, tudo, mes, consorcioMes: consorcioNoPeriodo(obterDataBrasilia().slice(0, 8) + '01') };
  });
  console.log('   ', JSON.stringify(total));
  t.ok(total.pagoConsorcio === 400 && /2\.400,00/.test(total.tudo), 'desde o início: R$ 2.000 de aportes + R$ 400 de consórcio pago = R$ 2.400');
  t.ok(/investido no período/i.test(total.mes.rotulo) && new RegExp((1000 + total.consorcioMes).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')).test(total.mes.total),
    'no mês atual: só o aporte deste mês (R$ 1.000) e a parcela do consórcio deste mês');
});
