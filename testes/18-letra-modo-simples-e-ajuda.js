/* PÚBLICO 55+ — tamanho da letra (Normal, Grande, Extra grande), alto contraste,
   toques de 44 px, Modo Simples (mesmos dados, só uma classe no body), tema
   Fofo, tutorial de primeiro uso, gesto de trocar de aba com liga/desliga e
   dica, e os guias passo a passo de backup e de instalação. */
const { iniciar } = require('./ajuda');

// Arrasta o dedo na tela, como no celular: começo, alguns passos e o fim
async function arrastar(p, dx, { soltar = true } = {}) {
  return p.evaluate(async ([dx, soltar]) => {
    const alvo = document.querySelector('.aba-conteudo.ativo .card:last-child') || document.querySelector('.aba-conteudo.ativo');
    const x0 = 300, y0 = 500;
    const toque = (x, y) => new Touch({ identifier: 1, target: alvo, clientX: x, clientY: y });
    const enviar = (tipo, x, y) => alvo.dispatchEvent(new TouchEvent(tipo, {
      bubbles: true, cancelable: true,
      touches: tipo === 'touchend' ? [] : [toque(x, y)],
      changedTouches: [toque(x, y)]
    }));
    const antes = document.querySelector('.aba-conteudo.ativo').getBoundingClientRect().left;
    enviar('touchstart', x0, y0);
    const passos = 6;
    for (let i = 1; i <= passos; i++) {
      enviar('touchmove', x0 + dx * i / passos, y0);
      await new Promise(r => setTimeout(r, 30));
    }
    const atual = document.querySelector('.aba-conteudo.ativo');
    const meio = { andou: atual.getBoundingClientRect().left - antes, arrastando: !!arraste };
    if (soltar) {
      enviar('touchend', x0 + dx, y0);
      await new Promise(r => setTimeout(r, 450));
    }
    return Object.assign(meio, { aba: document.querySelector('.aba-conteudo.ativo').id });
  }, [dx, soltar]);
}

