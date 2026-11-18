/* FOTOS E MEMÓRIAS — até 5 fotos por lançamento, tiradas ou escolhidas dentro
   da janela de observação, comprimidas (lado maior em 1280 px, JPEG) e guardadas
   no IndexedDB. Ícone na lista, carrossel na ficha, modo Memórias, a lixeira
   levando e trazendo as fotos, e o backup versão 4 com as fotos dentro. */
const { iniciar } = require('./ajuda');

// Uma imagem de verdade, gerada na própria página (PNG grande, pra testar a redução)
async function imagem(p, largura, altura, cor) {
  const dataUrl = await p.evaluate(([w, h, c]) => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = c; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(w / 4, h / 4, w / 2, h / 2);
    return cv.toDataURL('image/png');
  }, [largura, altura, cor]);
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

async function escolherFotos(p, imagens) {
  await p.setInputFiles('#inputFotoGaleria', imagens.map((buffer, i) => ({ name: 'foto' + i + '.png', mimeType: 'image/png', buffer })));
  await p.waitForFunction(n => document.querySelectorAll('#miniaturasObs .miniatura-foto').length >= n
    || /fora|não abri/.test(document.getElementById('avisoFotosObs').textContent), Math.min(imagens.length, 5));
  await p.waitForTimeout(150);
}

