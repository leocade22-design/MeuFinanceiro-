/* MANUAL, NOVIDADES E BACKUP NUMA PASTA — o "Salvar como" do aparelho vem
   antes da folha de compartilhamento (no Android a folha sempre existia, e o
   "Salvar como" nunca aparecia), a folha fica no botão Enviar, o manual baixa
   na versão que está rodando e a lista do que mudou começa por ela. */
const fs = require('fs');
const path = require('path');
const { iniciar } = require('./ajuda');

iniciar('15 · manual, novidades e backup', async t => {
  const p = await t.abrir();
  await p.evaluate(() => __semear({
    contas: [{ id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 3, diaVencimento: 10 }],
    lancamentos: [{ id: 1, tipo: 'despesa', descricao: 'Mercado', valor: '50,00', data: __mes(0, 2), conta: 'Itaú',
      formaModo: 'Pix', numParcelas: '1', categoria: 'Alimentação' }]
  }));
  await t.recarregar(p);

  // "Salvar como" e folha de compartilhamento de mentira: dá pra ver qual o app chamou
  const preparar = (opcoes) => p.evaluate(o => {
    window.__chamadas = { picker: null, share: 0, escrito: null };
    window.showSaveFilePicker = o.picker === 'ok'
      ? async op => { __chamadas.picker = op; return { createWritable: async () => ({ write: async b => { __chamadas.escrito = await b.text(); }, close: async () => {} }) }; }
      : o.picker === 'cancela'
        ? async op => { __chamadas.picker = op; const e = new Error('cancelou'); e.name = 'AbortError'; throw e; }
        : undefined;
    Object.defineProperty(navigator, 'canShare', { value: o.folha ? () => true : undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: o.folha ? async () => { __chamadas.share++; } : undefined, configurable: true });
    localStorage.removeItem(CHAVE_ULTIMO_BACKUP);
    window.__ultimoAviso = null;
  }, opcoes);
  const resultado = () => p.evaluate(() => {
    fecharModal('modalAviso');
    const c = window.__chamadas;
    return { nome: c.picker && c.picker.suggestedName, id: c.picker && c.picker.id, share: c.share,
      lancamentos: c.escrito ? JSON.parse(c.escrito).lancamentos.length : 0,
      marcado: !!localStorage.getItem(CHAVE_ULTIMO_BACKUP), aviso: window.__ultimoAviso };
  });

  t.secao('BACKUP: ESCOLHER A PASTA');
  await preparar({ picker: 'ok', folha: true });
  await p.evaluate(() => exportarBackup());
  let r = await resultado();
  t.ok(/^backup-meu-financeiro-\d{4}-\d{2}-\d{2}\.json$/.test(r.nome || '') && r.share === 0 && r.lancamentos === 1 && r.marcado && r.aviso === 'backupSalvo',
    'com "Salvar como" no aparelho, Exportar abre ele, e não a folha: o arquivo vai pra pasta escolhida');
  t.ok(r.id === 'backup', 'o "Salvar como" do backup lembra a última pasta usada');

  await preparar({ picker: 'cancela', folha: true });
  await p.evaluate(() => exportarBackup());
  r = await resultado();
  t.ok(r.share === 0 && !r.marcado, 'fechar o "Salvar como" não abre a folha nem conta como backup feito');

  await preparar({ picker: null, folha: true });
  await p.evaluate(() => exportarBackup());
  r = await resultado();
  t.ok(r.share === 1 && r.marcado, 'sem "Salvar como" (iPhone), Exportar abre a folha de compartilhamento, como antes');

  await preparar({ picker: 'ok', folha: true });
  const comAsDuas = await p.evaluate(() => { ajustarTextoDoBackup(); return { enviar: !document.getElementById('btnEnviarBackup').classList.contains('escondido'), texto: __texto('#textoDestinoBackup') }; });
  await p.evaluate(() => enviarBackup());
  r = await resultado();
  t.ok(comAsDuas.enviar && r.share === 1 && !r.nome && r.marcado, 'o botão Enviar aparece e manda pela folha (WhatsApp, e-mail, Drive)');
  t.ok(/Salvar como/.test(comAsDuas.texto) && /Enviar/.test(comAsDuas.texto), 'o texto do card explica o "Salvar como" e o Enviar');

  await preparar({ picker: null, folha: true });
  const soFolha = await p.evaluate(() => { ajustarTextoDoBackup(); return { enviar: !document.getElementById('btnEnviarBackup').classList.contains('escondido'), texto: __texto('#textoDestinoBackup') }; });
  t.ok(!soFolha.enviar && /Salvar no Drive/.test(soFolha.texto), 'sem "Salvar como", o Enviar some (o Exportar já é a folha) e o texto volta a falar da folha');

  t.secao('MANUAL');
  const versao = await p.evaluate(() => APP_VERSION);
  const noCard = await p.evaluate(() => __texto('#versaoManual'));
  t.ok(noCard === 'versão ' + versao, 'o card "Manual e novidades" mostra a versão que está rodando');

  await preparar({ picker: 'ok', folha: true });
  const comPasta = await p.evaluate(async () => {
    const urls = [];
    const original = window.fetch;
    window.fetch = async u => { urls.push(String(u)); return new Response(new Blob(['%PDF-1.4 manual'], { type: 'application/pdf' })); };
    try { await baixarManual(); } finally { window.fetch = original; }
    fecharModal('modalAviso');
    return { urls, nome: __chamadas.picker && __chamadas.picker.suggestedName, id: __chamadas.picker && __chamadas.picker.id,
      escrito: __chamadas.escrito, aviso: window.__ultimoAviso };
  });
  t.ok(comPasta.urls[0] === 'MeuFinanceiro-Manual.pdf?v=' + encodeURIComponent(versao) && comPasta.nome === 'MeuFinanceiro-Manual-' + versao + '.pdf'
    && comPasta.escrito === '%PDF-1.4 manual' && comPasta.aviso === 'manualSalvo',
    'Baixar o manual abre o "Salvar como" e grava o PDF da versão atual, com a versão no nome do arquivo');
  t.ok(comPasta.id === 'manual', 'a pasta do manual é lembrada à parte da do backup');

  await preparar({ picker: null, folha: true });
  const semPasta = await p.evaluate(() => {
    let clicado = null;
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { clicado = { href: this.getAttribute('href'), download: this.download }; };
    try { baixarManual(); } finally { HTMLAnchorElement.prototype.click = original; }
    return clicado;
  });
  t.ok(semPasta && semPasta.href === 'MeuFinanceiro-Manual.pdf?v=' + encodeURIComponent(versao) && semPasta.download === 'MeuFinanceiro-Manual-' + versao + '.pdf',
    'sem "Salvar como", o manual vai pelo download comum, também com a versão no nome');

  await preparar({ picker: 'ok', folha: true });
  const semInternet = await p.evaluate(async () => {
    const original = window.fetch;
    window.fetch = async () => { throw new TypeError('Failed to fetch'); };
    try { await baixarManual(); } finally { window.fetch = original; }
    const aviso = window.__ultimoAviso;
    fecharModal('modalAviso');
    return aviso;
  });
  t.ok(semInternet === 'manualErro', 'sem internet, o app avisa que o manual não veio, sem quebrar');

  const publicado = await p.evaluate(async () => {
    const pdf = await fetch(urlDoManual());
    const online = await fetch('manual/manual.html');
    const b = await pdf.blob();
    return { pdf: pdf.status, tipo: pdf.headers.get('content-type'), kb: Math.round(b.size / 1024), online: online.status };
  });
  t.ok(publicado.pdf === 200 && /pdf/.test(publicado.tipo || '') && publicado.kb > 200 && publicado.online === 200,
    `o PDF existe no endereço do botão (${publicado.kb} KB), e o "leia online" também`);

  t.secao('O QUE MUDOU');
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const versaoSw = (sw.match(/const VERSAO = '([^']+)'/) || [])[1];
  const lista = await p.evaluate(() => { abrirNovidades(); return { primeira: NOVIDADES[0].versao, aberto: !document.getElementById('modalNovidades').classList.contains('escondido'),
    titulo: __texto('#listaNovidades .novidades-titulo'), itens: document.querySelectorAll('#listaNovidades li').length }; });
  t.ok(lista.primeira === versao && versaoSw === versao, 'a lista começa pela versão que está rodando, a mesma do sw.js (quem publica versão nova tem que contar o que mudou)');
  t.ok(lista.aberto && /esta versão/.test(lista.titulo) && lista.itens >= 3, 'O que mudou abre com a versão atual marcada e os itens de cada versão');
  await p.evaluate(() => fecharNovidades());

  t.secao('FAIXA DEPOIS DA ATUALIZAÇÃO');
  const faixaVisivel = () => p.evaluate(() => !document.getElementById('avisoNovidades').classList.contains('escondido'));
  await p.evaluate(() => localStorage.setItem(CHAVE_VERSAO_VISTA, '2000.01.01-1'));
  await t.recarregar(p);
  const depoisDeAtualizar = await faixaVisivel();
  const textoFaixa = await p.evaluate(() => __texto('#textoAvisoNovidades'));
  t.ok(depoisDeAtualizar && textoFaixa.includes(versao), 'quando o app atualiza, a faixa avisa uma vez, com a versão nova');
  await p.evaluate(() => marcarNovidadesVistas());
  await t.recarregar(p);
  t.ok(!(await faixaVisivel()), 'depois do "ok", a faixa não volta nesta versão');

  await p.evaluate(() => localStorage.removeItem(CHAVE_VERSAO_VISTA));
  await t.recarregar(p);
  t.ok(await faixaVisivel(), 'quem já usava o app antes desta novidade também vê a faixa na primeira vez');
  await p.evaluate(() => { abrirNovidades(); fecharNovidades(); });
  t.ok(!(await faixaVisivel()), 'abrir o que mudou também conta como visto');

  await p.evaluate(() => localStorage.clear());
  await t.recarregar(p);
  const instalacaoNova = await p.evaluate(() => ({ faixa: !document.getElementById('avisoNovidades').classList.contains('escondido'), vista: localStorage.getItem(CHAVE_VERSAO_VISTA) }));
  t.ok(!instalacaoNova.faixa && instalacaoNova.vista === versao, 'instalação nova, sem nada lançado, não mostra faixa de novidade');

  t.secao('AJUSTE DE FATURA SEM A CATEGORIA OUTROS');
  const ajuste = await p.evaluate(() => {
    const antes = categorias.slice();
    categorias = ['Lazer', 'Alimentação'];
    const id = lancarAjusteDaFatura('Itaú', 10, 2026, 25.5);
    const l = lancamentos.find(x => x.id === id);
    categorias = antes.concat(antes.includes('Outros') ? [] : ['Outros']);
    const id2 = lancarAjusteDaFatura('Itaú', 10, 2026, 10);
    const l2 = lancamentos.find(x => x.id === id2);
    lancamentos = lancamentos.filter(x => x.id !== id && x.id !== id2);
    categorias = antes;
    return { sem: l.categoria, com: l2.categoria };
  });
  t.ok(ajuste.sem === '' && ajuste.com === 'Outros', 'sem "Outros" cadastrada, o ajuste fica sem categoria (antes caía na primeira da lista, uma real)');
});