iniciar('18 · letra, modo simples, tema fofo e ajuda', async t => {
  t.secao('TUTORIAL DE PRIMEIRO USO');
  let p = await t.abrir('index.html', { semContas: true, tutorial: true });
  const tut = await p.evaluate(() => ({ aberto: !document.getElementById('modalTutorial').classList.contains('escondido'),
    passo: __texto('#passoTutorial'), titulo: __texto('.titulo-tutorial') }));
  t.ok(tut.aberto && tut.passo === '1 de 4' && /Anote/.test(tut.titulo), 'instalação nova abre o tutorial, na tela 1 de 4: ' + tut.titulo);
  const telas = await p.evaluate(() => {
    const t = [];
    for (let i = 0; i < 4; i++) { t.push(__texto('.titulo-tutorial')); if (i < 3) passoTutorial(1); }
    return { t, botao: __texto('#btnTutorialSeguir'), pular: document.getElementById('btnPularTutorial').classList.contains('invisivel') };
  });
  t.ok(/Anote/.test(telas.t[0]) && /aba/.test(telas.t[1]) && /cópia/.test(telas.t[2]) && telas.botao === 'Começar',
    'as 4 telas ensinam a lançar, trocar de aba e salvar uma cópia: ' + telas.t.join(' / '));
  await p.evaluate(() => { passoTutorial(-3); document.getElementById('btnPularTutorial').click(); });
  t.ok(await p.evaluate(() => document.getElementById('modalTutorial').classList.contains('escondido')
    && localStorage.getItem('meu_financeiro_tutorial_visto_v1') === '1'), 'Pular fecha e não pergunta de novo');
  await t.recarregar(p);
  t.ok(await p.evaluate(() => document.getElementById('modalTutorial').classList.contains('escondido')), 'recarregar o app não reabre o tutorial');
  await p.evaluate(() => { __aba('abaConfig'); document.querySelector('#corpo-acessibilidade .botoes-ajuda button').click(); });
  t.ok(await p.evaluate(() => !document.getElementById('modalTutorial').classList.contains('escondido') && __texto('#passoTutorial') === '1 de 4'),
    'dá pra rever o tutorial em Ajustes → Letra, modo e ajuda');
  await p.evaluate(() => fecharTutorial());

  // quem já usa o app (tem lançamento) não leva aula
  p = await t.abrir('index.html', { tutorial: true });
  await p.evaluate(() => { __semear({ lancamentos: [{ id: 1, tipo: 'despesa', descricao: 'Pão', valor: '12,00', data: __dia(0), conta: 'Itaú', formaModo: 'À Vista / Débito', categoria: 'Alimentação' }] }); });
  await t.recarregar(p);
  t.ok(await p.evaluate(() => document.getElementById('modalTutorial').classList.contains('escondido')), 'quem já tem lançamento não vê o tutorial sozinho');

  t.secao('TAMANHO DA LETRA');
  p = await t.abrir();
  await p.evaluate(() => { __semear({ lancamentos: [
    { id: 1, tipo: 'despesa', descricao: 'Mercado', valor: '230,00', data: __dia(0), conta: 'Itaú', formaModo: 'Crédito à Vista', categoria: 'Alimentação' },
    { id: 2, tipo: 'receita', descricao: 'Salário', valor: '4500,00', data: __dia(0), conta: 'Itaú', formaModo: 'À Vista / Débito' }] }); });
  await t.recarregar(p);
  const medir = () => p.evaluate(() => {
    const largura = innerWidth;
    const abas = ['abaLancamentos', 'abaFaturas', 'abaGraficos', 'abaInvestimentos', 'abaConfig'];
    const rolaPraLado = abas.filter(id => { __aba(id); return document.documentElement.scrollWidth > largura + 1; });
    __aba('abaLancamentos');
    const nav = [...document.querySelectorAll('.nav-tab')].map(b => b.getBoundingClientRect());
    return { zoom: escalaDaTela(), rolaPraLado, abasNaTela: nav.every(r => r.right <= largura + 1 && r.left >= -1),
      menorAba: Math.min(...nav.map(r => r.height)) };
  });
  const normal = await medir();
  t.ok(normal.zoom === 1 && normal.menorAba >= 44, 'Normal: tamanho de sempre, e as abas com toque de 44 px (' + Math.round(normal.menorAba) + ' px)');
  await p.evaluate(() => escolherTamanhoLetra('grande'));
  const grande = await medir();
  await p.evaluate(() => escolherTamanhoLetra('extra'));
  const extra = await medir();
  t.ok(Math.abs(grande.zoom - 1.12) < 0.001 && Math.abs(extra.zoom - 1.25) < 0.001, 'Grande aumenta 12% e Extra grande 25%, o app inteiro junto');
  t.ok(!grande.rolaPraLado.length && !extra.rolaPraLado.length, 'nenhuma aba rola pro lado com a letra maior' + (extra.rolaPraLado.length ? ': ' + extra.rolaPraLado : ''));
  t.ok(grande.abasNaTela && extra.abasNaTela, 'as cinco abas continuam à vista (na Extra grande elas quebram em duas linhas)');
  await t.recarregar(p);
  t.ok(await p.evaluate(() => document.body.classList.contains('letra-extra') && document.querySelector('[data-letra="extra"]').getAttribute('aria-pressed') === 'true'),
    'a escolha fica guardada: o app reabre com a letra Extra grande');
  await t.foto(p, 'letra_extra.png');

  t.secao('GESTO DE TROCAR DE ABA');
  const dicaAntes = await p.evaluate(() => !document.getElementById('dicaGesto').classList.contains('escondido'));
  t.ok(dicaAntes, 'a dica "arraste o dedo pro lado" aparece embaixo das abas');
  const meio = await arrastar(p, -100, { soltar: false });
  t.ok(meio.arrastando && Math.abs(meio.andou + 100) < 3, 'com a letra Extra grande, a aba acompanha o dedo certinho (andou ' + Math.round(meio.andou) + ' px pra 100 do dedo)');
  await p.evaluate(() => { const alvo = document.querySelector('.aba-conteudo.ativo');
    alvo.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [new Touch({ identifier: 1, target: alvo, clientX: 200, clientY: 500 })] })); });
  await p.waitForTimeout(450);
  t.ok(await p.evaluate(() => document.querySelector('.aba-conteudo.ativo').id === 'abaFaturas'), 'soltar depois de um terço da tela troca pra aba vizinha');
  t.ok(await p.evaluate(() => document.getElementById('dicaGesto').classList.contains('escondido') && uiPrefs.dicaGestoVista === true),
    'usou o gesto uma vez, a dica sai e não volta');
  await p.evaluate(() => { escolherTamanhoLetra('normal'); __aba('abaLancamentos'); document.getElementById('chkGestoAbas').click(); });
  const desligado = await arrastar(p, -200);
  t.ok(!desligado.arrastando && desligado.aba === 'abaLancamentos', 'com o gesto desligado em Ajustes, arrastar não troca de aba');
  await p.evaluate(() => { uiPrefs.dicaGestoVista = false; aplicarDicaGesto(); });
  t.ok(await p.evaluate(() => document.getElementById('dicaGesto').classList.contains('escondido')), 'e a dica do gesto nem aparece');
  await p.evaluate(() => document.getElementById('chkGestoAbas').click());
  const ligado = await arrastar(p, -200);
  t.ok(ligado.aba === 'abaFaturas', 'religado, o gesto volta a funcionar');

  t.secao('ALTO CONTRASTE');
  const contraste = await p.evaluate(() => {
    // a mistura de cores sai como color(srgb 0..1); as outras, como rgb(0..255)
    const canais = c => { const n = c.match(/[\d.]+/g).map(Number); return /^color\(/.test(c) ? n.slice(0, 3) : n.slice(0, 3).map(v => v / 255); };
    const lum = c => { const [r, g, b] = canais(c).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const medida = () => { const el = document.createElement('span'); el.style.color = 'var(--texto-tenue)'; document.querySelector('.card').appendChild(el);
      const c = getComputedStyle(el).color; el.remove(); return razao(c, getComputedStyle(document.querySelector('.card')).backgroundColor); };
    const antes = medida();
    alternarAltoContraste(true);
    const depois = medida();
    aplicarTema('claro');
    const claro = medida();
    aplicarTema('escuro');
    alternarAltoContraste(false);
    return { antes: antes.toFixed(1), depois: depois.toFixed(1), claro: claro.toFixed(1) };
  });
  t.ok(parseFloat(contraste.depois) >= 4.5 && parseFloat(contraste.claro) >= 4.5 && parseFloat(contraste.depois) > parseFloat(contraste.antes),
    'o texto mais apagado passa de ' + contraste.antes + ':1 pra ' + contraste.depois + ':1 (e ' + contraste.claro + ':1 no tema Claro), acima do mínimo de 4,5:1');

  t.secao('MODO SIMPLES');
  const antesSimples = await p.evaluate(() => ({ lanc: lancamentos.length, contas: contas.length,
    secLanc: secaoEstaAberta('lancamentosMes'), dados: localStorage.getItem(STORAGE_KEY) }));
  await p.evaluate(() => { uiPrefs.secao_evolucaoMensal = true; salvarUiPrefs(); escolherModo(true); __aba('abaFaturas'); });
  const simples = await p.evaluate(() => ({
    classe: document.body.classList.contains('modo-simples'),
    letra: tamanhoLetra(), contraste: document.body.classList.contains('alto-contraste'),
    abas: [...document.querySelectorAll('.nav-tab')].map(b => b.textContent.trim()),
    icones: [...document.querySelectorAll('.nav-tab .icone-aba')].every(i => getComputedStyle(i).display !== 'none'),
    tipo: __texto('#btnDespesa') + ' / ' + __texto('#btnReceita'),
    lancMes: secaoEstaAberta('lancamentosMes'), fatura: secaoEstaAberta('pagamentoFatura'), evolucao: secaoEstaAberta('evolucaoMensal'),
    resumoNaTela: getComputedStyle(document.getElementById('cardResumoFaturas')).display !== 'none',
    cardsLa: ['lancamentosMes', 'emprestimos', 'fixos', 'grupos'].every(c => document.querySelector('#abaFaturas > [data-card="' + c + '"]').offsetHeight > 0),
    olho: document.getElementById('btnOlhoFaturas').getBoundingClientRect().height,
    menorBotao: (__aba('abaConfig'), Math.min(...[...document.querySelectorAll('#abaConfig .btn-mini')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height))),
    volta: __aba('abaFaturas')
  }));
  t.ok(simples.classe && simples.letra === 'grande' && simples.contraste, 'o Modo Simples liga a letra Grande e o alto contraste');
  t.ok(simples.abas.join(',') === 'Lançar,Meu mês,Gráficos,Investir,Ajustes' && simples.icones && simples.tipo === '- Gastei / + Recebi',
    'palavras simples e ícones grandes: ' + simples.abas.join(' · ') + ' · ' + simples.tipo);
  t.ok(simples.resumoNaTela && simples.fatura && !simples.lancMes && !simples.evolucao,
    'na frente fica o essencial: o Resumo (saldo e fatura) e o card da fatura; a lista e os gráficos ficam recolhidos');
  t.ok(simples.cardsLa, 'os outros cards continuam lá, recolhidos, a um toque');
  t.ok(simples.menorBotao >= 44 && simples.menorBotao < 100 && simples.olho >= 44,
    'os botões pequenos passam a ter 44 px de toque (o menor tem ' + Math.round(simples.menorBotao) + ' px; o olho, ' + Math.round(simples.olho) + ')');
  await t.foto(p, 'modo_simples_faturas.png');
  await p.evaluate(() => { alternarSecao('lancamentosMes'); });
  t.ok(await p.evaluate(() => document.querySelectorAll('#listaLancamentos .item-lancamento').length === 2), 'abrir um card no Modo Simples funciona normal');

  await p.evaluate(() => escolherModo(false));
  const volta = await p.evaluate(() => ({ classe: document.body.classList.contains('modo-simples'), letra: tamanhoLetra(),
    contraste: document.body.classList.contains('alto-contraste'), secLanc: secaoEstaAberta('lancamentosMes'), evolucao: secaoEstaAberta('evolucaoMensal'),
    abas: [...document.querySelectorAll('.nav-tab')].map(b => b.textContent.trim()).join(','),
    lanc: lancamentos.length, contas: contas.length, dados: localStorage.getItem(STORAGE_KEY) }));
  t.ok(!volta.classe && volta.letra === 'normal' && !volta.contraste && volta.abas === 'Lançamentos,Faturas,Gráficos,Investim.,Ajustes',
    'voltar pro Completo devolve a letra, o contraste e os nomes de antes');
  t.ok(volta.secLanc === antesSimples.secLanc && volta.evolucao === true, 'e cada card volta aberto ou fechado do jeito que você tinha deixado');
  t.ok(volta.lanc === antesSimples.lanc && volta.contas === antesSimples.contas && volta.dados === antesSimples.dados,
    'trocar de modo não mexe em nenhum dado (o que está gravado é idêntico, byte a byte)');

  t.secao('TEMA FOFO');
  const fofo = await p.evaluate(() => { aplicarTema('fofo'); renderizarTemas();
    const r = { fundo: getComputedStyle(document.documentElement).getPropertyValue('--fundo').trim(),
      raio: getComputedStyle(document.querySelector('.card')).borderTopLeftRadius,
      naLista: [...document.querySelectorAll('#listaTemas button')].some(b => /Fofo/.test(b.textContent)),
      simplesJunto: (escolherModo(true), document.body.classList.contains('modo-simples') && document.documentElement.getAttribute('data-tema') === 'fofo') };
    escolherModo(false); return r; });
  t.ok(fofo.fundo === '#fff5ec' && fofo.raio === '22px' && fofo.naLista, 'o tema Fofo entra no seletor de temas: creme, lilás e cantos redondos');
  t.ok(fofo.simplesJunto, 'o tema é independente do modo: Fofo e Modo Simples juntos');
  await t.foto(p, 'tema_fofo.png');
  await p.evaluate(() => aplicarTema('escuro'));

  t.secao('AVISO DE BACKUP E GUIAS');
  await p.evaluate(() => { localStorage.removeItem(CHAVE_ULTIMO_BACKUP); lancamentos.forEach(l => { l.data = __dia(-40); }); atualizarAvisoBackup(); });
  const faixa = await p.evaluate(() => ({ visivel: !document.getElementById('avisoBackup').classList.contains('escondido'), texto: __texto('#avisoBackup') }));
  t.ok(faixa.visivel && /Salve uma cópia dos seus dados/.test(faixa.texto) && /só neste celular/.test(faixa.texto) && /como\?/.test(faixa.texto),
    'o aviso fala simples ("Salve uma cópia dos seus dados") e oferece o passo a passo');
  await p.evaluate(() => [...document.querySelectorAll('#avisoBackup button')].find(b => /como/.test(b.textContent)).click());
  const guia = await p.evaluate(() => ({ titulo: __texto('#tituloGuia'), passos: document.querySelectorAll('#corpoGuia .passos-guia li').length,
    botao: __texto('#btnAcaoGuia'), volta: /Importar backup/.test(__texto('#corpoGuia')) }));
  t.ok(guia.titulo === 'Salve uma cópia dos seus dados' && guia.passos === 3 && guia.volta && guia.botao === 'Salvar cópia agora',
    'o guia tem 3 passos, explica como trazer os dados de volta e já tem o botão de salvar');
  await p.evaluate(() => { window.showSaveFilePicker = undefined; navigator.canShare = undefined; });
  const [download] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => document.getElementById('btnAcaoGuia').click())]);
  t.ok(/backup-meu-financeiro-.*\.json/.test(download.suggestedFilename()), '"Salvar cópia agora" faz o backup de verdade: ' + download.suggestedFilename());
  const instalar = await p.evaluate(() => { abrirGuia('instalar'); return { titulo: __texto('#tituloGuia'), texto: __texto('#corpoGuia'),
    botaoEscondido: document.getElementById('btnAcaoGuia').classList.contains('escondido') }; });
  t.ok(/tela inicial/.test(instalar.titulo) && /Android/.test(instalar.texto) && /iPhone/.test(instalar.texto) && instalar.botaoEscondido,
    'o guia de instalação traz o passo a passo do Android e do iPhone (o botão "Instalar agora" só aparece quando o navegador oferece)');
  await p.evaluate(() => fecharModal('modalGuia'));
});
