/* CATEGORIAS E CONTATOS — criar, renomear (levando lançamentos e meta),
   excluir (vazia, ou movendo o que usa) e a categoria apagada que não volta
   sozinha; o nome do contato que não se duplica e o renomear que junta tudo. */
const { iniciar } = require('./ajuda');

iniciar('09 · categorias e contatos', async t => {
  const p = await t.abrir();
  await p.evaluate(() => __semear({
    contas: [{ id: 'c1', nome: 'Itaú', temCredito: false }],
    lancamentos: [
      { id: 1, tipo: 'despesa', descricao: 'Mercado', valor: '100,00', data: __mes(0, 1), conta: 'Itaú', formaModo: 'Pix', categoria: 'Alimentação' },
      { id: 2, tipo: 'despesa', descricao: 'Parcela', valor: '394,78', data: __mes(0, 1), conta: 'Itaú', formaModo: 'Pix', categoria: 'Consórcio' },
      { id: 3, tipo: 'despesa', descricao: 'Jantar', valor: '80,00', data: __mes(0, 2), conta: 'Itaú', formaModo: 'Pix', categoria: 'Lazer', emprestimoPara: 'bernardo' }
    ],
    metas: { 'Alimentação': 600 },
    contatos: { Bernardo: { tel: '27999990000', tom: 'neutro' } }
  }));
  await t.recarregar(p);
  const salvar = (nome, idx) => p.evaluate(({ nome, idx }) => {
    if (idx == null) abrirFormCategoria(); else editarCategoria(idx);
    document.getElementById('nomeCategoria').value = nome;
    salvarCategoria();
    const aviso = window.__ultimoAviso; window.__ultimoAviso = null;
    fecharModal('modalAviso'); fecharModal('modalFormCategoria');
    return aviso;
  }, { nome, idx });

  t.secao('CRIAR E RENOMEAR');
  await salvar('Pets');
  const dup = await salvar('pets');
  const criou = await p.evaluate(() => categorias.filter(c => c.toLowerCase() === 'pets').length);
  t.ok(criou === 1 && dup === 'duplicado', 'cria "Pets" e não deixa criar "pets" de novo (avisa que já existe)');
  await salvar('Comida', await p.evaluate(() => categorias.indexOf('Alimentação')));
  const ren = await p.evaluate(() => ({ cats: categorias.includes('Comida') && !categorias.includes('Alimentação'),
    lanc: lancamentos.find(l => l.id === 1).categoria, meta: orcamentosCategoria['Comida'], metaVelha: orcamentosCategoria['Alimentação'] }));
  t.ok(ren.cats && ren.lanc === 'Comida', 'renomear Alimentação → Comida troca os lançamentos que usavam (confirmando)');
  t.ok(ren.meta === 600 && ren.metaVelha === undefined, 'e a meta de R$ 600 vai junto');

  t.secao('EXCLUIR');
  const vazia = await p.evaluate(() => {
    excluirCategoria(categorias.indexOf('Pets'));   // sem uso: confirma e some
    return { some: !categorias.includes('Pets'), excluida: categoriasExcluidas.includes('Pets') };
  });
  t.ok(vazia.some && vazia.excluida, 'categoria sem uso: confirma e some');
  const usada = await p.evaluate(() => {
    if (!categorias.includes('Investimento')) categorias.push('Investimento');
    excluirCategoria(categorias.indexOf('Consórcio'));
    const janela = !document.getElementById('modalExcluirCategoria').classList.contains('escondido');
    const info = __texto('#infoExcluirCategoria');
    const sugerido = document.getElementById('destinoExcluirCategoria').value;
    confirmarExclusaoCategoria();
    return { janela, info, sugerido, lanc: lancamentos.find(l => l.id === 2).categoria, some: !categorias.includes('Consórcio') };
  });
  t.ok(usada.janela && /1 lançamento ainda usa/.test(usada.info) && usada.sugerido === 'Investimento', 'categoria em uso: pergunta pra onde mover (sugere Investimento)');
  t.ok(usada.some && usada.lanc === 'Investimento', 'excluída, e o lançamento foi pra Investimento');
  await t.recarregar(p);
  const naoVolta = await p.evaluate(() => {
    // um lançamento ainda com a categoria apagada não pode trazê-la de volta
    lancamentos.push({ id: 9, tipo: 'despesa', descricao: 'Antigo', valor: '1,00', data: __mes(-2, 1), conta: 'Itaú', formaModo: 'Pix', categoria: 'Consórcio' });
    salvarLocalStorage();
    return true;
  });
  await t.recarregar(p);
  const depois = await p.evaluate(() => ({ consorcio: categorias.includes('Consórcio'), pets: categorias.includes('Pets') }));
  t.ok(naoVolta && !depois.consorcio && !depois.pets, 'categoria apagada não volta sozinha ao abrir o app, mesmo com lançamento antigo usando');
  await salvar('Pets');
  t.ok(await p.evaluate(() => categorias.includes('Pets') && !categoriasExcluidas.includes('Pets')), 'criar de novo com o mesmo nome vale como "quero de volta"');

  t.secao('CONTATOS');
  const contatos = await p.evaluate(() => ({ canon: nomeCanonico('  BERNARDO '), novo: nomeCanonico('Clara'), conhecidos: nomesConhecidos() }));
  t.ok(contatos.canon === 'Bernardo' && contatos.novo === 'Clara', 'nome digitado de outro jeito vira o do cadastro ("BERNARDO" → "Bernardo")');
  t.ok(contatos.conhecidos.filter(n => n.toLowerCase() === 'bernardo').length === 1, 'o "bernardo" minúsculo do lançamento não vira uma segunda pessoa');
  const renomeia = await p.evaluate(() => {
    renomearContato('Bernardo', 'Bernardo Borges');
    return { lanc: lancamentos.find(l => l.id === 3).emprestimoPara, contato: contatos['Bernardo Borges'], velho: contatos['Bernardo'] };
  });
  t.ok(renomeia.lanc === 'Bernardo Borges' && renomeia.contato && renomeia.contato.tel === '27999990000' && !renomeia.velho, 'renomear o contato troca o nome nas cobranças e leva o telefone junto');
});
