/* PEDIDOS DE 16/11 — número da agenda lido certo (0 da discagem, operadora,
   +55) e com o nome junto; Enviar backup como .txt (o Chrome não compartilha
   .json); sons pra receita, despesa e transferência; Forma/Modo em branco;
   instalação nova sem as contas de ninguém, com o cartão de boas-vindas; e o
   "corrigir" de saldo direto do Resumo das faturas. */
const { iniciar } = require('./ajuda');

iniciar('16 · agenda, sons, forma, primeira vez e saldo', async t => {
  let p = await t.abrir();

  t.secao('NÚMERO DA AGENDA');
  const numeros = await p.evaluate(() => {
    const casos = {
      '028 98765-4321': '5528987654321',
      '+55 28 98765-4321': '5528987654321',
      '0 21 28 98765-4321': '5528987654321',
      '+55 (028) 98765-4321': '5528987654321',
      '0055 28 98765 4321': '5528987654321',
      '(28) 98765-4321': '5528987654321',
      '(28) 3333-4444': '552833334444',
      '028 3333-4444': '552833334444',
      '55 99999-8888': '5555999998888',
      '+1 212 555 1234': '12125551234'
    };
    const erradas = Object.entries(casos).filter(([de, para]) => normalizarTelefone(de) !== para).map(([de]) => de + ' → ' + normalizarTelefone(de));
    return { erradas, visivel: telefoneVisivel(normalizarTelefone('028 98765-4321')) };
  });
  t.ok(!numeros.erradas.length && numeros.visivel === '(28) 98765-4321',
    'o 0 da discagem, a operadora e o +55 saem do lugar certo: 028 98765-4321 vira (28) 98765-4321, e não (89) 8765-4321' + (numeros.erradas.length ? ' — ' + numeros.erradas.join('; ') : ''));

  const agenda = await p.evaluate(async () => {
    Object.defineProperty(navigator, 'contacts', { configurable: true,
      value: { select: async () => [{ name: ['Maria Fernanda Lima'], tel: ['028 3333-4444', '+55 28 98765-4321'] }] } });
    abrirModalContatoCobranca('');
    await escolherDaAgenda();
    const r1 = { nome: document.getElementById('inputNomeContato').value, tel: document.getElementById('inputTelefoneCobranca').value };
    document.getElementById('inputNomeContato').value = 'Nanda';
    await escolherDaAgenda();
    const r2 = document.getElementById('inputNomeContato').value;
    fecharModal('modalContatoCobranca');
    return { r1, r2 };
  });
  t.ok(agenda.r1.nome === 'Maria Fernanda Lima' && agenda.r1.tel === '(28) 98765-4321', 'escolher da agenda traz o nome e o celular (com fixo e celular no contato, vem o celular)');
  t.ok(agenda.r2 === 'Nanda', 'o nome que você já tinha escrito fica; a agenda só preenche o campo vazio');

  t.secao('ENVIAR BACKUP');
  const enviar = await p.evaluate(async () => {
    let enviado = null;
    window.showSaveFilePicker = async () => { throw new Error('não era pra abrir'); };
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: async d => { enviado = d.files[0]; }, configurable: true });
    await enviarBackup();
    const texto = enviado ? await enviado.text() : '';
    return { nome: enviado && enviado.name, tipo: enviado && enviado.type, eBackup: !!texto && Array.isArray(JSON.parse(texto).lancamentos),
      aceita: document.getElementById('importBackupInput').getAttribute('accept') };
  });
  t.ok(/^backup-meu-financeiro-\d{4}-\d{2}-\d{2}\.txt$/.test(enviar.nome || '') && enviar.tipo === 'text/plain' && enviar.eBackup,
    'Enviar manda o backup como .txt (text/plain): o Chrome recusa compartilhar .json, e era por isso que caía no download');
  t.ok(/\.txt/.test(enviar.aceita) && /\.json/.test(enviar.aceita), 'Importar backup aceita o .json e o .txt');
  const deTxt = await p.evaluate(async () => {
    const dados = JSON.stringify({ lancamentos: [{ id: 1, tipo: 'despesa', descricao: 'Pão', valor: '9,00', data: __mes(0, 1), conta: 'Itaú', formaModo: 'Pix', categoria: 'Alimentação' }],
      contas: CONTAS_PADRAO });
    window.__ultimoAviso = null;
    importarBackup({ target: { files: [new File([dados], 'backup-meu-financeiro.txt', { type: 'text/plain' })], value: '' } });
    for (let i = 0; i < 50 && !window.__ultimoAviso; i++) await new Promise(r => setTimeout(r, 20));
    fecharModal('modalAviso');
    return { aviso: window.__ultimoAviso, n: lancamentos.length };
  });
  t.ok(deTxt.aviso === 'backupOk' && deTxt.n === 1, 'um backup .txt restaura igual ao .json');

  t.secao('SONS');
  p = await t.abrir();
  const padrao = await p.evaluate(() => ({
    receita: somLigadoPara('receita'), despesa: somLigadoPara('despesa'), transf: somLigadoPara('transferencia'),
    sorteioTransf: sonsAtivos('transferencia'), sorteioDespesa: sonsAtivos('despesa').length,
    tamanhos: [SONS.receita.length, SONS.despesa.length, SONS.transferencia.length],
    nomesAntigos: SONS.receita.slice(0, 5).map(s => s.nome).join(', ')
  }));
  t.ok(padrao.receita && !padrao.despesa && padrao.transf, 'de início: receita ligada, despesa desligada e transferência como antes (segue a receita)');
  t.ok(padrao.sorteioTransf.join() === '0' && padrao.sorteioDespesa === padrao.tamanhos[1],
    'a transferência sorteia só o Vento até você marcar outros; a despesa, todos os seus');
  t.ok(padrao.tamanhos.join() === '7,6,4' && padrao.nomesAntigos === 'Caixa registradora, Cascata de moedas, Fanfarra, Level up, Apito subindo',
    'sons novos: 2 de receita, 6 de despesa e 3 de transferência; os 5 de receita continuam no mesmo lugar (a sua escolha não muda)');

  const tocou = await p.evaluate(() => {
    window.__sonsTocados = {};
    __lancar({ descricao: 'Café', valor: '5,00', conta: 'Itaú', forma: 'Pix', categoria: 'Alimentação' });
    const desligado = (window.__sonsTocados || {}).despesa || 0;
    localStorage.setItem(CONFIG_SOM.despesa.ligado, '1');
    __lancar({ descricao: 'Pão', valor: '8,00', conta: 'Itaú', forma: 'Pix', categoria: 'Alimentação' });
    const ligado = (window.__sonsTocados || {}).despesa || 0;
    localStorage.setItem(CONFIG_SOM.receita.ligado, '0');
    const transfSegue = somLigadoPara('transferencia');
    tocarSom('transferencia');
    return { desligado, ligado, ultimo: window.__ultimoSom.despesa, transfSegue, transf: (window.__sonsTocados || {}).transferencia || 0 };
  });
  t.ok(tocou.desligado === 0 && tocou.ligado === 1 && !!tocou.ultimo, 'despesa só toca quando você liga, e toca um dos sons de despesa (' + tocou.ultimo + ')');
  t.ok(!tocou.transfSegue && tocou.transf === 0, 'transferência sem escolha própria desliga junto com a receita, como antes');

  const telaSons = await p.evaluate(() => {
    localStorage.removeItem(CONFIG_SOM.receita.ligado);
    __aba('abaConfig');
    if (!secaoEstaAberta('sons')) alternarSecao('sons');
    renderizarSons();
    const grupos = [...document.querySelectorAll('#listaSons .grupo-sons')].map(g => g.querySelectorAll('.item-lancamento').length);
    const chk = document.getElementById('chkSom-transferencia');
    chk.checked = true; alternarSomLigado('transferencia');
    alternarSomAtivo('transferencia', 2);
    alternarSomAtivo('despesa', 0); // tira um da despesa
    const semUm = sonsAtivos('despesa').length;
    for (let i = 1; i < SONS.despesa.length; i++) alternarSomAtivo('despesa', i);   // tenta tirar todos
    return { grupos, transf: localStorage.getItem(CONFIG_SOM.transferencia.ligado), sorteio: sonsAtivos('transferencia').join(), semUm, sobrou: sonsAtivos('despesa').length };
  });
  t.ok(telaSons.grupos.join() === '7,6,4', 'Ajustes → Sons mostra os três grupos, cada um com o seu liga/desliga');
  t.ok(telaSons.transf === '1' && telaSons.sorteio === '0,2' && telaSons.semUm === 5 && telaSons.sobrou === 1,
    'cada grupo guarda a sua escolha, e o último som marcado não sai (o tipo não fica mudo sem querer)');

  t.secao('FORMA / MODO EM BRANCO');
  const forma = await p.evaluate(() => {
    __aba('abaLancamentos');
    cancelarEdicao();
    document.getElementById('conta').value = 'Itaú'; atualizarVisibilidadeForma();
    const aoAbrir = document.getElementById('formaModo').value;
    const rotulo = document.getElementById('formaModo').selectedOptions[0].textContent;
    // salvar sem escolher
    document.getElementById('descricao').value = 'Mercado';
    document.getElementById('valor').value = 'R$ 30,00';
    window.__ultimoAviso = null;
    const antes = lancamentos.length;
    salvarLancamento({ preventDefault() {} });
    const aviso = window.__ultimoAviso; fecharModal('modalAviso');
    const naoSalvou = lancamentos.length === antes && document.getElementById('modalConfirmarLancamento').classList.contains('escondido');
    // escolhe e salva
    document.getElementById('formaModo').value = 'Pix'; verificarParcelamento('Pix');
    salvarLancamento({ preventDefault() {} });
    confirmarSalvarLancamento();
    const salvo = lancamentos.find(l => l.descricao === 'Mercado');
    const depois = document.getElementById('formaModo').value;
    // receita e volta: não reaparece preenchida
    alternarTipo('receita'); alternarTipo('despesa');
    const voltando = document.getElementById('formaModo').value;
    // conta que só aceita uma forma: ela vem marcada
    const vale = contas.find(c => !c.temCredito);
    vale.formasAceitas = ['À Vista / Débito'];
    popularSelectsContas();
    document.getElementById('conta').value = vale.nome; atualizarVisibilidadeForma();
    const unica = document.getElementById('formaModo').value;
    delete vale.formasAceitas;
    return { aoAbrir, rotulo, aviso, naoSalvou, salvoCom: salvo && salvo.formaModo, depois, voltando, unica };
  });
  t.ok(forma.aoAbrir === '' && forma.rotulo === 'Escolha', 'o formulário abre com a Forma / Modo em branco ("Escolha")');
  t.ok(forma.aviso === 'semForma' && forma.naoSalvou, 'salvar sem escolher a forma avisa e não grava');
  t.ok(forma.salvoCom === 'Pix' && forma.depois === '' && forma.voltando === '', 'escolhida, grava; e o próximo lançamento volta em branco (inclusive depois de passar por receita)');
  t.ok(forma.unica === 'À Vista / Débito', 'conta que só aceita uma forma (vale-refeição) já vem com ela marcada');

  t.secao('PRIMEIRA VEZ NO APP');
  p = await t.abrir('index.html', { semContas: true });
  const nova = await p.evaluate(() => ({ contas: contas.length, cartao: !document.getElementById('cartaoBoasVindas').classList.contains('escondido'),
    salvas: localStorage.getItem(STORAGE_KEY_CONTAS) }));
  t.ok(nova.contas === 0 && nova.cartao, 'instalação nova começa sem conta nenhuma e mostra o cartão "Comece pelas suas contas"');
  const semConta = await p.evaluate(() => {
    document.getElementById('descricao').value = 'Mercado';
    document.getElementById('valor').value = 'R$ 30,00';
    window.__ultimoAviso = null;
    salvarLancamento({ preventDefault() {} });
    const aviso = window.__ultimoAviso; fecharModal('modalAviso');
    return { aviso, form: !document.getElementById('modalFormConta').classList.contains('escondido'), n: lancamentos.length };
  });
  t.ok(semConta.aviso === 'semConta' && semConta.form && semConta.n === 0, 'lançar sem conta avisa e já abre o cadastro de conta');
  const cadastrou = await p.evaluate(() => {
    fecharFormConta(); fecharModal('modalContas');
    abrirCadastroDeContas();
    const abriu = !document.getElementById('modalFormConta').classList.contains('escondido');
    document.getElementById('nomeConta').value = 'Nubank';
    salvarConta();
    fecharModal('modalContas');
    return { abriu, contas: contas.map(c => c.nome).join(), cartao: !document.getElementById('cartaoBoasVindas').classList.contains('escondido'),
      noForm: [...document.getElementById('conta').options].map(o => o.value).join() };
  });
  t.ok(cadastrou.abriu && cadastrou.contas === 'Nubank' && !cadastrou.cartao && cadastrou.noForm === 'Nubank',
    '"Cadastrar minhas contas" abre o formulário; com a primeira conta o cartão some e ela já está no lançamento');

  const antigo = await p.evaluate(() => {
    localStorage.removeItem(STORAGE_KEY_CONTAS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 1, tipo: 'despesa', descricao: 'Pão', valor: '9,00', data: __mes(0, 1), conta: 'Itaú', formaModo: 'Pix', categoria: 'Alimentação' }]));
  });
  await t.recarregar(p);
  const voltou = await p.evaluate(() => ({ contas: contas.map(c => c.nome), cartao: !document.getElementById('cartaoBoasVindas').classList.contains('escondido') }));
  t.ok(voltou.contas.includes('Itaú') && !voltou.cartao, 'quem já tinha lançamentos sem nunca ter salvo contas continua com as contas de antes (nada fica sem conta)');

  t.secao('CORRIGIR SALDO PELO RESUMO');
  p = await t.abrir();
  await p.evaluate(() => __semear({
    contas: [{ id: 'c1', nome: 'Itaú', temCredito: false }, { id: 'c2', nome: 'PicPay', temCredito: false }],
    lancamentos: [
      { id: 1, tipo: 'receita', descricao: 'Salário', valor: '1.000,00', data: __mes(0, 1), conta: 'Itaú', formaModo: 'Pix' },
      { id: 2, tipo: 'receita', descricao: 'Pix', valor: '200,00', data: __mes(0, 1), conta: 'PicPay', formaModo: 'Pix' }
    ]
  }));
  await t.recarregar(p);
  const resumo = await p.evaluate(() => {
    __aba('abaFaturas');
    abrirModalResumoFatura();
    const links = [...document.querySelectorAll('#corpoResumoFatura .link-corrigir')].map(b => b.dataset.conta);
    document.querySelector('#corpoResumoFatura .link-corrigir[data-conta="PicPay"]').click();
    const r = { links, resumoFechou: document.getElementById('modalResumoFatura').classList.contains('escondido'),
      corrigir: !document.getElementById('modalCorrigirSaldo').classList.contains('escondido'),
      titulo: document.getElementById('tituloCorrigirSaldo').textContent, mostra: document.getElementById('saldoCalculadoConta').textContent };
    fecharModal('modalCorrigirSaldo');
    return r;
  });
  t.ok(resumo.links.sort().join() === 'Itaú,PicPay' && resumo.resumoFechou && resumo.corrigir && resumo.titulo === 'Corrigir saldo — PicPay' && /200,00/.test(resumo.mostra),
    'no Resumo do mês, "corrigir" ao lado da conta abre direto o Corrigir saldo dela, com o saldo de hoje');
  const passado = await p.evaluate(() => {
    const h = new Date(obterDataBrasilia() + 'T12:00:00');
    const x = new Date(h.getFullYear(), h.getMonth() - 1, 1);
    irParaFatura(x.getMonth(), x.getFullYear(), true);
    abrirModalResumoFatura();
    const n = document.querySelectorAll('#corpoResumoFatura .link-corrigir').length;
    fecharModal('modalResumoFatura');
    irParaFatura(h.getMonth(), h.getFullYear(), true);
    return n;
  });
  t.ok(passado === 0, 'num mês que já passou o "corrigir" não aparece (corrigir é dizer quanto tem agora)');
});
