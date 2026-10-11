/* TELAS NO CELULAR — em 360 e 412 px de largura, nenhuma aba e nenhuma das
   janelas principais pode passar da largura da tela (rolagem pro lado é o
   defeito mais comum quando um texto ou valor cresce). Tira uma foto de cada
   aba em testes/fotos/ pra conferir a olho. */
const { iniciar } = require('./ajuda');

iniciar('10 · telas no celular', async t => {
  const p = await t.abrir();
  await p.evaluate(() => {
    __semear({
      contas: [
        { id: 'c1', nome: 'Itaú Personnalité', temCredito: true, diaFechamento: 25, diaVencimento: 5 },
        { id: 'c2', nome: 'Carteira', temCredito: false }
      ],
      lancamentos: [
        { id: 1, tipo: 'receita', descricao: 'Salário', valor: '12.345,67', data: __mes(0, 1), conta: 'Itaú Personnalité', formaModo: 'À Vista / Débito' },
        { id: 2, tipo: 'despesa', descricao: 'Supermercado com um nome bem comprido pra testar quebra', valor: '1.234,56', data: __mes(0, 2), conta: 'Itaú Personnalité', formaModo: 'Crédito à Vista', categoria: 'Alimentação' },
        { id: 3, tipo: 'despesa', descricao: 'Jantar', valor: '200,00', data: __mes(0, 3), conta: 'Itaú Personnalité', formaModo: 'Pix', categoria: 'Lazer',
          emprestimoPara: 'Bernardo, Ana Clara', emprestimoRateio: [{ nome: 'Bernardo', valor: '66,67', quitado: false }, { nome: 'Ana Clara', valor: '66,67', quitado: false }] },
        { id: 4, tipo: 'despesa', descricao: 'Aporte', valor: '1.000,00', data: __mes(0, 4), conta: 'Itaú Personnalité', formaModo: 'Pix', categoria: 'Investimento', aporteId: 'i1' }
      ],
      investimentos: [{ id: 'i1', valor: '1.000,00', origem: 'Itaú Personnalité', tipoAtivo: 'Tesouro Direto', valorAtual: '1.050,00', atualizadoEm: __mes(0, 5), data: __mes(0, 4), lancamentoId: 4 }],
      grupos: [{ id: 'gr1', nome: 'Viagem pra Ubatuba com a família', status: 'aberto', dataCriacao: __mes(0, 1) }],
      metas: { 'Alimentação': 1000 }
    });
  });
  await t.recarregar(p);

  const ABAS = ['abaLancamentos', 'abaFaturas', 'abaGraficos', 'abaGrupos', 'abaInvestimentos', 'abaConfig'];
  for (const largura of [360, 412]) {
    t.secao('LARGURA ' + largura + ' px');
    await p.setViewportSize({ width: largura, height: 800 });
    const largas = [];
    for (const aba of ABAS) {
      const r = await p.evaluate(id => {
        __aba(id);
        // abre todos os cards da aba, pra medir o conteúdo inteiro
        document.querySelectorAll('#' + id + ' [id^="corpo-"].escondido').forEach(c => alternarSecao(c.id.slice(6)));
        return { larg: document.documentElement.scrollWidth, tela: document.documentElement.clientWidth };
      }, aba);
      if (r.larg > r.tela + 1) largas.push(aba + ' (' + r.larg + ' > ' + r.tela + ')');
      if (largura === 412) { await p.waitForTimeout(450); await t.foto(p, 'tela_' + aba + '.png'); }   // depois da animação da troca de aba
    }
    t.ok(!largas.length, 'nenhuma aba rola pro lado' + (largas.length ? ': ' + largas.join(', ') : ''));

    const janelas = await p.evaluate(() => {
      const medir = id => {
        const el = document.querySelector('#' + id + ' .modal-content');
        const r = el.getBoundingClientRect();
        return { id, cabe: r.left >= -1 && r.right <= document.documentElement.clientWidth + 1 && el.scrollWidth <= el.clientWidth + 1 };
      };
      const r = [];
      const [a, m] = __chaveMes(0).split('-').map(Number);
      abrirPagarFatura('Itaú Personnalité', m - 1, a); setModoPagamentoFatura('parcelado'); r.push(medir('modalPagarFatura')); fecharModal('modalPagarFatura');
      abrirFiltrosLanc(); r.push(medir('modalFiltrosLanc')); fecharModal('modalFiltrosLanc');
      abrirFormFixo(); r.push(medir('modalFixo')); fecharModal('modalFixo');
      abrirModalTransferencia(); r.push(medir('modalTransferencia')); fecharModal('modalTransferencia');
      abrirModalAtualizarValor('Tesouro Direto'); r.push(medir('modalAtualizarValor')); fecharModal('modalAtualizarValor');
      abrirPlanejarMes(); setModoRendaPlano('receitas'); r.push(medir('modalPlanejarMes')); fecharModal('modalPlanejarMes');
      abrirEdicaoMeta('Alimentação'); r.push(medir('modalEdicaoMeta')); fecharModal('modalEdicaoMeta');
      return r;
    });
    const ruins = janelas.filter(j => !j.cabe).map(j => j.id);
    t.ok(!ruins.length, 'as janelas principais cabem na tela' + (ruins.length ? ': ' + ruins.join(', ') : ''));
  }
});
