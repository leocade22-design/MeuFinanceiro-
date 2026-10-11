/* LANÇAMENTOS — o formulário, parcelado, edição, lixeira, transferência e a
   lista com filtros. */
const { iniciar } = require('./ajuda');

iniciar('02 · lançamentos', async t => {
  const p = await t.abrir();
  await p.evaluate(() => __semear({ contas: [
    { id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5 },
    { id: 'c2', nome: 'Carteira', temCredito: false }
  ] }));
  await t.recarregar(p);

  t.secao('FORMULÁRIO COM A JANELA DE CONFIRMAR');
  const pelaJanela = await p.evaluate(() => {
    alternarTipo('despesa');
    document.getElementById('descricao').value = 'Mercado';
    document.getElementById('valor').value = 'R$ 87,40';
    document.getElementById('conta').value = 'Itaú';
    atualizarVisibilidadeForma();
    document.getElementById('formaModo').value = 'Pix';
    document.getElementById('categoria').value = 'Alimentação';
    salvarLancamento({ preventDefault() {} });
    const janela = !document.getElementById('modalConfirmarLancamento').classList.contains('escondido');
    const resumo = __texto('#modalConfirmarLancamento .resumo-voz');
    const antes = lancamentos.length;
    confirmarSalvarLancamento();
    const l = lancamentos[0];
    return { janela, resumo, antes, depois: lancamentos.length, l: { d: l.descricao, v: l.valor, c: l.conta, f: l.formaModo, cat: l.categoria, data: l.data }, hoje: obterDataBrasilia(), limpo: document.getElementById('descricao').value };
  });
  console.log('   resumo da janela:', pelaJanela.resumo);
  t.ok(pelaJanela.janela && /Mercado/.test(pelaJanela.resumo) && /R\$ 87,40/.test(pelaJanela.resumo) && /Pix/.test(pelaJanela.resumo), 'lançamento novo passa pela janela de confirmar, que mostra descrição, valor e forma');
  t.ok(pelaJanela.antes === 0 && pelaJanela.depois === 1, 'só grava depois de confirmar');
  t.ok(JSON.stringify(pelaJanela.l) === JSON.stringify({ d: 'Mercado', v: '87,40', c: 'Itaú', f: 'Pix', cat: 'Alimentação', data: pelaJanela.hoje }), 'gravou certinho: ' + JSON.stringify(pelaJanela.l));
  t.ok(pelaJanela.limpo === '', 'o formulário volta limpo');

  const invalido = await p.evaluate(() => {
    document.getElementById('valor').value = '';
    salvarLancamento({ preventDefault() {} });
    const semValor = window.__ultimoAviso;
    fecharModal('modalAviso');
    document.getElementById('valor').value = 'R$ 0,00';
    salvarLancamento({ preventDefault() {} });
    const zero = window.__ultimoAviso;
    fecharModal('modalAviso');
    return { semValor, zero, qtd: lancamentos.length };
  });
  t.ok(invalido.semValor === 'semValor' && invalido.zero === 'valorInvalido' && invalido.qtd === 1, 'sem valor ou com zero: avisa e não grava');

  t.secao('RECEITA E CONTA SEM CARTÃO');
  const receita = await p.evaluate(() => {
    __lancar({ tipo: 'receita', descricao: 'Salário', valor: '5.000,00', conta: 'Itaú' });
    const r = lancamentos.find(l => l.descricao === 'Salário');
    return { tipo: r.tipo, forma: r.formaModo, cat: r.categoria, formasCarteira: formasDaConta('Carteira'), formasItau: formasDaConta('Itaú') };
  });
  t.ok(receita.tipo === 'receita' && receita.cat === '' && receita.forma === 'À Vista / Débito', 'receita grava sem categoria e à vista');
  t.ok(!receita.formasCarteira.some(f => /Crédito/.test(f)) && receita.formasItau.includes('Crédito Parcelado'), 'conta sem cartão não oferece crédito; com cartão, oferece');

  t.secao('PARCELADO NO CRÉDITO');
  const parc = await p.evaluate(() => {
    __lancar({ descricao: 'Geladeira', valor: '1.200,00', conta: 'Itaú', forma: 'Crédito Parcelado', parcelas: 3, categoria: 'Outros', data: __mes(0, 10) });
    __lancar({ descricao: 'Fone', valor: '100,00', conta: 'Itaú', forma: 'Crédito Parcelado', parcelas: 3, categoria: 'Outros', data: __mes(0, 10) });
    const g = lancamentos.filter(l => /^Geladeira/.test(l.descricao)).sort((a, b) => a.data.localeCompare(b.data));
    const f = lancamentos.filter(l => /^Fone/.test(l.descricao));
    return {
      desc: g.map(l => l.descricao), valores: g.map(l => l.valor), datas: g.map(l => l.data),
      esperado: [__mes(0, 10), __mes(1, 10), __mes(2, 10)], mesmoGrupo: new Set(g.map(l => l.grupoId)).size === 1,
      fone: f.map(l => l.valor)
    };
  });
  t.ok(parc.desc.join('|') === 'Geladeira (1/3)|Geladeira (2/3)|Geladeira (3/3)' && parc.mesmoGrupo, 'R$ 1.200 em 3x: três parcelas do mesmo grupo, numeradas');
  t.ok(parc.valores.every(v => v === '400,00') && JSON.stringify(parc.datas) === JSON.stringify(parc.esperado), 'R$ 400 cada, uma por mês a partir da data da compra');
  t.ok(parc.fone.every(v => v === '33,33'), 'R$ 100 em 3x: R$ 33,33 por parcela');

  t.secao('EDITAR');
  const edicao = await p.evaluate(() => {
    const l = lancamentos.find(x => x.descricao === 'Mercado');
    prepararEdicao(l.id);
    const noForm = { desc: document.getElementById('descricao').value, editando: document.getElementById('idEditando').value };
    document.getElementById('valor').value = 'R$ 90,00';
    document.getElementById('descricao').value = 'Mercado do bairro';
    salvarLancamento({ preventDefault() {} });   // edição salva direto, sem a janela
    const depois = lancamentos.find(x => x.id === l.id);
    return { noForm, desc: depois.descricao, valor: depois.valor, qtd: lancamentos.filter(x => /Mercado/.test(x.descricao)).length };
  });
  t.ok(edicao.noForm.desc === 'Mercado' && edicao.noForm.editando !== '', 'editar carrega o lançamento no formulário');
  t.ok(edicao.desc === 'Mercado do bairro' && edicao.valor === '90,00' && edicao.qtd === 1, 'salvar a edição troca o mesmo lançamento (não cria outro)');

  const edParcela = await p.evaluate(() => {
    const g = lancamentos.filter(l => /^Geladeira/.test(l.descricao)).sort((a, b) => a.data.localeCompare(b.data));
    prepararEdicao(g[1].id);
    document.getElementById('valor').value = 'R$ 1.500,00';   // o campo é o TOTAL da compra
    salvarLancamento({ preventDefault() {} });
    return lancamentos.filter(l => /^Geladeira/.test(l.descricao)).map(l => l.valor);
  });
  t.ok(edParcela.length === 3 && edParcela.every(v => v === '500,00'), 'editar o total de uma compra parcelada redivide entre as 3 parcelas (R$ 500)');

  t.secao('LIXEIRA');
  const lixo = await p.evaluate(() => {
    const l = lancamentos.find(x => x.descricao === 'Mercado do bairro');
    excluirLancamento(l.id);
    const sumiu = !lancamentos.some(x => x.id === l.id);
    const naLixeira = lixeira.findIndex(x => x.id === l.id);
    restaurarDaLixeira(naLixeira);
    const voltou = lancamentos.some(x => x.id === l.id && x.valor === '90,00');
    const g = lancamentos.find(x => x.descricao === 'Fone (2/3)');
    excluirLancamento(g.id);   // confirm aceito = todas as parcelas
    return { sumiu, naLixeira: naLixeira >= 0, voltou, fone: lancamentos.filter(x => /^Fone/.test(x.descricao)).length, lixeira: lixeira.filter(x => /^Fone/.test(x.descricao)).length };
  });
  t.ok(lixo.sumiu && lixo.naLixeira && lixo.voltou, 'excluir manda pra lixeira, e restaurar devolve igual');
  t.ok(lixo.fone === 0 && lixo.lixeira === 3, 'excluir uma parcela (confirmando "todas") leva a compra inteira pra lixeira');

  t.secao('TRANSFERÊNCIA');
  const transf = await p.evaluate(() => {
    abrirModalTransferencia();
    document.getElementById('transfOrigem').value = 'Itaú';
    document.getElementById('transfDestino').value = 'Carteira';
    document.getElementById('transfValor').value = 'R$ 150,00';
    salvarTransferencia();
    const confirmar = !document.getElementById('modalConfirmaTransferencia').classList.contains('escondido');
    confirmarTransferencia();
    const ref = resumoFaturaAtual;
    return { confirmar, qtd: transferencias.length, recebido: ref.totalRecebimentos, saiu: ref.saiuDaConta,
      itau: ref.porContaNet['Itaú'], carteira: ref.porContaNet['Carteira'] };
  });
  t.ok(transf.confirmar && transf.qtd === 1, 'transferência passa pela conferência e é gravada');
  t.ok(transf.recebido === 5000 && Math.abs(transf.carteira - 150) < 0.001, 'não vira receita nem gasto, mas muda o saldo de cada conta (Carteira +150)');

  t.secao('FILTROS DA LISTA');
  const filtros = await p.evaluate(() => {
    __aba('abaFaturas');
    if (!secaoEstaAberta('lancamentosMes')) alternarSecao('lancamentosMes');
    const ver = f => { filtrosLanc = Object.assign(FILTROS_VAZIOS(), f); renderizarLancamentos(); return contarItensVisiveis(); };
    const r = {
      tudo: ver({}), despesas: ver({ tipos: ['despesa'] }), receitas: ver({ tipos: ['receita'] }),
      transf: ver({ tipos: ['transferencia'] }), carteira: ver({ contas: ['Carteira'] }),
      cartao: ver({ onde: 'cartao' }), alimentacao: ver({ cats: ['Alimentação'] })
    };
    filtrosLanc = FILTROS_VAZIOS(); atualizarResumoFiltros(); renderizarLancamentos();
    abrirFiltrosLanc();
    r.botao = document.getElementById('btnAplicarFiltros').textContent;
    fecharModal('modalFiltrosLanc');
    return r;
  });
  console.log('   ', JSON.stringify(filtros));
  t.ok(filtros.despesas + filtros.receitas + filtros.transf === filtros.tudo, 'despesas + receitas + transferências = tudo o que aparece no mês');
  t.ok(filtros.receitas === 1 && filtros.transf === 1 && filtros.carteira === 1, 'Receitas: 1 · Transferências: 1 · Carteira: 1 (a transferência que chegou)');
  t.ok(filtros.cartao >= 1 && filtros.alimentacao === 1 && /Mostrar \d+ lançamentos?/.test(filtros.botao), 'no cartão, por categoria, e a janela conta antes de aplicar');
});
