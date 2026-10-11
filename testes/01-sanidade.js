/* SANIDADE — o app inteiro de pé
   Um cenário cheio (contas, cartão, parcelado, gasto fixo, consórcio,
   investimento, grupo, transferência, empréstimo, meta), as seis abas
   renderizando, o backup indo e voltando sem perder nada, e os oito temas. */
const { iniciar } = require('./ajuda');
const fs = require('fs');

iniciar('01 · sanidade', async t => {
  const p = await t.abrir();
  console.log('versão:', await p.evaluate(() => APP_VERSION));

  t.secao('APP VAZIO');
  const vazio = await p.evaluate(() => ({
    lanc: lancamentos.length, contas: contas.map(c => c.nome),
    cats: categorias.length, versao: document.getElementById('versaoApp').textContent
  }));
  t.ok(vazio.lanc === 0 && vazio.contas.length >= 1 && vazio.cats >= 5, 'abre vazio, com uma conta e as categorias padrão');
  t.ok(/^versão \d{4}\.\d\d\.\d\d-\d+$/.test(vazio.versao), 'Ajustes mostra a versão: ' + vazio.versao);

  t.secao('CENÁRIO CHEIO');
  await p.evaluate(() => {
    __semear({
      contas: [
        { id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 25, diaVencimento: 5, saldoInicial: '1.000,00', saldoInicialEm: __mes(-3, 1) },
        { id: 'c2', nome: 'Nubank', temCredito: true, diaFechamento: 3, diaVencimento: 10 },
        { id: 'c3', nome: 'Carteira', temCredito: false }
      ],
      lancamentos: [
        { id: 1, tipo: 'receita', descricao: 'Salário', valor: '5.000,00', data: __mes(0, 1), conta: 'Itaú', formaModo: 'À Vista / Débito' },
        { id: 2, tipo: 'despesa', descricao: 'Mercado', valor: '420,50', data: __mes(0, 2), conta: 'Itaú', formaModo: 'Crédito à Vista', categoria: 'Alimentação' },
        { id: 3, tipo: 'despesa', descricao: 'Padaria', valor: '18,00', data: __mes(0, 2), conta: 'Carteira', formaModo: 'Dinheiro', categoria: 'Alimentação' },
        { id: 4, tipo: 'despesa', descricao: 'Jantar', valor: '200,00', data: __mes(0, 3), conta: 'Itaú', formaModo: 'Pix', categoria: 'Lazer',
          emprestimoPara: 'Borges', emprestimoVence: __mes(0, 20), emprestimoRateio: [{ nome: 'Borges', valor: '100,00', quitado: false }] },
        { id: 5, tipo: 'despesa', descricao: 'Mercado mês passado', valor: '300,00', data: __mes(-1, 10), conta: 'Nubank', formaModo: 'Crédito à Vista', categoria: 'Alimentação' }
      ],
      metas: { 'Alimentação': 800 },
      grupos: [{ id: 'gr1', nome: 'Viagem', status: 'aberto', dataCriacao: __mes(0, 1) }],
      transferencias: [{ id: 77, data: __mes(0, 4), origem: 'Itaú', destino: 'Carteira', valor: '100,00' }],
      contatos: { Borges: { tel: '', tom: 'neutro' } }
    });
  });
  await t.recarregar(p);
  // parcelado e aporte pelo formulário; gasto fixo e consórcio pelos cadastros
  await p.evaluate(() => {
    __lancar({ descricao: 'Celular', valor: '1.200,00', conta: 'Nubank', forma: 'Crédito Parcelado', parcelas: 3, categoria: 'Outros' });
    __lancar({ descricao: 'Tesouro', valor: '500,00', conta: 'Itaú', forma: 'Pix', categoria: 'Investimento', destino: 'ativo:Tesouro Direto' });
    abrirFormFixo();
    document.getElementById('descFixo').value = 'Academia';
    document.getElementById('valorFixo').value = 'R$ 99,90';
    document.getElementById('contaFixo').value = 'Carteira';
    atualizarFormaFixoVisibilidade();
    salvarFixoModal({ preventDefault() {} });
    abrirFormConsorcio();
    document.getElementById('nomeConsorcio').value = 'Consórcio Casa';
    document.getElementById('parcelaConsorcio').value = 'R$ 394,78';
    document.getElementById('totalParcelasConsorcio').value = '80';
    document.getElementById('diaConsorcio').value = '15';
    document.getElementById('inicioConsorcio').value = __mes(-2, 15);
    salvarConsorcioModal({ preventDefault() {} });
  });
  await t.recarregar(p);
  const cheio = await p.evaluate(() => ({
    lanc: lancamentos.length, parcelas: lancamentos.filter(l => /Celular \(\d\/3\)/.test(l.descricao)).length,
    aportes: investimentos.length, fixos: fixos.length, consorcios: consorcios.length,
    geradosFixo: lancamentos.filter(l => l.fixoId).length
  }));
  console.log('  ', JSON.stringify(cheio));
  t.ok(cheio.parcelas === 3 && cheio.aportes === 1 && cheio.fixos === 2 && cheio.consorcios === 1, 'parcelado em 3x, um aporte, um gasto fixo e um consórcio (que cria o próprio gasto fixo)');
  t.ok(cheio.geradosFixo > 4, 'gastos fixos já projetados nos meses à frente (' + cheio.geradosFixo + ' lançamentos)');

  t.secao('AS SEIS ABAS');
  const abas = ['abaLancamentos', 'abaFaturas', 'abaGraficos', 'abaGrupos', 'abaInvestimentos', 'abaConfig'];
  for (const aba of abas) {
    const r = await p.evaluate(id => {
      __aba(id);
      const el = document.getElementById(id);
      return { visivel: el.classList.contains('ativo'), texto: el.innerText.length };
    }, aba);
    t.ok(r.visivel && r.texto > 200, aba + ': abriu e mostrou conteúdo');
  }
  const conteudo = await p.evaluate(() => ({
    lista: document.querySelectorAll('#listaLancamentos .item-lancamento').length,
    fatura: __texto('#listaPagamentoFatura'),
    total: __texto('#totalInvestido'),
    grupos: __texto('#abaGrupos')
  }));
  t.ok(conteudo.lista >= 5, 'lista de lançamentos com itens');
  t.ok(/Itaú|Nubank/.test(conteudo.fatura), 'card da fatura com os cartões');
  t.ok(/R\$/.test(conteudo.total) && /Viagem/.test(conteudo.grupos), 'total investido e o grupo Viagem na tela');

  t.secao('BACKUP IDA E VOLTA');
  await p.evaluate(() => { window.showSaveFilePicker = undefined; navigator.canShare = undefined; });
  const [download] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportarBackup())]);
  const texto = fs.readFileSync(await download.path(), 'utf8');
  const backup = JSON.parse(texto);
  const chaves = ['lancamentos', 'fixos', 'investimentos', 'consorcios', 'grupos', 'orcamentosCategoria', 'planejamento', 'faturasPagas', 'contas', 'categorias', 'transferencias', 'contatos', 'lixeira'];
  t.ok(backup.versao === 3 && chaves.every(k => k in backup), 'backup versão 3 com todas as gavetas');
  t.ok(/^backup-meu-financeiro-\d{4}-\d\d-\d\d\.json$/.test(download.suggestedFilename()), 'nome do arquivo: ' + download.suggestedFilename());
  const antes = await p.evaluate(() => ({ lanc: lancamentos.length, inv: investimentos.length, fixos: fixos.length, cons: consorcios.length, transf: transferencias.length, contas: contas.length }));
  await p.evaluate(() => localStorage.clear());
  await t.recarregar(p);
  const limpo = await p.evaluate(() => lancamentos.length);
  await p.evaluate(texto => importarBackup({ target: { files: [new File([texto], 'b.json', { type: 'application/json' })], value: 'x' } }), texto);
  await p.waitForTimeout(800);
  const depois = await p.evaluate(() => ({ lanc: lancamentos.length, inv: investimentos.length, fixos: fixos.length, cons: consorcios.length, transf: transferencias.length, contas: contas.length }));
  t.ok(limpo === 0, 'armazenamento limpo antes de importar');
  t.ok(JSON.stringify(depois) === JSON.stringify(antes), 'importou tudo de volta: ' + JSON.stringify(depois));
  await t.recarregar(p);
  t.ok(await p.evaluate(n => lancamentos.length === n, antes.lanc), 'e continua lá depois de recarregar');

  t.secao('TEMAS');
  const temas = await p.evaluate(() => TEMAS.map(x => {
    aplicarTema(x.id);
    return { id: x.id, attr: document.documentElement.getAttribute('data-tema'), fundo: getComputedStyle(document.documentElement).getPropertyValue('--fundo').trim() };
  }));
  console.log('   ' + temas.map(x => x.id + ':' + x.fundo).join(' · '));
  t.ok(temas.length === 8 && temas.every(x => x.attr === x.id && x.fundo), 'os 8 temas aplicam e definem a cor de fundo');
  t.ok(new Set(temas.map(x => x.fundo)).size >= 6, 'cada tema tem a sua cor');
  await p.evaluate(() => aplicarTema('escuro'));
});
