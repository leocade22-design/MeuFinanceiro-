const { chromium } = require('playwright');
const OUT = __dirname + '/img';
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch({ channel:'chromium' });
  const page = await b.newPage({ viewport:{width:412,height:915}, deviceScaleFactor:3 });
  const erros=[]; page.on('pageerror',e=>erros.push(e.message));
  page.on('dialog', async d=>await d.accept());
  await page.goto('file://' + __dirname + '/../index.html');
  await page.waitForTimeout(900);
  await page.evaluate(()=>localStorage.clear());
  await page.reload(); await page.waitForTimeout(900);

  // ---- dados de demonstração (fictícios) ----
  await page.evaluate(()=>{
    const hoje = obterDataBrasilia();
    const d = n => { const x=new Date(hoje+'T12:00:00'); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
    const mes = n => { const x=new Date(hoje+'T12:00:00'); x.setMonth(x.getMonth()+n); return x.toISOString().slice(0,10); };
    const desp=(desc,v,cat,dt,forma,conta,extra)=>lancamentos.push(Object.assign({id:novoIdLancamento(),tipo:'despesa',
      descricao:desc,valor:v,data:dt,conta:conta||'Itaú',formaModo:forma||'À Vista / Débito',categoria:cat},extra||{}));

    // Datas ancoradas no dia do mês corrente, pra nenhum lançamento escapar pro
    // mês passado e bagunçar os totais que o manual mostra.
    const hojeDia = parseInt(hoje.slice(8,10), 10);
    const dia = n => hoje.slice(0,8) + String(Math.min(n, hojeDia)).padStart(2,'0');

    lancamentos.push({id:novoIdLancamento(),tipo:'receita',descricao:'Salário',valor:'6.500,00',data:dia(5),conta:'Itaú'});
    lancamentos.push({id:novoIdLancamento(),tipo:'receita',descricao:'Freela de design',valor:'900,00',data:dia(6),conta:'PicPay'});

    desp('Aluguel','1.800,00','Casa',dia(2));
    desp('Mercado Extra','412,30','Alimentação',dia(1));
    desp('Farmácia','86,40','Saúde',dia(4));
    desp('Uber centro','32,00','Transporte',dia(7));
    desp('iFood','58,90','Alimentação',dia(8));
    desp('Gasolina','220,00','Transporte',dia(9),'Crédito à Vista');
    desp('Notebook (1/6)','1.250,00','Outros',dia(3),'Crédito Parcelado','Itaú',{grupoId:'gNb',numParcelas:'6'});
    for (let i=1;i<=5;i++) desp('Notebook ('+(i+1)+'/6)','1.250,00','Outros',mes(i),'Crédito Parcelado','Itaú',{grupoId:'gNb',numParcelas:'6'});
    desp('Cinema','76,00','Lazer',dia(3),'Crédito à Vista');

    // empréstimos
    desp('Airbnb da galera','200,00','Viagens ✈️',d(-14),'Crédito à Vista','Itaú',{emprestimoPara:'Bernardo',emprestimoVence:d(-4)});
    desp('Gympass','140,00','Saúde',d(-10),'Crédito à Vista','Itaú',{emprestimoPara:'Bernardo',emprestimoVence:d(2)});
    desp('Ingresso do show','120,00','Lazer',d(-5),'À Vista / Débito','Itaú',{emprestimoPara:'Carlos',emprestimoVence:d(3)});
    desp('Almoço','48,00','Alimentação',d(-6),'À Vista / Débito','Itaú',{emprestimoPara:'Ana',emprestimoVence:d(45)});

    // grupo de viagem
    grupos.push({id:'gUb',nome:'Viagem Ubatuba',status:'aberto',dataCriacao:d(-20)});
    desp('Pousada','980,00','Viagens ✈️',d(-18),'Crédito à Vista','Itaú',{grupoViagemId:'gUb',grupoViagemNome:'Viagem Ubatuba'});
    desp('Restaurante da praia','264,50','Alimentação',d(-17),'Crédito à Vista','Itaú',{grupoViagemId:'gUb',grupoViagemNome:'Viagem Ubatuba'});
    desp('Combustível da viagem','310,00','Transporte',d(-19),'À Vista / Débito','Itaú',{grupoViagemId:'gUb',grupoViagemNome:'Viagem Ubatuba'});

    fixos.push({id:'f1',descricao:'Aluguel',valor:'1.800,00',conta:'Itaú',diaVencimento:'5',categoria:'Casa',forma:'À Vista / Débito'});
    fixos.push({id:'f2',descricao:'Netflix',valor:'55,90',conta:'Itaú',diaVencimento:'15',categoria:'Lazer',forma:'Crédito Parcelado'});
    fixos.push({id:'f3',descricao:'Academia',valor:'129,90',conta:'Itaú',diaVencimento:'10',categoria:'Saúde',forma:'Crédito Parcelado'});

    orcamentosCategoria['Alimentação'] = '800,00';
    orcamentosCategoria['Transporte'] = '400,00';
    orcamentosCategoria['Lazer'] = '300,00';

    transferencias.unshift({id:Date.now(),data:dia(8),origem:'PicPay',destino:'Itaú',valor:'400,00'});
    contatos['Bernardo'] = '5511987654321';

    salvarLocalStorage(); salvarFixos(); salvarGrupos(); salvarOrcamentos(); salvarTransferencias(); salvarContatos();
    atualizarTudo();
  });
  await page.waitForTimeout(600);

  const tiro = async (nome, seletor, opts) => {
    const el = await page.$(seletor);
    if (!el) { console.log('!! não achou', seletor); return; }
    await el.screenshot(Object.assign({ path: OUT + '/' + nome + '.png' }, opts||{}));
    console.log('✓', nome);
  };
  const abrir = async (aba) => { await page.click(`.nav-tab:has-text("${aba}")`); await page.waitForTimeout(500); };
  const secao = async (nome, on=true) => {
    await page.evaluate(([n,o])=>{ uiPrefs['secao_'+n]=o; salvarUiPrefs(); aplicarSecao(n); }, [nome,on]);
    await page.waitForTimeout(350);
  };

  // 1) abas
  await abrir('Lançamentos');
  await tiro('abas', '.nav-tabs');

  // 2) formulário
  await page.fill('#descricao','Mercado do mês');
  await page.fill('#valor','41230');
  await page.waitForTimeout(200);
  await tiro('form', '#cardFormLancamento');
  await page.fill('#descricao',''); await page.fill('#valor','');

  // 3) perguntas
  await page.evaluate(()=>{
    document.getElementById('inputPergunta').value='onde gastei mais este mes';
    responderPergunta();
  });
  await page.waitForTimeout(400);
  await tiro('perguntas', '#abaLancamentos > .card:last-child');

  // 4) faturas — resumo
  await abrir('Faturas');
  await tiro('resumo', '#cardResumoFaturas');

  // 5) popup do saldo
  await page.click('.card-saldo-destaque'); await page.waitForTimeout(500);
  await tiro('popup_saldo', '#modalResumoFatura .modal-content');
  await page.evaluate(()=>fecharModal('modalResumoFatura')); await page.waitForTimeout(300);

  // 6) lançamentos do mês (com a transferência azul)
  await secao('lancamentosMes', true);
  await tiro('lista', '[data-card="lancamentosMes"]', { });
  // a mesma lista com o filtro "Cartão" ligado, pra mostrar a separação
  await page.click('#corpo-lancamentosMes .btn-periodo[data-forma="cartao"]');
  await page.waitForTimeout(400);
  await tiro('lista_cartao', '[data-card="lancamentosMes"]');
  await page.click('#corpo-lancamentosMes .btn-periodo[data-forma="tudo"]');
  await page.waitForTimeout(300);
  await secao('lancamentosMes', false);

  // 7) pagamento da fatura
  await secao('pagamentoFatura', true);
  await tiro('fatura', '[data-card="pagamentoFatura"]');
  await page.click('#listaPagamentoFatura .item-lancamento');
  await page.waitForTimeout(450);
  await tiro('fatura_extrato', '[data-card="pagamentoFatura"]');
  await secao('pagamentoFatura', false);

  // 8) fixos
  await secao('fixos', true);
  await tiro('fixos', '[data-card="fixos"]');
  await secao('fixos', false);

  // 9) empréstimos + cobrança
  await secao('emprestimos', true);
  await page.evaluate(()=>alternarPessoaEmprestimo('recebo:Bernardo'));
  await page.waitForTimeout(400);
  await tiro('emprestimos', '[data-card="emprestimos"]');
  await secao('emprestimos', false);

  // 10) gráficos
  await abrir('Gráficos');
  await page.evaluate(()=>setFiltroPeriodoGraficos('mesAtual','Este mês'));
  await page.waitForTimeout(600);
  await tiro('graficos_topo', '#cardPeriodoGraficos');
  const cardGrafico = await page.$$('#abaGraficos > .card');
  if (cardGrafico[1]) { await cardGrafico[1].screenshot({path:OUT+'/graficos_barras.png'}); console.log('✓ graficos_barras'); }
  await secao('metas', true);
  await tiro('metas', '[data-card="metas"]');
  await secao('metas', false);

  // 11) grupos
  await abrir('Grupos');
  await tiro('grupos', '#abaGrupos > .card');

  // 12) transferência
  await abrir('Lançamentos');
  await page.click('button[title="Transferências pessoais"]'); await page.waitForTimeout(400);
  await tiro('transferencia', '#modalTransferencia .modal-content');
  await page.evaluate(()=>fecharModal('modalTransferencia')); await page.waitForTimeout(300);

  // 13) ajustes
  await abrir('Ajustes');
  await secao('sons', true);
  await page.waitForTimeout(300);
  await tiro('ajustes', '#abaConfig');
  await secao('sons', false);

  console.log('\nerros:', erros.length?erros:'nenhum');
  await b.close();
})();