iniciar('17 · fotos e memórias', async t => {
  const p = await t.abrir();
  const verde = await imagem(p, 2400, 1600, '#2e7d32');
  const azul = await imagem(p, 1200, 2000, '#1565c0');
  const vermelha = await imagem(p, 800, 600, '#c62828');

  t.secao('A CÂMERA MORA NA OBSERVAÇÃO');
  const tela = await p.evaluate(() => {
    abrirModalObs();
    const r = {
      camera: document.getElementById('inputFotoCamera').getAttribute('capture'),
      aceitaCam: document.getElementById('inputFotoCamera').getAttribute('accept'),
      galeriaMultipla: document.getElementById('inputFotoGaleria').multiple,
      galeriaSemCapture: !document.getElementById('inputFotoGaleria').hasAttribute('capture'),
      contador: __texto('#contadorFotosObs'),
      foraDoForm: !!document.querySelector('#formLancamento input[type=file]')
    };
    return r;
  });
  t.ok(tela.camera === 'environment' && tela.aceitaCam === 'image/*' && tela.galeriaMultipla && tela.galeriaSemCapture,
    'dois caminhos: "Tirar foto" abre a câmera (capture) e "Da galeria" escolhe várias (sem capture)');
  t.ok(!tela.foraDoForm && tela.contador === 'até 5', 'o botão de foto só existe dentro da janela de observação, e avisa o limite: ' + tela.contador);

  await escolherFotos(p, [verde, azul]);
  const noModal = await p.evaluate(() => ({ minis: document.querySelectorAll('#miniaturasObs .miniatura-foto').length,
    contador: __texto('#contadorFotosObs'), link: document.getElementById('linkObs').textContent }));
  t.ok(noModal.minis === 2 && noModal.contador === '2 de 5', 'as duas fotos aparecem como miniatura na janela: ' + noModal.contador);
  t.ok(/2 fotos/.test(noModal.link), 'o link da observação conta as fotos: "' + noModal.link + '"');

  t.secao('SALVAR GRAVA AS FOTOS, COMPRIMIDAS');
  await p.evaluate(() => {
    document.getElementById('obsTemp').value = 'Aniversário da Nanda';
    salvarObsModal();
    __lancar({ descricao: 'Bolo da festa', valor: '120,00', conta: 'Itaú', categoria: 'Alimentação', forma: 'À Vista / Débito', data: __dia(0) });
  });
  await p.waitForFunction(() => lancamentos.some(l => l.descricao === 'Bolo da festa' && temFotos(l)));
  const gravadas = await p.evaluate(async () => {
    const l = lancamentos.find(x => x.descricao === 'Bolo da festa');
    const fotos = await fotosDaChave(chaveFotos(l));
    const medidas = [];
    for (const f of fotos) {
      const b = await createImageBitmap(f.foto); const m = await createImageBitmap(f.mini);
      medidas.push({ w: b.width, h: b.height, tipo: f.foto.type, mw: m.width, mh: m.height, kb: Math.round(f.foto.size / 1024) });
    }
    return { chave: chaveFotos(l), medidas, obs: l.observacao, form: fotosVisiveisDoFormulario().length };
  });
  const [m1, m2] = gravadas.medidas;
  t.ok(gravadas.medidas.length === 2 && m1.w === 1280 && m1.h === 853 && m2.h === 1280 && m2.w === 768,
    'o lado maior vira 1280 px, sem distorcer: ' + gravadas.medidas.map(m => m.w + '×' + m.h).join(', '));
  t.ok(m1.tipo === 'image/jpeg' && m1.mw === 480 && m2.mh === 480, 'gravadas em JPEG, com miniatura de 480 px (' + m1.kb + ' KB a primeira)');
  t.ok(gravadas.obs === 'Aniversário da Nanda' && gravadas.form === 0, 'a observação entra junto, e o formulário volta limpo pro próximo lançamento');

  t.secao('ÍCONE NA LISTA E CARROSSEL NA FICHA');
  await p.evaluate(() => { __aba('abaFaturas'); });
  await p.waitForTimeout(250);
  const lista = await p.evaluate(() => {
    const linhas = [...document.querySelectorAll('#listaLancamentos .item-lancamento')];
    const bolo = linhas.find(d => /Bolo da festa/.test(d.textContent));
    return { icone: !!(bolo && bolo.querySelector('.icone-tem-foto')), outros: linhas.filter(d => d !== bolo && d.querySelector('.icone-tem-foto')).length,
      botao: !document.getElementById('btnMemorias').classList.contains('escondido') };
  });
  t.ok(lista.icone && lista.outros === 0, 'só o lançamento com foto ganha o ícone de câmera na lista');
  t.ok(lista.botao, 'o botão Memórias aparece no card da lista quando existe foto');

  const idBolo = await p.evaluate(() => lancamentos.find(x => x.descricao === 'Bolo da festa').id);
  await p.evaluate(id => abrirDetalheLancamentoPorId(id), idBolo);
  await p.waitForFunction(() => document.querySelectorAll('#fotosDaFicha .quadro-foto').length === 2);
  const ficha = await p.evaluate(() => ({ pos: __texto('#posicaoFotoFicha'), texto: __texto('#corpoDetalheCobranca'),
    seta: !document.getElementById('fotoSeguinte').classList.contains('escondido') }));
  t.ok(ficha.pos === 'foto 1 de 2' && ficha.seta, 'a ficha abre com o carrossel: ' + ficha.pos + ', com setas pra quem prefere tocar');
  t.ok(/Aniversário da Nanda/.test(ficha.texto) && /120,00/.test(ficha.texto) && /Alimentação/.test(ficha.texto),
    'a ficha mostra junto a observação, o valor, a data e a categoria');
  await t.foto(p, 'ficha_com_fotos.png', '#modalDetalheCobranca .modal-content');
  await p.evaluate(() => { const tr = document.getElementById('trilhoFotosFicha'); tr.scrollLeft = tr.clientWidth; tr.dispatchEvent(new Event('scroll')); });
  await p.waitForTimeout(150);
  t.ok(await p.evaluate(() => __texto('#posicaoFotoFicha')) === 'foto 2 de 2', 'arrastar pro lado passa pra segunda foto');

  await p.evaluate(() => document.getElementById('btnApagarFotoFicha').click());
  await p.waitForFunction(() => document.querySelectorAll('#fotosDaFicha .quadro-foto').length === 1);
  const depoisDeApagar = await p.evaluate(async id => {
    const l = lancamentos.find(x => x.id === id);
    return { banco: (await fotosDaChave(chaveFotos(l))).length, pos: __texto('#posicaoFotoFicha') };
  }, idBolo);
  t.ok(depoisDeApagar.banco === 1 && depoisDeApagar.pos === '1 foto', 'apagar uma foto tira só ela, do banco e da ficha');
  await p.evaluate(() => fecharModal('modalDetalheCobranca'));

  t.secao('ATÉ 5 POR LANÇAMENTO');
  await p.evaluate(id => { prepararEdicao(id); abrirModalObs(); }, idBolo);
  await p.waitForFunction(() => document.querySelectorAll('#miniaturasObs .miniatura-foto').length === 1);
  await escolherFotos(p, [vermelha, verde, azul, vermelha, verde, azul]);
  const limite = await p.evaluate(() => ({ minis: document.querySelectorAll('#miniaturasObs .miniatura-foto').length,
    aviso: __texto('#avisoFotosObs'), travado: [...document.querySelectorAll('.btn-foto')].every(b => b.disabled) }));
  t.ok(limite.minis === 5 && /2 ficaram de fora/.test(limite.aviso), 'com 1 já guardada, das 6 escolhidas entram 4: ' + limite.aviso);
  t.ok(limite.travado, 'com 5 fotos os botões de foto ficam travados');
  // tira uma das novas e uma das antigas antes de salvar a edição
  await p.evaluate(() => {
    const botoes = document.querySelectorAll('#miniaturasObs .tirar-foto');
    botoes[botoes.length - 1].click();
    document.querySelectorAll('#miniaturasObs .tirar-foto')[0].click();
    salvarObsModal();
    executarSalvarLancamento(120);
  });
  await p.waitForFunction(id => (fotosPorChave.get('l:' + id) || 0) === 3, idBolo);
  t.ok(true, 'editar o lançamento grava as fotos novas e tira as que você removeu (ficaram 3)');

  t.secao('PARCELADO: A FOTO É DA COMPRA');
  await p.evaluate(() => abrirModalObs());
  await escolherFotos(p, [azul]);
  await p.evaluate(() => {
    salvarObsModal();
    __lancar({ descricao: 'Geladeira nova', valor: '3000,00', conta: 'Itaú', categoria: 'Casa', forma: 'Crédito Parcelado', parcelas: 3, data: __dia(0) });
  });
  await p.waitForFunction(() => lancamentos.filter(l => /Geladeira nova/.test(l.descricao) && temFotos(l)).length === 3);
  t.ok(true, 'as 3 parcelas mostram a mesma foto (a chave é o grupo da compra)');

  t.secao('MEMÓRIAS');
  await p.evaluate(() => { __aba('abaFaturas'); alternarMemorias(); });
  await p.waitForFunction(() => document.querySelectorAll('#listaLancamentos .card-memoria .capa-memoria img').length === 2);
  const memorias = await p.evaluate(() => ({
    cards: [...document.querySelectorAll('#listaLancamentos .card-memoria')].map(c => c.querySelector('strong').textContent),
    titulo: __texto('#tituloListaLanc'),
    buscaSumiu: getComputedStyle(document.querySelector('[data-card="lancamentosMes"] .busca-box')).display === 'none',
    qtd: __texto('#listaLancamentos .card-memoria .qtd-fotos-memoria'),
    botao: __texto('#btnMemorias')
  }));
  t.ok(memorias.titulo === 'Memórias' && memorias.cards.length === 2 && memorias.cards.includes('Geladeira nova') && memorias.cards.includes('Bolo da festa'),
    'Memórias mostra só o que tem foto, um card por compra (a geladeira em 3x é um card só): ' + memorias.cards.join(', '));
  t.ok(memorias.buscaSumiu && /voltar/.test(memorias.botao), 'no modo Memórias a busca e os filtros saem da frente, e o botão vira "voltar à lista"');
  await t.foto(p, 'memorias.png', '[data-card="lancamentosMes"]');
  await p.evaluate(() => document.querySelector('#listaLancamentos .card-memoria').click());
  await p.waitForFunction(() => !document.getElementById('modalDetalheCobranca').classList.contains('escondido')
    && document.querySelectorAll('#fotosDaFicha .quadro-foto').length > 0);
  t.ok(true, 'tocar no card da memória abre a ficha com as fotos');
  await p.evaluate(() => { fecharModal('modalDetalheCobranca'); alternarMemorias(); });
  t.ok(await p.evaluate(() => document.querySelectorAll('#listaLancamentos .item-lancamento').length > 0 && __texto('#tituloListaLanc') !== 'Memórias'),
    'voltar à lista devolve a lista do mês');

  t.secao('AS FOTOS SEGUEM A LIXEIRA');
  await p.evaluate(id => excluirLancamento(id), idBolo);
  const naLixeira = await p.evaluate(async id => ({ banco: (await fotosDaChave('l:' + id)).length, naLista: lancamentos.some(l => l.id === id) }), idBolo);
  t.ok(!naLixeira.naLista && naLixeira.banco === 3, 'excluir o lançamento não apaga as fotos: elas esperam com ele na lixeira');
  await p.evaluate(id => restaurarDaLixeira(lixeira.findIndex(r => r.id === id)), idBolo);
  await p.waitForTimeout(200);
  const restaurado = await p.evaluate(id => {
    const l = lancamentos.find(x => x.id === id);
    const linha = [...document.querySelectorAll('#listaLancamentos .item-lancamento')].find(d => /Bolo da festa/.test(d.textContent));
    return { tem: temFotos(l), icone: !!(linha && linha.querySelector('.icone-tem-foto')) };
  }, idBolo);
  t.ok(restaurado.tem && restaurado.icone, 'restaurou da lixeira, as fotos voltaram junto (ícone de volta na lista)');

  t.secao('BACKUP VERSÃO 4, COM AS FOTOS DENTRO');
  await p.evaluate(() => __aba('abaConfig'));
  await p.waitForFunction(() => /Fotos guardadas/.test(__texto('#infoFotos')));
  const ajustes = await p.evaluate(() => ({ info: __texto('#infoFotos'), tam: __texto('#tamanhoFotosBackup'),
    linha: !document.getElementById('linhaIncluirFotos').classList.contains('escondido'), marcado: document.getElementById('chkIncluirFotos').checked }));
  t.ok(/4 fotos em 2 lançamentos · \d+ KB/.test(ajustes.info), 'Ajustes mostra o espaço das fotos: ' + ajustes.info);
  t.ok(ajustes.linha && ajustes.marcado && /cerca de .+ \(sem as fotos, .+\)/.test(ajustes.tam),
    'a opção "incluir as fotos" vem marcada e mostra o tamanho estimado antes de exportar: ' + ajustes.tam);

  await p.evaluate(() => { window.showSaveFilePicker = undefined; navigator.canShare = undefined; });
  const [download] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportarBackup())]);
  const fs = require('fs');
  const comFotos = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  t.ok(comFotos.versao === 4 && Array.isArray(comFotos.fotos) && comFotos.fotos.length === 4
    && comFotos.fotos.every(f => /^data:image\/jpeg;base64,/.test(f.foto) && f.chave && f.id && !f.mini),
    'o backup sai na versão 4 com as 4 fotos embutidas (só a grande; a miniatura nasce de novo ao importar)');

  await p.evaluate(() => { document.getElementById('chkIncluirFotos').click(); });
  const [download2] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportarBackup())]);
  const semFotos = JSON.parse(fs.readFileSync(await download2.path(), 'utf8'));
  t.ok(semFotos.versao === 4 && !('fotos' in semFotos) && semFotos.lancamentos.length === comFotos.lancamentos.length,
    'desmarcado, o backup sai sem as fotos (e com todo o resto)');
  await p.evaluate(() => { document.getElementById('chkIncluirFotos').click(); });

  // apaga as fotos do aparelho e importa o backup com fotos
  await p.evaluate(async () => { await apagarFotosDasChaves([...fotosPorChave.keys()]); await recontarFotos(); });
  t.ok(await p.evaluate(() => fotosPorChave.size === 0), '(as fotos foram apagadas do aparelho pra testar a volta)');
  await p.evaluate(texto => importarBackup({ target: { files: [new File([texto], 'b.json', { type: 'application/json' })], value: 'x' } }), JSON.stringify(comFotos));
  await p.waitForFunction(() => window.__ultimoAviso === 'backupOk' && fotosPorChave.size === 2);
  const voltaram = await p.evaluate(async id => {
    const fotos = await fotosDaChave('l:' + id);
    const m = await createImageBitmap(fotos[0].mini);
    return { qtd: fotos.length, mini: Math.max(m.width, m.height), aviso: __texto('#avisoDetalhe'),
      memorias: lancamentosComFoto().map(l => descricaoBaseCompra(l.descricao)) };
  }, idBolo);
  t.ok(voltaram.qtd === 3 && voltaram.mini === 480 && /4 fotos/.test(voltaram.aviso),
    'importar devolve as fotos ao IndexedDB, cada uma no lançamento certo (com a miniatura refeita): ' + voltaram.aviso);
  t.ok(voltaram.memorias.length === 2, 'as Memórias voltam inteiras depois do backup');

  t.secao('BACKUP ANTIGO (VERSÃO 3) CONTINUA ENTRANDO');
  const v3 = Object.assign({}, semFotos, { versao: 3 });
  await p.evaluate(texto => { window.__ultimoAviso = null; importarBackup({ target: { files: [new File([texto], 'b.json', { type: 'application/json' })], value: 'x' } }); }, JSON.stringify(v3));
  await p.waitForFunction(() => window.__ultimoAviso === 'backupOk');
  const depoisV3 = await p.evaluate(() => ({ lanc: lancamentos.length, fotos: fotosPorChave.size, comFoto: lancamentosComFoto().length }));
  t.ok(depoisV3.lanc === v3.lancamentos.length && depoisV3.fotos === 2 && depoisV3.comFoto === 2,
    'um backup sem fotos entra igual e não apaga as fotos que já estão no aparelho (os ids são os mesmos)');

  t.secao('FOTO SOLTA E LIXEIRA ESVAZIADA');
  // um backup em que a geladeira não existe: a foto dela fica solta
  const semGeladeira = Object.assign({}, v3, { lancamentos: v3.lancamentos.filter(l => !/Geladeira/.test(l.descricao)) });
  await p.evaluate(texto => { window.__ultimoAviso = null; importarBackup({ target: { files: [new File([texto], 'b.json', { type: 'application/json' })], value: 'x' } }); }, JSON.stringify(semGeladeira));
  await p.waitForFunction(() => window.__ultimoAviso === 'backupOk');
  await p.evaluate(() => atualizarInfoFotos());
  await p.waitForFunction(() => /solta/.test(__texto('#infoFotos')));
  t.ok(/1 foto solta \(sem lançamento\)/.test(await p.evaluate(() => __texto('#infoFotos'))), 'a foto sem lançamento aparece como solta em Ajustes, com o botão de apagar');
  await p.evaluate(() => document.querySelector('#infoFotos button').click());
  await p.waitForFunction(() => fotosPorChave.size === 1 && !/solta/.test(__texto('#infoFotos')));
  t.ok(true, 'apagar as soltas não mexe nas fotos de quem ainda existe');

  await p.evaluate(id => { excluirLancamento(id); esvaziarLixeira(); }, idBolo);
  await p.waitForFunction(() => fotosPorChave.size === 0);
  t.ok(await p.evaluate(async id => (await fotosDaChave('l:' + id)).length === 0, idBolo),
    'esvaziar a lixeira apaga de vez as fotos de quem estava nela');
  const semBotao = await p.evaluate(() => { __aba('abaFaturas'); return document.getElementById('btnMemorias').classList.contains('escondido'); });
  t.ok(semBotao, 'sem nenhuma foto, o botão Memórias some');
});
