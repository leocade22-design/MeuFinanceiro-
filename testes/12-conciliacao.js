/* DIFERENÇA COM O BANCO E CONCILIAÇÃO DA FATURA — o caso real de novembro,
   com nomes trocados: o app somava muito mais que o banco (uma hospedagem
   que só vem na fatura seguinte, uma assinatura que o banco não cobrou), e
   o banco tinha o que o app não tinha (uma assinatura e um estorno).

   Pagar com diferença pergunta o que fazer com ela (conciliar, levar pra
   próxima, lançar ajuste). A conciliação marca item por item, importa o
   arquivo do banco, sugere os pares e lança o que só está lá. Estorno no
   cartão abate a fatura e não entra no saldo. */
const { iniciar } = require('./ajuda');

iniciar('12 · conciliação da fatura', async t => {
  const p = await t.abrir();
  const CONTAS = [
    { id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5 },
    { id: 'c2', nome: 'PicPay', temCredito: false }
  ];
  const cenario = async () => {
    await p.evaluate(() => localStorage.clear());
    await t.recarregar(p);
    await p.evaluate(contas => {
      const L = (id, descricao, valor, dia, extra) => Object.assign({ id, tipo: 'despesa', descricao, valor, data: __mes(-1, dia), conta: 'Itaú',
        formaModo: 'Crédito à Vista', numParcelas: '1', categoria: 'Outros' }, extra || {});
      __semear({ contas, lancamentos: [
        L(1, 'Mercado', '300,00', 5, { categoria: 'Alimentação' }),
        L(2, 'Farmácia', '54,95', 8, { categoria: 'Saúde' }),
        L(3, 'Hospedagem praia', '820,00', 10, { categoria: 'Viagens' }),
        L(4, 'Presente', '66,66', 12),
        L(5, 'Streaming', '57,80', 15, { categoria: 'Lazer' }),
        L(6, 'Loja X (3/10)', '150,00', 20, { formaModo: 'Crédito Parcelado', grupoId: 'g1', numParcelas: '10' }),
        { id: 7, tipo: 'receita', descricao: 'Salário', valor: '5.000,00', data: __mes(0, 1), conta: 'PicPay', formaModo: 'Pix' }
      ] });
    }, CONTAS);
    await t.recarregar(p);
  };
  const csv = () => p.evaluate(() => {
    const d = (k, dia) => { const x = __mes(k, dia); return x.slice(8, 10) + '/' + x.slice(5, 7) + '/' + x.slice(0, 4); };
    return ['Data;Lançamento;Valor',
      `${d(-1, 5)};MERCADO BOM PRECO;300,00`,
      `${d(-1, 9)};FARMACIA SAO JOAO;54,95`,
      `${d(-1, 12)};PRESENTES LTDA;66,66`,
      `${d(-4, 20)};LOJA X 03/10;150,00`,
      `${d(-1, 18)};ASSINATURA NOVA;19,90`,
      `${d(-1, 22)};ESTORNO LOJA Y;-12,74`,
      `${d(-1, 2)};PAGAMENTO EFETUADO;-1.200,00`,
      'Total;;578,77'].join('\n');
  });
  const pagarCom = (como) => p.evaluate(como => {
    const [a, m] = __chaveMes(-1).split('-').map(Number);
    abrirPagarFatura('Itaú', m - 1, a);
    document.getElementById('faturaValorCobrado').value = 'R$ 578,77';
    document.getElementById('faturaDataPagamento').value = __mes(0, 5);
    previewAjusteFatura();
    const bloco = !document.getElementById('blocoDiferencaFatura').classList.contains('escondido');
    const textos = __texto('#blocoDiferencaFatura');
    if (como) document.querySelector(`input[name="comoDiferencaFatura"][value="${como}"]`).checked = true;
    confirmarPagarFatura();
    return { bloco, textos, pg: faturasPagas[chaveFatura('Itaú', m - 1, a)] || null };
  }, como);

  t.secao('PAGAR COM DIFERENÇA: O APP PERGUNTA');
  await cenario();
  const semEscolha = await pagarCom(null);
  t.ok(semEscolha.bloco && !semEscolha.pg, 'banco cobrou R$ 870,64 a menos: aparecem as três saídas, e sem escolher não paga');
  t.ok(/Deixar a conciliar/.test(semEscolha.textos) && /Levar pra fatura de/.test(semEscolha.textos) && /Cria um estorno de R\$ 870,64/.test(semEscolha.textos),
    'as saídas dizem o valor e o mês: conciliar, levar pra próxima, lançar estorno de R$ 870,64');
  await p.evaluate(() => fecharModal('modalPagarFatura'));

  t.secao('LANÇAR AJUSTE: ESTORNO ABATE A FATURA, NÃO ENTRA NO SALDO');
  const ajuste = await pagarCom('ajuste');
  const efeito = await p.evaluate(() => {
    const [a, m] = __chaveMes(-1).split('-').map(Number);
    const est = lancamentos.find(l => l.ajusteFatura);
    irParaFatura(...(() => { const [a0, m0] = __chaveMes(0).split('-').map(Number); return [m0 - 1, a0]; })(), true);
    return { tipo: est && est.tipo, valor: est && est.valor, total: Math.round(totalFaturaConta('Itaú', m - 1, a) * 100) / 100,
      itau: Math.round(resumoFaturaAtual.porContaAcumulado['Itaú'] * 100) / 100, recebido: resumoFaturaAtual.totalRecebimentos };
  });
  t.ok(ajuste.pg && ajuste.pg.diferenca.como === 'ajuste' && efeito.tipo === 'receita' && efeito.valor === '870,64', 'vira um estorno de R$ 870,64 no cartão');
  t.ok(efeito.total === 578.77, 'a fatura do app passa a somar o que o banco cobrou (R$ 578,77)');
  t.ok(efeito.itau === -578.77 && efeito.recebido === 5000, 'o saldo do Itaú só perde o pagamento (−R$ 578,77) e o estorno não vira "recebido"');

  t.secao('LEVAR PRA PRÓXIMA FATURA');
  await cenario();
  const proxima = await pagarCom('proxima');
  const prox = await p.evaluate(() => {
    const [a1, m1] = __chaveMes(0).split('-').map(Number);
    return { total: Math.round(totalFaturaConta('Itaú', m1 - 1, a1) * 100) / 100, itens: itensTrazidosParaFatura('Itaú', m1 - 1, a1).map(i => i.rotulo + ':' + i.valor),
      ajustes: lancamentos.filter(l => l.ajusteFatura).length };
  });
  t.ok(proxima.pg.diferenca.como === 'proxima' && prox.ajustes === 0, 'nenhum lançamento criado');
  t.ok(prox.total === 870.64 && /Diferença da fatura de .* \(o banco cobra agora\):870.64/.test(prox.itens.join()), 'a fatura seguinte ganha os R$ 870,64, como diferença (não como gasto novo)');

  t.secao('DEIXAR A CONCILIAR E CONCILIAR ITEM POR ITEM');
  await cenario();
  const conc = await pagarCom('conciliar');
  const aberta = await p.evaluate(() => {
    const [a, m] = __chaveMes(-1).split('-').map(Number);
    return { aberta: conciliacaoAberta(), titulo: __texto('#tituloConciliarFatura'), banco: document.getElementById('conciliarTotalBanco').value,
      resumo: __texto('#resumoConciliacao'), pendentes: document.querySelectorAll('#listaConciliacao .linha-conciliar.pendente').length,
      ajustes: lancamentos.filter(l => l.ajusteFatura).length, mes: m - 1, ano: a };
  });
  t.ok(conc.pg.diferenca.como === 'conciliar' && aberta.ajustes === 0, 'nada muda nos lançamentos');
  t.ok(aberta.aberta && /Conciliar · Itaú/.test(aberta.titulo) && aberta.banco === 'R$ 578,77', 'a conciliação abre sozinha, com o total do banco já preenchido');
  t.ok(/Somado no app R\$ 1\.449,41/.test(aberta.resumo) && /Banco − app − R\$ 870,64/.test(aberta.resumo) && aberta.pendentes === 6,
    'resumo: app R$ 1.449,41, banco − app = − R$ 870,64, e os 6 itens em destaque (nenhum conferido)');

  const importado = await p.evaluate(texto => {
    receberLinhasDoBanco(lerArquivoDoBanco(texto, conciliacaoAtual));
    const cc = conciliacaoAtual;
    return { pares: Object.entries(cc.pares).map(([k, b]) => k + '=' + b.desc).sort(), soNoBanco: cc.soNoBanco.map(b => b.desc + ':' + b.valor),
      pagamento: cc.banco.filter(b => b.pagamento).map(b => b.desc), sugestoes: __texto('#sugestoesConciliacao') };
  }, await csv());
  console.log('   pares:', importado.pares.join(' · '));
  t.ok(importado.pares.length === 4 && importado.pares.some(x => /^l:6=LOJA X 03\/10$/.test(x)) && importado.pares.some(x => /^l:2=FARMACIA/.test(x)),
    'CSV do banco: 4 pares (mesma data, 1 dia de diferença, e a parcela pela data da compra)');
  t.ok(importado.soNoBanco.join() === 'ASSINATURA NOVA:19.9,ESTORNO LOJA Y:-12.74' && importado.pagamento.join() === 'PAGAMENTO EFETUADO',
    'só no banco: a assinatura e o estorno; o pagamento da fatura anterior fica de fora');
  t.ok(/6 itens, R\$ 578,77/.test(importado.sugestoes) && /2 só no app/.test(importado.sugestoes), 'o arquivo soma os R$ 578,77 do banco; 2 itens só no app');

  const aplicado = await p.evaluate(() => {
    aplicarSugestoesConciliacao();
    // lança o estorno e a assinatura que só estão no banco
    const cc = conciliacaoAtual;
    lancarItemSoNoBanco(cc.soNoBanco.find(b => b.valor < 0).id);
    const tituloEstorno = __texto('#tituloItemDoBanco');
    confirmarItemDoBanco();
    lancarItemSoNoBanco(conciliacaoAtual.soNoBanco[0].id);
    document.getElementById('itemBancoCategoria').value = 'Lazer';
    confirmarItemDoBanco();
    const novos = lancamentos.filter(l => /conciliação/.test(l.observacao || '')).map(l => l.tipo + ':' + l.valor + ':' + l.formaModo);
    return { tituloEstorno, novos, pendentes: [...document.querySelectorAll('#listaConciliacao .linha-conciliar.pendente strong')].map(x => x.textContent),
      resumo: __texto('#resumoConciliacao') };
  });
  t.ok(/Estorno/.test(aplicado.tituloEstorno) && aplicado.novos.sort().join() === 'despesa:19,90:Crédito à Vista,receita:12,74:Crédito à Vista',
    'o que só está no banco entra no cartão: a assinatura como compra, o estorno como estorno');
  t.ok(aplicado.pendentes.sort().join() === 'Hospedagem praia,Streaming', 'ficam em destaque só os 2 itens que o banco não cobrou');

  // a hospedagem vem na fatura seguinte (data depois do fechamento) e o streaming foi cancelado
  const resolvido = await p.evaluate(() => {
    const hosp = lancamentos.find(l => l.descricao === 'Hospedagem praia');
    prepararEdicao(hosp.id);
    document.getElementById('dataCompra').value = __mes(-1, 26);
    executarSalvarLancamento(820);
    excluirLancamento(lancamentos.find(l => l.descricao === 'Streaming').id);
    const resumo = __texto('#resumoConciliacao');
    fecharConciliacaoFatura();
    __aba('abaFaturas');
    if (!secaoEstaAberta('pagamentoFatura')) alternarSecao('pagamentoFatura');
    const [a, m] = __chaveMes(-1).split('-').map(Number);
    irParaFatura(m - 1, a, true);
    const card = [...document.querySelectorAll('#listaPagamentoFatura .item-lancamento')].map(x => x.innerText.replace(/\s+/g, ' ')).find(x => /Itaú/.test(x));
    // reabrir: o total do banco volta (vem do que o banco cobrou no pagamento)
    abrirConciliacaoFatura('Itaú', m - 1, a);
    const bancoDeNovo = document.getElementById('conciliarTotalBanco').value;
    fecharConciliacaoFatura();
    return { resumo, card, conc: conciliacoes[chaveFatura('Itaú', m - 1, a)], bancoDeNovo };
  });
  console.log('   card:', resolvido.card);
  t.ok(/✓ Fatura conciliada/.test(resolvido.resumo), 'com os dois corrigidos o total bate e tudo foi conferido: "Fatura conciliada"');
  t.ok(/✓ conciliada com o banco/.test(resolvido.card), 'e o card da fatura troca o "a conciliar" por "conciliada com o banco"');
  t.ok(resolvido.conc && resolvido.conc.ok.length === 6 && resolvido.bancoDeNovo === 'R$ 578,77', 'a conferência fica guardada: reabrir mostra os 6 itens conferidos e o total do banco');

  t.secao('ARQUIVO OFX E BACKUP');
  const ofx = await p.evaluate(() => {
    const cc = { mes: 9, ano: 2026 };
    const texto = '<OFX><BANKTRANLIST>'
      + '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005120000[-3:BRT]<TRNAMT>-123.45<MEMO>PADARIA</STMTTRN>'
      + '<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261010<TRNAMT>12.74<MEMO>ESTORNO</STMTTRN>'
      + '<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261002<TRNAMT>900.00<MEMO>PAGAMENTO RECEBIDO</STMTTRN>'
      + '</BANKTRANLIST></OFX>';
    return lerArquivoDoBanco(texto, cc).map(i => i.data + ' ' + i.desc + ' ' + i.valor + (i.pagamento ? ' (pagamento)' : ''));
  });
  t.ok(ofx.join(' | ') === '2026-10-05 PADARIA 123.45 | 2026-10-10 ESTORNO -12.74 | 2026-10-02 PAGAMENTO RECEBIDO -900 (pagamento)',
    'OFX: compra positiva, estorno negativo, pagamento marcado à parte');
  // restaurar um backup traz a conferência de volta (e um backup antigo, sem ela, começa vazio)
  const restaurar = dados => p.evaluate(async dados => {
    window.__ultimoAviso = null;
    const arquivo = new File([JSON.stringify(dados)], 'backup.json', { type: 'application/json' });
    importarBackup({ target: { files: [arquivo], value: '' } });
    for (let i = 0; i < 50 && !window.__ultimoAviso; i++) await new Promise(r => setTimeout(r, 20));
    fecharModal('modalAviso');
    return { aviso: window.__ultimoAviso, conc: JSON.stringify(conciliacoes) };
  }, dados);
  const base = { lancamentos: [], fixos: [], contas: CONTAS, faturasPagas: {} };
  const comConc = await restaurar(Object.assign({ conciliacoes: { 'Itaú|2026-10': { ok: ['l:1'], banco: '10,00' } } }, base));
  const semConc = await restaurar(base);
  // o arquivo que o Exportar grava leva a conferência junto
  const exporta = await p.evaluate(async () => {
    conciliacoes = { 'Itaú|2026-10': { ok: ['l:1'], banco: '10,00' } };
    const dados = JSON.parse(await montarBackup().blob.text());
    return JSON.stringify(dados.conciliacoes) === '{"Itaú|2026-10":{"ok":["l:1"],"banco":"10,00"}}';
  });
  t.ok(exporta && comConc.aviso === 'backupOk' && comConc.conc === '{"Itaú|2026-10":{"ok":["l:1"],"banco":"10,00"}}'
    && semConc.conc === '{}', 'a conferência vai e volta no backup; backup antigo, sem ela, começa vazio');

  t.secao('AVISO DA ATUALIZAÇÃO (ESTORNO DEIXOU DE SER DINHEIRO)');
  const aviso = async lancs => {
    await p.evaluate(() => localStorage.clear());
    await t.recarregar(p);
    await p.evaluate(({ contas, lancs }) => {
      __semear({ contas, lancamentos: lancs.map(l => Object.assign({ data: __mes(-1, 1), conta: 'Itaú', formaModo: 'Crédito à Vista', numParcelas: '1', categoria: '' }, l)) });
      localStorage.removeItem('meu_financeiro_aviso_estorno_v1');   // como na primeira abertura da versão nova
    }, { contas: CONTAS, lancs });
    await t.recarregar(p);
    return p.evaluate(() => ({ visivel: !document.getElementById('avisoEstornoSaldo').classList.contains('escondido'), texto: __texto('#textoAvisoEstorno') }));
  };
  const comAjuste = await aviso([{ id: 1, tipo: 'receita', descricao: 'Ajuste de fatura — estorno', valor: '1.099,60', ajusteFatura: true }]);
  const semAjuste = await aviso([{ id: 1, tipo: 'receita', descricao: 'Cancelamento parcial (estorno)', valor: '12,74' }]);
  t.ok(comAjuste.visivel && /Itaú \(R\$ 1\.099,60\)/.test(comAjuste.texto), 'ajuste de estorno antigo: o aviso diz quanto o saldo do Itaú mudou');
  t.ok(!semAjuste.visivel, 'estorno lançado já com a regra nova (conciliação, backup corrigido) não gera aviso');
  const manter = await p.evaluate(async () => {
    localStorage.removeItem('meu_financeiro_aviso_estorno_v1');
    lancamentos = [{ id: 1, tipo: 'receita', descricao: 'Ajuste de fatura — estorno', valor: '100,00', data: __mes(-1, 1), conta: 'Itaú', formaModo: 'Crédito à Vista', ajusteFatura: true }];
    salvarLocalStorage();
    prepararAvisoEstorno(); atualizarTudo();
    const antes = Math.round(saldoDaContaAgora('Itaú') * 100) / 100;
    manterSaldoDeAntesDoEstorno();
    return { antes, depois: Math.round(saldoDaContaAgora('Itaú') * 100) / 100, some: document.getElementById('avisoEstornoSaldo').classList.contains('escondido'), hist: correcoesSaldo.length };
  });
  t.ok(manter.depois === manter.antes + 100 && manter.some && manter.hist === 1, '"Manter o saldo de antes" devolve o valor ao saldo, com registro no histórico, e o aviso some');
});
