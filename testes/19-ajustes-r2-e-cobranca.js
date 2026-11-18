/* RODADA 2 (18/11) — respiro de 24px entre as abas (arraste e toque), ordem de
   Ajustes, 10 temas em duas colunas com o Grafite, um card só pra ordem dos
   cards, Grupos sem olho próprio, ícone do relatório; e o agente de cobrança:
   gênero, apelido e relação, concordância, quatro tons, assistente só na
   Zoeira, escalada, sem repetir as últimas 5, prévia editável e respostas. */
const { iniciar } = require('./ajuda');

const hoje = n => `__dia(${n})`;

iniciar('19 · ajustes da rodada 2 e agente de cobrança', async t => {
  let p = await t.abrir();

  t.secao('RESPIRO DE 24PX ENTRE AS ABAS');
  const arrasto = async zoomLetra => p.evaluate(async letra => {
    escolherTamanhoLetra(letra);
    __aba('abaGraficos');
    const alvo = document.querySelector('#abaGraficos .card');
    const toque = x => new Touch({ identifier: 1, target: alvo, clientX: x, clientY: 600 });
    alvo.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [toque(380)], changedTouches: [toque(380)] }));
    for (let x = 370; x >= 220; x -= 10) {
      alvo.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [toque(x)], changedTouches: [toque(x)] }));
      await new Promise(r => setTimeout(r, 10));
    }
    // a borda dos cards: o fim do card da aba que sai e o começo do card da que entra
    const sai = document.querySelector('#abaGraficos .card').getBoundingClientRect();
    const entra = document.querySelector('#abaInvestimentos .card').getBoundingClientRect();
    const espiada = document.getElementById('abaInvestimentos');
    const r = { respiro: Math.round(entra.left - sai.right), sombraCabe: getComputedStyle(espiada).paddingLeft };
    alvo.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true }));
    await new Promise(res => setTimeout(res, 320));
    escolherTamanhoLetra('normal');
    return r;
  }, zoomLetra);
  const normal = await arrasto('normal');
  const extra = await arrasto('extra');
  t.ok(normal.respiro === 24, 'no arraste, 24px entre o card que sai e o que entra (medido: ' + normal.respiro + 'px)');
  t.ok(Math.abs(extra.respiro - 30) <= 1, 'com a letra Extra grande o respiro cresce junto com o app (24px × 1,25 = ' + extra.respiro + 'px de tela)');
  t.ok(normal.sombraCabe === '24px', 'a aba que entra ganha 24px de lado pra sombra dos cards não ser cortada');

  await p.emulateMedia({ reducedMotion: 'no-preference' });
  const toque = await p.evaluate(async () => {
    __aba('abaGraficos');
    await new Promise(r => setTimeout(r, 50));
    document.querySelector('.nav-tab[onclick*="abaInvestimentos"]').click();
    await new Promise(r => setTimeout(r, 120));
    const sai = document.querySelector('#abaGraficos .card').getBoundingClientRect();
    const entra = document.querySelector('#abaInvestimentos .card').getBoundingClientRect();
    const meio = { respiro: Math.round(entra.left - sai.right), ativa: document.querySelector('.aba-conteudo.ativo').id,
      saindoVisivel: getComputedStyle(document.getElementById('abaGraficos')).display !== 'none' };
    await new Promise(r => setTimeout(r, 400));
    meio.depois = getComputedStyle(document.getElementById('abaGraficos')).display;
    return meio;
  });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  t.ok(toque.saindoVisivel && Math.abs(toque.respiro - 24) <= 1, 'tocando no nome da aba, as duas deslizam juntas com o mesmo respiro (' + toque.respiro + 'px no meio do caminho)');
  t.ok(toque.ativa === 'abaInvestimentos' && toque.depois === 'none', 'a aba nova vira a ativa na hora, e a velha some no fim do deslize');

  t.secao('ORDEM DE AJUSTES');
  const ordem = await p.evaluate(() => [...document.querySelectorAll('#abaConfig > .card h3')].map(h => h.textContent.trim()));
  const esperada = ['Contas e categorias', 'Grupos de investimento', 'Contatos de cobrança', 'Letra, modo e ajuda', 'Aparência', 'Sons', 'Ordem dos cards'];
  t.ok(esperada.every((x, i) => ordem[i] === x), 'Ajustes na ordem nova: ' + ordem.slice(0, 7).join(' · '));

  t.secao('TEMAS: 10, ESCUROS À ESQUERDA E CLAROS À DIREITA');
  const temas = await p.evaluate(() => {
    __aba('abaConfig'); renderizarTemas();
    const botoes = [...document.getElementById('listaTemas').children];
    const nomes = botoes.map(b => b.textContent.trim().split(/\s+/)[0]);
    const esq = nomes.filter((_, i) => i % 2 === 0), dir = nomes.filter((_, i) => i % 2 === 1);
    aplicarTema('grafite');
    const cor = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const graf = { fundo: cor('--fundo'), acento: cor('--acento'), tenue: cor('--texto-tenue'), card: cor('--card') };
    return { total: TEMAS.length, esq, dir, graf, cab: document.getElementById('cabecalhoTemas').textContent };
  });
  t.ok(temas.total === 10 && temas.esq.join(',') === 'Escuro,Índigo,Floresta,Violeta,Grafite' && temas.dir.join(',') === 'Claro,Sépia,Papel,Rosa,Fofo',
    'esquerda: ' + temas.esq.join(', ') + ' · direita: ' + temas.dir.join(', '));
  // contraste do cinza mais apagado do Grafite sobre o card
  const lum = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); };
  const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  t.ok(razao(temas.graf.tenue, temas.graf.card) >= 4.5 && temas.graf.acento === '#e8a93c',
    'Grafite: chumbo com destaque âmbar, e até o texto mais apagado lê com folga (' + razao(temas.graf.tenue, temas.graf.card).toFixed(1) + ':1)');
  await p.evaluate(() => aplicarTema('papel'));
  await t.recarregar(p);
  t.ok(await p.evaluate(() => document.documentElement.getAttribute('data-tema') === 'papel'), 'o tema escolhido continua o mesmo depois de abrir o app de novo');
  await p.evaluate(() => aplicarTema('escuro'));

  t.secao('UM CARD SÓ PRA ORDEM DOS CARDS');
  const ordemCards = await p.evaluate(() => {
    uiPrefs.ordemCards = { abaFaturas: ['grupos', 'fixos', 'emprestimos', 'pagamentoFatura', 'lancamentosMes'], abaGraficos: ['metas', 'indicadores'] };
    salvarUiPrefs();
    __aba('abaConfig');
    const lista = () => [...document.querySelectorAll('#ordemCardsLista [data-item]')].map(e => e.dataset.item);
    const faturas = lista();
    escolherAbaDaOrdem('abaGraficos');
    const graficos = lista();
    const botoes = [...document.querySelectorAll('#seletorAbaOrdem button')].map(b => b.textContent.trim());
    escolherAbaDaOrdem('abaFaturas');
    return { faturas, graficos, botoes, velhos: !!document.getElementById('corpo-ordemFaturas') || !!document.getElementById('corpo-ordemGraficos'),
      cards: [...document.querySelectorAll('#abaConfig > .card h3')].filter(h => /Ordem dos cards|Cards da aba/.test(h.textContent)).length };
  });
  t.ok(ordemCards.cards === 1 && !ordemCards.velhos && ordemCards.botoes.join('|') === 'Faturas|Gráficos', 'um card "Ordem dos cards" com o seletor Faturas | Gráficos no topo');
  t.ok(ordemCards.faturas.slice(0, 5).join(',') === 'grupos,fixos,emprestimos,pagamentoFatura,lancamentosMes' && ordemCards.graficos.slice(0, 2).join(',') === 'metas,indicadores',
    'a ordem que já estava salva em cada aba continua a mesma');

  t.secao('GRUPOS SEM OLHO PRÓPRIO, RELATÓRIO SEM EMOJI');
  await p.evaluate(() => { __semear({ grupos: [{ id: 'g1', nome: 'Viagem', status: 'aberto', dataCriacao: __dia(-5) }],
    lancamentos: [{ id: 1, tipo: 'despesa', descricao: 'Hotel', valor: '450,00', data: __dia(-2), conta: 'Itaú', formaModo: 'À Vista / Débito', categoria: 'Lazer', grupoViagemId: 'g1', grupoViagemNome: 'Viagem' }] }); });
  await t.recarregar(p);
  const olho = await p.evaluate(() => {
    __aba('abaFaturas'); uiPrefs.secao_grupos = true; aplicarSecao('grupos'); renderizarGrupos();
    const olhos = [...document.querySelectorAll('#abaFaturas .btn-olho')].map(b => b.id);
    const antes = document.querySelector('[data-card="grupos"]').textContent;
    document.getElementById('btnOlhoFaturas').click();
    const depois = document.querySelector('[data-card="grupos"]').textContent;
    document.getElementById('btnOlhoFaturas').click();
    const rel = [...document.querySelectorAll('#abaGraficos button')].find(b => /Relatório do consultor/.test(b.textContent));
    return { olhos, antesTem: /450,00/.test(antes), depoisEsconde: !/450,00/.test(depois) && /•••/.test(depois),
      relEmoji: /📋/.test(rel.textContent), relSvg: !!rel.querySelector('svg[stroke="currentColor"]') };
  });
  t.ok(olho.olhos.length === 1 && olho.olhos[0] === 'btnOlhoFaturas', 'na aba Faturas só existe o olho do Resumo (' + olho.olhos.join(', ') + ')');
  t.ok(olho.antesTem && olho.depoisEsconde, 'o olho do topo esconde também os valores dos Grupos');
  t.ok(!olho.relEmoji && olho.relSvg, 'o botão do relatório troca o 📋 por um ícone de documento na cor do texto');

  t.secao('AGENTE DE COBRANÇA: CADASTRO E CONCORDÂNCIA');
  p = await t.abrir();
  await p.evaluate(() => {
    const L = (id, desc, v, vence, quem) => ({ id, tipo: 'despesa', descricao: desc, valor: v, data: __dia(-20), conta: 'Itaú',
      formaModo: 'À Vista / Débito', categoria: 'Lazer', emprestimoPara: quem, emprestimoVence: vence });
    __semear({
      lancamentos: [L(1, 'Gympass', '140,00', __dia(2), 'Ana'), L(2, 'Airbnb', '200,00', __dia(-10), 'Bernardo'),
        L(3, 'Pizza', '120,00', __dia(-5), 'Sam'), L(4, 'Passagem', '600,00', __dia(-3), 'Mãe'), L(5, 'Almoço', '48,00', __dia(-4), 'Bia'),
        L(6, 'Show', '90,00', __dia(-6), 'Ana')],
      contatos: { Ana: { tel: '5511900000001', tom: 'neutro' }, Bernardo: { tel: '5511900000002', tom: 'neutro' },
        Sam: { tel: '5511900000003', tom: 'neutro' }, 'Mãe': { tel: '5511900000004', tom: 'neutro' }, Bia: { tel: '5511900000005', tom: 'neutro' } }
    });
    uiPrefs.meuNome = 'Ana Paula'; uiPrefs.chavePix = '(11) 90000-0000'; salvarUiPrefs();
    window.__enviadas = [];
    window.open = u => { window.__enviadas.push(decodeURIComponent(u.split('text=')[1] || '')); return null; };
  });
  await t.recarregar(p);
  await p.evaluate(() => { window.__enviadas = []; window.open = u => { window.__enviadas.push(decodeURIComponent(u.split('text=')[1] || '')); return null; }; });

  // cadastro: gênero com palpite, apelido e relação
  const cadastro = await p.evaluate(() => {
    abrirModalContatoCobranca('Bernardo');
    const palpite = document.getElementById('seletorGeneroContato').dataset.valor;
    const dica = __texto('#dicaGeneroContato');
    document.getElementById('inputApelidoContato').value = 'Bernardão';
    marcarOpcaoContato('seletorRelacaoContato', 'amigo');
    salvarContatoCobranca();
    abrirModalContatoCobranca('Mãe');
    marcarOpcaoContato('seletorGeneroContato', 'f'); marcarOpcaoContato('seletorRelacaoContato', 'familia'); salvarContatoCobranca();
    abrirModalContatoCobranca('Bia');
    marcarOpcaoContato('seletorGeneroContato', 'f'); marcarOpcaoContato('seletorRelacaoContato', 'colega'); salvarContatoCobranca();
    abrirModalContatoCobranca('Sam');
    marcarOpcaoContato('seletorGeneroContato', 'n'); salvarContatoCobranca();
    escolherMeuGenero('f');
    return { palpite, dica, bern: contatos.Bernardo, mae: contatos['Mãe'], sam: contatos.Sam, exemplo: __texto('#exemploMeuNome') };
  });
  t.ok(cadastro.palpite === 'm' && /Palpite pelo nome/.test(cadastro.dica), 'o cadastro sugere o gênero pelo primeiro nome, e pede pra conferir: "' + cadastro.dica + '"');
  t.ok(cadastro.bern.genero === 'm' && cadastro.bern.apelido === 'Bernardão' && cadastro.bern.relacao === 'amigo' && cadastro.bern.tel === '5511900000002',
    'salvar guarda gênero, "como chamo" e relação, sem perder o telefone');
  t.ok(/capanga da Ana Paula/.test(cadastro.exemplo), 'o gênero de quem usa o app vale pro assistente: ' + cadastro.exemplo);

  const amostra = (nome, tom, vezes) => p.evaluate(([nome, tom, vezes]) => {
    const lista = cobrancasAbertas().filter(c => c.nome === nome);
    return Array.from({ length: vezes }, () => textoDaCobranca(nome, lista, false, tom));
  }, [nome, tom, vezes]);
  const bern = [].concat(await amostra('Bernardo', 'zoeira', 25), await amostra('Bernardo', 'leve', 25));
  const ana = [].concat(await amostra('Ana', 'zoeira', 25), await amostra('Ana', 'leve', 25));
  const sam = [].concat(await amostra('Sam', 'zoeira', 40), await amostra('Sam', 'leve', 20), await amostra('Sam', 'firme', 20));
  const femininas = /\b(querida|sumida|parceira|minha cara|Olha ela|pagadora)\b/;
  const masculinas = /\b(querido|sumido|parceiro|meu caro|Olha ele|pagador)\b/;
  t.ok(bern.every(x => !femininas.test(x)) && bern.some(x => /Bernardão/.test(x)) && bern.every(x => !/Bernardo\b/.test(x.split('\n')[0])),
    'Bernardo (masculino) nunca recebe palavra no feminino, e a mensagem chama pelo apelido "Bernardão"');
  t.ok(ana.every(x => !masculinas.test(x)), 'Ana (palpite feminino) nunca recebe "querido", "sumido", "parceiro"...');
  t.ok(sam.every(x => !masculinas.test(x) && !femininas.test(x) && !/[{}\[\]]/.test(x)), 'Sam ("Não definir") só recebe frases neutras, sem nenhum marcador sobrando');
  t.ok(bern.filter(x => /(capanga|secretária|narrador|assistente)/i.test(x)).every(x => /da Ana Paula/.test(x)),
    'o assistente se apresenta concordando com a dona do app ("da Ana Paula")');

  t.secao('QUATRO TONS E O ASSISTENTE SÓ NA ZOEIRA');
  const tons = await p.evaluate(() => {
    const lista = cobrancasAbertas().filter(c => c.nome === 'Bernardo');
    const N = 30;
    const de = tom => Array.from({ length: N }, () => textoDaCobranca('Bernardo', lista, false, tom));
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const leve = de('leve'), neutro = de('neutro'), zoeira = de('zoeira'), firme = de('firme');
    const personagem = /(capanga|secretária|narrador|assistente)/i;
    return {
      firmeSemEmoji: firme.every(x => !emoji.test(x)),
      zoeiraComEmoji: zoeira.filter(x => emoji.test(x)).length,
      leveEmoji: leve.filter(x => emoji.test(x)).length,
      soZoeiraTemPersonagem: ![].concat(leve, neutro, firme).some(x => personagem.test(x)) && zoeira.some(x => personagem.test(x)),
      pixNoFim: [].concat(leve, zoeira).every(x => /Pix \(telefone\): \(11\) 90000-0000$/.test(x)),
      semLista: [].concat(leve, neutro, zoeira, firme).every(x => !/^\s*[•\-*]\s/m.test(x)),
      valorNoMeio: leve.every(x => /R\$ 200/.test(x))
    };
  });
  t.ok(tons.firmeSemEmoji && tons.zoeiraComEmoji >= 28 && tons.leveEmoji < 15, 'Firme sem nenhum emoji, Zoeira com emoji, Leve com pouco (' + tons.leveEmoji + ' de 30)');
  t.ok(tons.soZoeiraTemPersonagem, 'o assistente (capanga, secretária, narrador) só aparece na Zoeira; nos outros tons é você falando');
  t.ok(tons.pixNoFim && tons.semLista && tons.valorNoMeio, 'o Pix vai no fim, o valor vai no meio da frase e nunca sai em formato de lista');

  t.secao('PRÉVIA, OUTRA VERSÃO E CINCO COBRANÇAS DIFERENTES');
  const previa = await p.evaluate(async () => {
    const chaves = cobrancasAbertas().filter(c => c.nome === 'Bernardo').map(c => c.chave);
    abrirCobrancaWhatsApp('Bernardo', chaves, false);
    const caixa = document.getElementById('previaCobrancaTexto');
    const primeira = caixa.value;
    document.getElementById('btnOutraVersao').click();
    const segunda = caixa.value;
    const tonsNaTela = [...document.querySelectorAll('#opcoesTomCobranca [data-tom]')].map(b => b.dataset.tom).join(',');
    caixa.value = 'Bernardão, editei aqui: me manda os 200? Pix (telefone): (11) 90000-0000';
    document.getElementById('btnAbrirWhatsAppCobranca').click();
    return { primeira, segunda, tonsNaTela, enviada: window.__enviadas[window.__enviadas.length - 1], aberta: !document.getElementById('modalTomCobranca').classList.contains('escondido') };
  });
  t.ok(previa.primeira && previa.segunda && previa.primeira !== previa.segunda && previa.tonsNaTela === 'leve,neutro,zoeira,firme',
    'a janela mostra os 4 tons e a prévia; "Outra versão" troca o texto');
  t.ok(previa.enviada === 'Bernardão, editei aqui: me manda os 200? Pix (telefone): (11) 90000-0000' && !previa.aberta,
    'o texto editado na prévia é o que vai pro WhatsApp');
  await t.foto(p, 'cobranca_previa.png');

  const cinco = await p.evaluate(async () => {
    const textos = [];
    for (let i = 0; i < 5; i++) {
      const chaves = cobrancasAbertas().filter(c => c.nome === 'Ana').map(c => c.chave);
      abrirCobrancaWhatsApp('Ana', chaves, false);
      escolherTomCobranca('zoeira');
      document.getElementById('btnAbrirWhatsAppCobranca').click();
      textos.push(window.__enviadas[window.__enviadas.length - 1]);
    }
    return { textos, hist: (contatos.Ana.ultimasMsgs || []).length };
  });
  t.ok(new Set(cinco.textos).size === 5 && cinco.hist === 5, 'cinco cobranças seguidas pra Ana saem com cinco textos diferentes (as últimas 5 ficam guardadas)');

  t.secao('ESCALADA E RELAÇÃO');
  const escalada = await p.evaluate(() => {
    const sug = nome => { const l = cobrancasAbertas().filter(c => c.nome === nome); const d = separarMesDaCobranca(l).doMes; return tomSugerido(nome, contagemDaCobranca(d).nivel, situacaoDaCobranca(d)); };
    const mandar = nome => { const chaves = cobrancasAbertas().filter(c => c.nome === nome).map(c => c.chave);
      abrirCobrancaWhatsApp(nome, chaves, false); document.getElementById('btnAbrirWhatsAppCobranca').click(); };
    const r = { bia: sug('Bia'), mae: sug('Mãe') };
    r.s0 = sug('Sam'); mandar('Sam'); r.s1 = sug('Sam'); mandar('Sam'); r.s2 = sug('Sam');
    // adiamento conta: a Mãe, sem mensagem nenhuma, adiada duas vezes
    const chave = chaveCompra(lancamentos.find(l => l.emprestimoPara === 'Mãe'));
    deslocarVencimentoCompra(chave, 1); r.m1 = sug('Mãe'); deslocarVencimentoCompra(chave, 1); r.m2 = sug('Mãe');
    // família: o app não sugere Zoeira nem chama o assistente sozinho
    contatos['Mãe'].tom = 'zoeira'; deslocarVencimentoCompra(chave, -1); deslocarVencimentoCompra(chave, -1);
    r.maeZoeira = sug('Mãe');
    const chavesMae = cobrancasAbertas().filter(c => c.nome === 'Mãe').map(c => c.chave);
    abrirCobrancaWhatsApp('Mãe', chavesMae, false);
    escolherTomCobranca('zoeira');
    r.personaMae = document.querySelector('#opcoesPersona [aria-pressed="true"]').dataset.persona;
    r.textoMae = document.getElementById('previaCobrancaTexto').value;
    r.motivo = __texto('#motivoTomCobranca');
    fecharModal('modalTomCobranca');
    return r;
  });
  t.ok(escalada.s0 === 'leve' && escalada.s1 === 'neutro' && escalada.s2 === 'firme', '1ª mensagem leve, 2ª mais direta, 3ª em diante firme: ' + [escalada.s0, escalada.s1, escalada.s2].join(' → '));
  t.ok(escalada.m1 === 'neutro' && escalada.m2 === 'firme', 'adiamento conta na escalada (sem nenhuma mensagem, dois "+1 mês" já pedem Firme)');
  t.ok(escalada.bia === 'neutro', 'colega de trabalho recebe tom mais neutro (Bia: ' + escalada.bia + ')');
  t.ok(escalada.maeZoeira !== 'zoeira' && escalada.personaMae === 'nenhum' && !/(capanga|secretária|narrador)/i.test(escalada.textoMae),
    'Família: mesmo com Zoeira de costume, o app não sugere Zoeira nem chama o assistente (dá pra escolher se quiser)');

  t.secao('CONTATO ANTIGO E RESPOSTAS');
  const antigo = await p.evaluate(() => {
    contatos['Lu'] = { tel: '5511900000009', tom: 'neutro' };   // formato antigo: só tel e tom
    lancamentos.push({ id: 9, tipo: 'despesa', descricao: 'Uber', valor: '30,00', data: __dia(-3), conta: 'Itaú', formaModo: 'À Vista / Débito', categoria: 'Transporte', emprestimoPara: 'Lu', emprestimoVence: __dia(-1) });
    salvarLocalStorage(); salvarContatos();
    const chaves = cobrancasAbertas().filter(c => c.nome === 'Lu').map(c => c.chave);
    abrirCobrancaWhatsApp('Lu', chaves, false);
    const perguntou = !document.getElementById('perguntaGeneroCobranca').classList.contains('escondido');
    const texto = document.getElementById('previaCobrancaTexto').value;
    document.querySelector('#opcoesGeneroCobranca [data-genero="f"]').click();
    const salvo = contatos['Lu'].genero;
    const sumiu = document.getElementById('perguntaGeneroCobranca').classList.contains('escondido');
    fecharModal('modalTomCobranca');
    return { perguntou, texto: !!texto, salvo, sumiu };
  });
  t.ok(antigo.perguntou && antigo.texto && antigo.salvo === 'f' && antigo.sumiu,
    'contato antigo sem gênero: a janela pergunta, a mensagem já sai (neutra), e a resposta fica salva');

  const respostas = await p.evaluate(async () => {
    // novo prazo: botão discreto no card depois de adiar
    __aba('abaFaturas'); uiPrefs.secao_emprestimos = true; aplicarSecao('emprestimos');
    const chave = chaveCompra(lancamentos.find(l => l.emprestimoPara === 'Bia'));
    deslocarVencimentoCompra(chave, 1);
    emprestimosPessoasAbertas.add('recebo:Bia'); renderizarEmprestimos();
    const btnPrazo = [...document.querySelectorAll('#listaEmprestimos button')].find(b => /avisar novo prazo/.test(b.textContent));
    btnPrazo.click();
    const prazo = { titulo: __texto('#tituloTomCobranca'), texto: document.getElementById('previaCobrancaTexto').value,
      firme: !!document.querySelector('#opcoesTomCobranca [data-tom="firme"]') };
    const antes = (lancamentos.find(l => l.emprestimoPara === 'Bia').cobrancasEnviadas || {}).Bia || 0;
    document.getElementById('btnAbrirWhatsAppCobranca').click();
    const depois = (lancamentos.find(l => l.emprestimoPara === 'Bia').cobrancasEnviadas || {}).Bia || 0;
    // recebi: a Bia paga, e o botão aparece nas já quitadas
    const c = cobrancasAbertas().find(x => x.nome === 'Bia');
    abrirReceberEmprestimo([c.chave]); confirmarRecebimentoEmprestimo();
    quitadasAberto = true; quitadasPessoasAbertas.add('Bia'); renderizarEmprestimos();
    const btnValeu = [...document.querySelectorAll('#blocoQuitadas button')].find(b => /recebi, valeu/.test(b.textContent));
    btnValeu.click();
    const valeu = { titulo: __texto('#tituloTomCobranca'), texto: document.getElementById('previaCobrancaTexto').value };
    fecharModal('modalTomCobranca');
    return { prazo, contouPrazo: depois !== antes, valeu, abriuSozinho: false };
  });
  const dd = await p.evaluate(() => { const l = lancamentos.find(x => x.emprestimoPara === 'Bia'); return l.emprestimoVence.slice(8, 10) + '/' + l.emprestimoVence.slice(5, 7); });
  t.ok(/Novo prazo com Bia/.test(respostas.prazo.titulo) && respostas.prazo.texto.includes(dd) && !respostas.prazo.firme && !respostas.contouPrazo,
    'depois do "+1 mês", o botão discreto "avisar novo prazo" monta a confirmação com a data nova (' + dd + '), e isso não conta como cobrança');
  t.ok(/Agradecer Bia/.test(respostas.valeu.titulo) && /(recebi|caiu|chegou|quitad|recebido|confirm)/i.test(respostas.valeu.texto) && !/Pix/.test(respostas.valeu.texto),
    'quem pagou ganha o botão "mandar \'recebi, valeu\'" nas já quitadas: ' + respostas.valeu.texto.split('\n')[0]);

  t.secao('BACKUP ANTIGO E RENOMEAR');
  const compat = await p.evaluate(async () => {
    renomearContato('Bernardo', 'Bernardo Silva');
    const r = { renomeado: contatos['Bernardo Silva'] };
    const antigoBackup = { versao: 3, exportadoEm: new Date().toISOString(), lancamentos: lancamentos.slice(0, 2), contatos: { Ana: { tel: '5511900000001', tom: 'zoeira' } } };
    window.__ultimoAviso = null;
    importarBackup({ target: { files: [new File([JSON.stringify(antigoBackup)], 'b.json', { type: 'application/json' })], value: '' } });
    await new Promise(res => setTimeout(res, 300));
    r.aviso = window.__ultimoAviso;
    const lista = cobrancasAbertas().filter(c => c.nome === 'Ana');
    r.texto = lista.length ? textoDaCobranca('Ana', lista, false) : '';
    return r;
  });
  t.ok(compat.renomeado && compat.renomeado.apelido === 'Bernardão' && compat.renomeado.genero === 'm' && compat.renomeado.relacao === 'amigo',
    'renomear o contato leva gênero, apelido e relação junto');
  t.ok(compat.aviso === 'backupOk' && compat.texto.length > 20, 'backup antigo, com contato só de telefone e tom, entra e cobra normalmente');
});
