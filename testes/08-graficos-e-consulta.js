/* GRÁFICOS E CONSULTA RÁPIDA — a régua do consumo: a compra conta na data em
   que foi feita, no débito ou no crédito. Categorias, metas, "descontar
   reembolsos", ranking, comprometido futuro, e as respostas da Consulta. */
const { iniciar } = require('./ajuda');

iniciar('08 · gráficos e consulta rápida', async t => {
  const p = await t.abrir();
  await p.evaluate(() => {
    const d = n => __mes(0, n);
    __semear({
      contas: [{ id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5 }],
      lancamentos: [
        { id: 1, tipo: 'receita', descricao: 'Salário', valor: '5.000,00', data: d(1), conta: 'Itaú', formaModo: 'À Vista / Débito' },
        { id: 2, tipo: 'despesa', descricao: 'Mercado', valor: '400,00', data: d(1), conta: 'Itaú', formaModo: 'Crédito à Vista', categoria: 'Alimentação' },
        { id: 3, tipo: 'despesa', descricao: 'Restaurante', valor: '150,00', data: d(1), conta: 'Itaú', formaModo: 'Pix', categoria: 'Alimentação' },
        { id: 4, tipo: 'despesa', descricao: 'Cinema', valor: '80,00', data: d(1), conta: 'Itaú', formaModo: 'Pix', categoria: 'Lazer' },
        { id: 5, tipo: 'despesa', descricao: 'Jantar', valor: '200,00', data: d(1), conta: 'Itaú', formaModo: 'Pix', categoria: 'Lazer',
          emprestimoPara: 'Borges', emprestimoRateio: [{ nome: 'Borges', valor: '100,00', quitado: true }], emprestimoQuitado: true },
        { id: 6, tipo: 'despesa', descricao: 'Uber', valor: '60,00', data: d(1), conta: 'Itaú', formaModo: 'Pix', categoria: 'Transporte',
          emprestimoPara: 'Ana', emprestimoRateio: [{ nome: 'Ana', valor: '30,00', quitado: false }] },
        { id: 7, tipo: 'despesa', descricao: 'Mercado mês passado', valor: '300,00', data: __mes(-1, 10), conta: 'Itaú', formaModo: 'Pix', categoria: 'Alimentação' }
      ],
      metas: { 'Alimentação': 500, 'Lazer': 300 }
    });
  });
  await t.recarregar(p);
  await p.evaluate(() => __lancar({ descricao: 'Celular', valor: '900,00', conta: 'Itaú', forma: 'Crédito Parcelado', parcelas: 3, categoria: 'Outros', data: __mes(0, 1) }));

  t.secao('CATEGORIAS PELA DATA DA COMPRA');
  const g = await p.evaluate(() => {
    __aba('abaGraficos');
    setFiltroPeriodoGraficos('mesAtual', 'Este mês');
    return { desp: __texto('#graficoDespesa'), rec: __texto('#graficoReceita'), saldo: __texto('#graficoSaldo'),
      alim: obterGastoCategoriaPeriodo('Alimentação'), lazer: obterGastoCategoriaPeriodo('Lazer'), outros: obterGastoCategoriaPeriodo('Outros'),
      barras: __texto('#containerGraficoCategorias') };
  });
  console.log('   ', JSON.stringify({ desp: g.desp, rec: g.rec, saldo: g.saldo, alim: g.alim, lazer: g.lazer, outros: g.outros }));
  t.ok(g.desp === 'R$ 1.190,00' && g.rec === 'R$ 5.000,00' && g.saldo === 'R$ 3.810,00', 'mês: gastei R$ 1.190 (crédito e débito juntos), recebi R$ 5.000');
  t.ok(g.alim === 550 && g.lazer === 280 && g.outros === 300, 'Alimentação R$ 550 (o crédito entra na data da compra) · Lazer R$ 280 · Outros R$ 300 (só a 1ª parcela)');
  t.ok(/Alimentação/.test(g.barras) && /550,00/.test(g.barras), 'o gráfico de categorias mostra Alimentação com R$ 550');

  t.secao('DESCONTAR REEMBOLSOS');
  const desc = await p.evaluate(() => {
    document.getElementById('chkDescontarReembolsos').checked = true;
    alternarDescontarReembolsos();
    const barras = __texto('#containerGraficoCategorias');
    const topo = __texto('#graficoDespesa');
    document.getElementById('chkDescontarReembolsos').checked = false;
    alternarDescontarReembolsos();
    return { barras, topo };
  });
  t.ok(/180,00/.test(desc.barras) && !/280,00/.test(desc.barras), 'ligado: Lazer cai pra R$ 180 (o Borges já devolveu R$ 100 do jantar)');
  t.ok(desc.topo === 'R$ 1.190,00', 'o "gastei" do topo continua bruto: foi o que saiu na hora');

  t.secao('METAS POR CATEGORIA');
  const metas = await p.evaluate(() => {
    const resumo = __texto('#resumoMetas');
    setFiltroPeriodoGraficos('anoAtual', 'Este ano');
    const anual = metaDoPeriodo('Alimentação');
    setFiltroPeriodoGraficos('mesAtual', 'Este mês');
    return { resumo, anual };
  });
  t.ok(/1 estourou/.test(metas.resumo), 'Alimentação passou dos R$ 500: "1 estourou"');
  t.ok(metas.anual === 6000, 'no ano, o teto vira 12 metas mensais (R$ 6.000)');

  t.secao('RANKING E COMPROMETIDO FUTURO');
  const outros = await p.evaluate(() => ({ ranking: __texto('#containerRankingGastos'), futuro: __texto('#containerComprometidoFuturo') }));
  console.log('   ranking:', outros.ranking.slice(0, 120));
  t.ok(outros.ranking.indexOf('Mercado') < outros.ranking.indexOf('Celular') && outros.ranking.indexOf('Celular') < outros.ranking.indexOf('Jantar'), 'ranking: Mercado (400), Celular (300), Jantar (200)...');
  t.ok((outros.futuro.match(/300,00/g) || []).length >= 2, 'comprometido nos próximos meses: as 2 parcelas restantes do celular');

  t.secao('CONSULTA RÁPIDA');
  const consulta = await p.evaluate(() => {
    const r = tx => { const s = semAcento(tx); return (montarRespostaPergunta(s, periodoDaPergunta(s)) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); };
    return {
      ondeGastei: r('onde gastei mais esse mes'), maior: r('maior gasto do mes'), podeGastar: r('quanto posso gastar'),
      mudou: r('o que mudou'), deve: r('quem me deve'), fatura: r('fatura deste mes'), estou: r('como estou')
    };
  });
  Object.entries(consulta).forEach(([k, v]) => console.log('   ' + k + ': ' + v.slice(0, 140)));
  t.ok(/Alimentação/.test(consulta.ondeGastei) && consulta.ondeGastei.indexOf('Alimentação') < consulta.ondeGastei.indexOf('Outros'), '"onde gastei mais": Alimentação na frente');
  t.ok(/Mercado/.test(consulta.maior) && /400,00/.test(consulta.maior), '"maior gasto": o Mercado de R$ 400');
  t.ok(/Estourou em R\$ 30,00/.test(consulta.podeGastar), '"quanto posso gastar": metas somam R$ 800, gastou R$ 830 nelas → estourou R$ 30');
  t.ok(/Alimentação/.test(consulta.mudou) && /250,00/.test(consulta.mudou), '"o que mudou": Alimentação +R$ 250 em relação ao mês passado');
  t.ok(/Ana/.test(consulta.deve) && /30,00/.test(consulta.deve) && !/Borges/.test(consulta.deve), '"quem me deve": a Ana, R$ 30 (o Borges já pagou)');
  t.ok(/700,00/.test(consulta.fatura) && /2 compras/.test(consulta.fatura), '"fatura": R$ 700 em 2 compras no crédito');
  t.ok(/Gasto até agora/.test(consulta.estou) && /1\.190,00/.test(consulta.estou), '"como estou": o diagnóstico do mês com o gasto até agora');
});
