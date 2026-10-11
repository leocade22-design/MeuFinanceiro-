/* FATURAS DO CARTÃO — em que fatura cada compra cai, e as formas de pagar:
   tudo (com o ajuste quando o banco cobra diferente), em partes (a fatura fica
   em aberto até terminar), levando o resto pra seguinte, e parcelando. */
const { iniciar } = require('./ajuda');

iniciar('03 · faturas', async t => {
  const p = await t.abrir();
  const CONTAS = [
    { id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5 },
    { id: 'c2', nome: 'Nubank', temCredito: true, diaFechamento: 3, diaVencimento: 10 }
  ];
  /* Cada cenário começa do zero, sem herdar o anterior. Os lançamentos vêm
     como uma função (pra usar as datas relativas da página), mandada como
     texto e montada lá dentro. */
  const cenario = async lancs => {
    await p.evaluate(() => localStorage.clear());
    await t.recarregar(p);
    await p.evaluate(({ contas, fonte }) => __semear({ contas, lancamentos: eval(fonte) }), { contas: CONTAS, fonte: '(' + lancs + ')()' });
    await t.recarregar(p);
  };

  t.secao('EM QUE FATURA A COMPRA CAI');
  const fech = await p.evaluate(contas => {
    __semear({ contas });
    const m = (k, d) => __mes(k, d);
    const f = (data, conta) => { const r = getMesFatura(data, 'Crédito à Vista', conta); return r.ano + '-' + String(r.mes + 1).padStart(2, '0'); };
    return {
      itau25: f(m(0, 25), 'Itaú') === __chaveMes(0), itau26: f(m(0, 26), 'Itaú') === __chaveMes(1),
      nu3: f(m(0, 3), 'Nubank') === __chaveMes(0), nu4: f(m(0, 4), 'Nubank') === __chaveMes(1),
      debito: (() => { const r = getMesFatura(m(0, 28), 'Pix', 'Itaú'); return r.mes === parseInt(__chaveMes(0).slice(5), 10) - 1; })(),
      dez31: (() => { const r = getMesFatura('2026-12-31', 'Crédito à Vista', 'Itaú'); return r.ano === 2027 && r.mes === 0; })(),
      jan31: (() => { const r = getMesFatura('2027-01-31', 'Crédito à Vista', 'Itaú'); return r.ano === 2027 && r.mes === 1; })()
    };
  }, CONTAS);
  t.ok(fech.itau25 && fech.itau26, 'Itaú fecha dia 25: compra no dia 25 fica no mês; no dia 26 vai pra fatura seguinte');
  t.ok(fech.nu3 && fech.nu4, 'Nubank fecha dia 3: dia 3 fica; dia 4 vai pra seguinte');
  t.ok(fech.debito, 'débito/Pix não tem fatura: conta no mês da compra');
  t.ok(fech.dez31 && fech.jan31, 'virada de ano e fim de mês: 31/12 vai pra janeiro, 31/01 vai pra fevereiro (sem pular março)');

  t.secao('PAGAR TUDO');
  await cenario(() => [
    { id: 1, tipo: 'despesa', descricao: 'Mercado', valor: '600,00', data: __mes(-1, 10), conta: 'Itaú', formaModo: 'Crédito à Vista', numParcelas: '1', categoria: 'Alimentação' },
    { id: 2, tipo: 'despesa', descricao: 'Farmácia', valor: '400,00', data: __mes(-1, 12), conta: 'Itaú', formaModo: 'Crédito à Vista', numParcelas: '1', categoria: 'Saúde' }
  ]);
  const tudo = await p.evaluate(() => {
    const [a, m] = __chaveMes(-1).split('-').map(Number);
    abrirPagarFatura('Itaú', m - 1, a);
    const prevBateu = document.getElementById('previaAjusteFatura').innerText;
    document.getElementById('faturaValorCobrado').value = 'R$ 1.012,00';
    previewAjusteFatura();
    const prevMais = document.getElementById('previaAjusteFatura').innerText;
    document.getElementById('faturaDataPagamento').value = __mes(0, 5);
    confirmarPagarFatura();
    const pg = faturasPagas[chaveFatura('Itaú', m - 1, a)];
    const aj = lancamentos.filter(l => l.ajusteFatura);
    irParaFatura(...(() => { const [a0, m0] = __chaveMes(0).split('-').map(Number); return [m0 - 1, a0]; })(), true);
    return { prevBateu, prevMais, pg, aj: aj.map(l => l.tipo + ':' + l.valor + ':' + l.data), dataAj: __mes(-1, 1),
      total: totalFaturaConta('Itaú', m - 1, a), pagasNoMes: resumoFaturaAtual.faturasPagasNoMes };
  });
  t.ok(/Bateu certinho/.test(tudo.prevBateu), 'valor do banco igual ao do app: "Bateu certinho"');
  t.ok(/O banco cobrou R\$ 12,00 a mais/.test(tudo.prevMais), 'banco cobrou R$ 12 a mais: a prévia avisa');
  t.ok(tudo.pg.modo === 'total' && tudo.pg.valorPago === '1012,00' && tudo.aj.join() === 'despesa:12,00:' + tudo.dataAj, 'paga: registro de R$ 1.012 e um ajuste de R$ 12 no dia 1º da fatura');
  t.ok(Math.abs(tudo.total - 1012) < 0.001 && Math.abs(tudo.pagasNoMes - 1012) < 0.001, 'a fatura passa a somar R$ 1.012, e sai da conta no mês do pagamento');
  const desfeito = await p.evaluate(() => {
    const [a, m] = __chaveMes(-1).split('-').map(Number);
    desfazerPagamentoFatura('Itaú', m - 1, a);
    return { pg: !!faturasPagas[chaveFatura('Itaú', m - 1, a)], ajuste: lancamentos.some(l => l.ajusteFatura) };
  });
  t.ok(!desfeito.pg && desfeito.ajuste, 'desfazer tira o pagamento; o ajuste continua (pode ter sido investigado)');

  t.secao('PAGAR EM PARTES (A FATURA FICA EM ABERTO)');
  await cenario(() => [
    { id: 1, tipo: 'despesa', descricao: 'Mercado', valor: '1.300,00', data: __mes(-1, 10), conta: 'Itaú', formaModo: 'Crédito à Vista', numParcelas: '1', categoria: 'Alimentação' },
    { id: 2, tipo: 'despesa', descricao: 'Passagem', valor: '1.000,00', data: __mes(-1, 12), conta: 'Itaú', formaModo: 'Crédito à Vista', numParcelas: '1', categoria: 'Viagens ✈️' }
  ]);
  const partes = await p.evaluate(() => {
    const [a, m] = __chaveMes(-1).split('-').map(Number);
    const mes = m - 1;
    const pagar = (modo, valor, data, extra) => {
      abrirPagarFatura('Itaú', mes, a);
      setModoPagamentoFatura(modo);
      if (extra) extra();
      if (valor) document.getElementById('faturaValorPago').value = valor;
      document.getElementById('faturaDataPagamento').value = data;
      previewAjusteFatura();
      const prev = document.getElementById('previaAjusteFatura').innerText;
      confirmarPagarFatura();
      return prev;
    };
    const r = {};
    r.prev1 = pagar('parcial', 'R$ 1.000,00', __mes(0, 2), () => { document.getElementById('faturaValorCobrado').value = 'R$ 2.500,00'; });
    r.e1 = estadoFatura('Itaú', mes, a);
    r.ajustesEmParte = lancamentos.filter(l => l.ajusteFatura).length;
    // a janela de continuar
    abrirPagarFatura('Itaú', mes, a);
    r.caixa = __texto('#faturaJaPago');
    r.botoes = [...document.querySelectorAll('#modosPagamentoFatura .btn-periodo')].map(b => b.textContent).join('|');
    fecharModal('modalPagarFatura');
    // pagar mais do que falta é barrado
    abrirPagarFatura('Itaú', mes, a); setModoPagamentoFatura('parcial');
    document.getElementById('faturaValorPago').value = 'R$ 1.600,00'; previewAjusteFatura();
    r.passou = document.getElementById('previaAjusteFatura').innerText;
    confirmarPagarFatura();
    r.bloqueou = estadoFatura('Itaú', mes, a).pago === 1000;
    fecharModal('modalPagarFatura');
    r.prev2 = pagar('parcial', 'R$ 700,00', __mes(0, 5));
    r.e2 = estadoFatura('Itaú', mes, a);
    // lido com a aba e o card abertos, como a pessoa vê (escondido, o texto sai grudado)
    __aba('abaFaturas');
    if (!secaoEstaAberta('pagamentoFatura')) alternarSecao('pagamentoFatura');
    irParaFatura(mes, a, true);
    r.card = [...document.querySelectorAll('#listaPagamentoFatura .item-lancamento')].map(x => x.innerText.replace(/\s+/g, ' ')).find(x => /Itaú/.test(x));
    r.trilho = __texto('#listaPagamentoFatura .mes-fatura.selecionado');
    r.emAberto = resumoFaturaAtual.faturaEmAberto;
    r.prev3 = pagar('total', null, __mes(1, 2));
    r.e3 = estadoFatura('Itaú', mes, a);
    r.ajustes = lancamentos.filter(l => l.ajusteFatura).map(l => l.valor);
    const [a0, m0] = __chaveMes(0).split('-').map(Number);
    irParaFatura(m0 - 1, a0, true); r.saiuEsteMes = resumoFaturaAtual.faturasPagasNoMes;
    const [a1, m1] = __chaveMes(1).split('-').map(Number);
    irParaFatura(m1 - 1, a1, true); r.saiuProximo = resumoFaturaAtual.faturasPagasNoMes;
    // desfazer volta um passo só; quitar de novo não cria outro ajuste
    desfazerPagamentoFatura('Itaú', mes, a);
    r.e4 = estadoFatura('Itaú', mes, a);
    pagar('total', null, __mes(1, 2));
    r.ajustesDepois = lancamentos.filter(l => l.ajusteFatura).length;
    desfazerPagamentoFatura('Itaú', mes, a);
    // ✕ tira uma parte
    abrirPagarFatura('Itaú', mes, a);
    const i700 = estadoFatura('Itaú', mes, a).pagamentos.findIndex(x => x.valor === 700);
    tirarPagamentoFatura(i700);
    r.e5 = estadoFatura('Itaú', mes, a);
    fecharModal('modalPagarFatura');
    return r;
  });
  console.log('   card:', partes.card);
  t.ok(/Falta R\$ 1\.500,00\. A fatura continua em aberto/.test(partes.prev1) && /diferença de R\$ 200,00/.test(partes.prev1), 'R$ 1.000 de R$ 2.500: "falta R$ 1.500", e os R$ 200 a mais viram ajuste só no fechamento');
  t.ok(partes.e1.situacao === 'emParte' && partes.e1.falta === 1500 && partes.ajustesEmParte === 0, 'a fatura fica em parte, sem ajuste ainda');
  t.ok(/Banco cobrou R\$ 2\.500,00/.test(partes.caixa) && /Falta R\$ 1\.500,00/.test(partes.caixa) && partes.botoes === 'O que falta|Mais uma parte|Parcelei', 'ao voltar: banco cobrou, a parte paga, o que falta, e os botões de continuar');
  t.ok(/Passou do que falta pagar \(R\$ 1\.500,00\)/.test(partes.passou) && partes.bloqueou, 'pagar mais do que falta é barrado');
  t.ok(partes.e2.pago === 1700 && partes.e2.falta === 800, 'mais uma parte de R$ 700: faltam R$ 800');
  t.ok(/pago R\$ 1\.700,00 de R\$ 2\.500,00/.test(partes.card) && /R\$ 800,00 falta/.test(partes.card) && /R\$ 800,00 falta pagar/.test(partes.trilho), 'card e trilho mostram o que falta, em amarelo');
  t.ok(Math.abs(partes.emAberto - 800) < 0.001, '"fatura em aberto" do mês conta só os R$ 800');
  t.ok(/Você paga agora R\$ 800,00, o que faltava\. A fatura fica quitada: R\$ 2\.500,00 em 3 pagamentos\./.test(partes.prev3), 'terminar: paga os R$ 800 e quita em 3 pagamentos');
  t.ok(partes.e3.situacao === 'paga' && partes.ajustes.join() === '200,00', 'quitada, e só agora entra o ajuste de R$ 200');
  t.ok(Math.abs(partes.saiuEsteMes - 1700) < 0.001 && Math.abs(partes.saiuProximo - 800) < 0.001, 'cada parte sai da conta no mês em que foi paga (1.700 neste, 800 no próximo)');
  t.ok(partes.e4.situacao === 'emParte' && partes.e4.pago === 1700 && partes.ajustesDepois === 1, 'desfazer volta um passo (em parte, R$ 1.700); quitar de novo não duplica o ajuste');
  t.ok(partes.e5.pago === 1000 && partes.e5.falta === 1500, 'o ✕ tira só a parte de R$ 700');

  t.secao('LEVAR O RESTO PRA SEGUINTE, COM JUROS');
  await cenario(() => [
    { id: 1, tipo: 'despesa', descricao: 'Compras', valor: '1.000,00', data: __mes(-2, 1), conta: 'Nubank', formaModo: 'Crédito à Vista', numParcelas: '1', categoria: 'Outros' }
  ]);
  const levar = await p.evaluate(() => {
    const [a, m] = __chaveMes(-2).split('-').map(Number);
    const [a1, m1] = __chaveMes(-1).split('-').map(Number);
    abrirPagarFatura('Nubank', m - 1, a);
    setModoPagamentoFatura('parcial');
    document.getElementById('faturaValorPago').value = 'R$ 400,00';
    const jurosAntes = !document.getElementById('wrapJurosParcial').classList.contains('escondido');
    document.getElementById('faturaLevarResto').checked = true; setModoPagamentoFatura('parcial', true);
    document.getElementById('faturaJurosParcial').value = 'R$ 50,00'; previewAjusteFatura();
    const prev = document.getElementById('previaAjusteFatura').innerText;
    confirmarPagarFatura();
    const r = { jurosAntes, prev, e: estadoFatura('Nubank', m - 1, a),
      seguinte: totalFaturaConta('Nubank', m1 - 1, a1), itens: itensTrazidosParaFatura('Nubank', m1 - 1, a1).map(i => i.rotulo + ':' + i.valor),
      juros: lancamentos.filter(l => l.encargoFatura).map(l => l.categoria + ':' + l.valor),
      semLancSaldo: !lancamentos.some(l => /Saldo da fatura/.test(l.descricao)) };
    desfazerPagamentoFatura('Nubank', m - 1, a);
    r.depois = { pg: !!faturasPagas[chaveFatura('Nubank', m - 1, a)], seguinte: totalFaturaConta('Nubank', m1 - 1, a1), juros: lancamentos.filter(l => l.encargoFatura).length };
    return r;
  });
  t.ok(!levar.jurosAntes && /Sobram R\$ 600,00, que vão pra fatura de/.test(levar.prev) && /R\$ 50,00 de juros/.test(levar.prev), 'os juros só aparecem ao marcar "levar o resto"; sobram R$ 600 + R$ 50 de juros');
  t.ok(levar.e.situacao === 'levada' && Math.abs(levar.seguinte - 650) < 0.001 && levar.itens.length === 1, 'fatura seguinte: R$ 600 do saldo + R$ 50 de juros');
  t.ok(levar.juros.join() === 'Juros e encargos:50,00' && levar.semLancSaldo, 'juros viram gasto em "Juros e encargos"; o saldo levado não vira lançamento (não conta duas vezes)');
  t.ok(!levar.depois.pg && levar.depois.seguinte === 0 && levar.depois.juros === 0, 'desfazer tira o registro, o saldo levado e os juros');

  t.secao('PARCELAR A FATURA');
  await cenario(() => [
    { id: 1, tipo: 'despesa', descricao: 'Compras do mês', valor: '3.954,49', data: __mes(-1, 1), conta: 'Nubank', formaModo: 'Crédito à Vista', numParcelas: '1', categoria: 'Casa' }
  ]);
  const parc = await p.evaluate(() => {
    const [a, m] = __chaveMes(-1).split('-').map(Number);
    abrirPagarFatura('Nubank', m - 1, a);
    setModoPagamentoFatura('parcelado');
    document.getElementById('faturaValorPago').value = 'R$ 593,17';
    document.getElementById('faturaNumParcelas').value = '10';
    document.getElementById('faturaValorParcela').value = 'R$ 300,00'; previewAjusteFatura();
    const erro = document.getElementById('previaAjusteFatura').innerText;
    confirmarPagarFatura();
    const bloqueou = !faturasPagas[chaveFatura('Nubank', m - 1, a)];
    document.getElementById('faturaValorParcela').value = 'R$ 410,00'; previewAjusteFatura();
    const prev = document.getElementById('previaAjusteFatura').innerText;
    confirmarPagarFatura();
    const chave = chaveFatura('Nubank', m - 1, a);
    const meses = []; for (let k = 1; k <= 11; k++) { const x = mesAdiante(m - 1, a, k); meses.push(Math.round(totalFaturaConta('Nubank', x.mes, x.ano) * 100) / 100); }
    const juros = lancamentos.filter(l => l.encargoFatura === chave);
    return { erro, bloqueou, prev, pg: faturasPagas[chave], meses, nJuros: juros.length, somaJuros: juros.reduce((s, l) => s + parseVal(l.valor), 0) };
  });
  console.log('   faturas seguintes:', JSON.stringify(parc.meses));
  t.ok(/menos que os R\$ 3\.361,32 parcelados/.test(parc.erro) && parc.bloqueou, 'parcela baixa demais: avisa e não deixa confirmar');
  t.ok(/Parcelado: R\$ 3\.361,32/.test(parc.prev) && /10 × R\$ 410,00 = R\$ 4\.100,00/.test(parc.prev) && /Juros: R\$ 738,68 \(R\$ 73,87 por mês/.test(parc.prev), 'prévia: R$ 3.361,32 parcelados em 10 × R$ 410, juros de R$ 738,68');
  t.ok(parc.pg.modo === 'parcelado' && parc.pg.valorPago === '593,17', 'registro: parcelada, a entrada é o que sai da conta agora');
  t.ok(parc.meses.slice(0, 10).every(v => Math.abs(v - 410) < 0.001) && parc.meses[10] === 0, 'R$ 410 em cada uma das 10 faturas seguintes, nada na 11ª');
  t.ok(parc.nJuros === 10 && Math.abs(parc.somaJuros - 738.68) < 0.001, 'juros: 10 lançamentos somando R$ 738,68');

  t.secao('REGISTROS ANTIGOS');
  await cenario(() => [
    { id: 1, tipo: 'despesa', descricao: 'Antiga', valor: '300,00', data: __mes(-4, 5), conta: 'Itaú', formaModo: 'Crédito à Vista', numParcelas: '1', categoria: 'Casa' },
    { id: 2, tipo: 'despesa', descricao: 'Antiga 2', valor: '1.000,00', data: __mes(-3, 5), conta: 'Itaú', formaModo: 'Crédito à Vista', numParcelas: '1', categoria: 'Casa' }
  ]);
  const antigos = await p.evaluate(() => {
    const k = n => { const [a, m] = __chaveMes(n).split('-').map(Number); return [m - 1, a]; };
    faturasPagas[chaveFatura('Itaú', ...k(-4))] = { valorPago: '300,00', data: __mes(-3, 3) };
    faturasPagas[chaveFatura('Itaú', ...k(-3))] = { valorPago: '400,00', data: __mes(-3, 28), modo: 'parcial', saldo: '600,00', juros: '0,00' };
    const e4 = estadoFatura('Itaú', ...k(-4)), e3 = estadoFatura('Itaú', ...k(-3));
    const trazido = itensTrazidosParaFatura('Itaú', ...k(-2)).map(i => i.valor);
    irParaFatura(...k(-3), true);
    return { e4: e4.situacao + ':' + e4.pago, e3: e3.situacao + ':' + e3.pago, trazido, pagas: resumoFaturaAtual.faturasPagasNoMes };
  });
  t.ok(antigos.e4 === 'paga:300' && antigos.e3 === 'levada:400' && antigos.trazido.join() === '600', 'registro antigo "paga" e "paga em parte" com saldo levado mantêm o sentido');
  t.ok(Math.abs(antigos.pagas - 700) < 0.001, 'e entram no saldo do mês como antes (R$ 300 + R$ 400)');
});
