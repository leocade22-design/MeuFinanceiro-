/* VOZ E ROBUSTEZ — o que a varredura geral achou: frases de voz que saíam
   com o valor errado (as parcelas viravam o preço, "2 mil e 500" virava 2,
   os centavos iam pra descrição, a descrição perdia o acento), a parcela do
   fim do mês que caía na fatura errada, o backup errado que apagava tudo e o
   armazenamento cheio que perdia a mudança em silêncio. */
const { iniciar } = require('./ajuda');

iniciar('14 · voz e robustez', async t => {
  const p = await t.abrir();
  await p.evaluate(() => __semear({ contas: [
    { id: 'c1', nome: 'Itaú', temCredito: true, diaFechamento: 28, diaVencimento: 5 },
    { id: 'c2', nome: 'PicPay', temCredito: false }
  ] }));
  await t.recarregar(p);

  t.secao('VOZ');
  const falar = f => p.evaluate(f => {
    window.lancamentoVozPendente = null;
    interpretarFala(f);
    fecharModal('modalVoz');
    const r = lancamentoVozPendente;
    return r && { valor: r.valor, descricao: r.descricao, forma: r.formaModo, parcelas: r.numParcelas, pessoa: r.emprestimoPara };
  }, f);
  const a = await falar('paguei duzentos e cinquenta no cartão em 3 vezes');
  t.ok(a.valor === '250,00' && a.forma === 'Crédito Parcelado' && a.parcelas === '3', '"duzentos e cinquenta no cartão em 3 vezes": R$ 250 em 3x (antes: R$ 3,00)');
  const b = await falar('paguei 2 mil e 500 do aluguel');
  t.ok(b.valor === '2500,00' && b.descricao === 'Aluguel', '"2 mil e 500": R$ 2.500 (antes: R$ 2,00)');
  const c = await falar('gastei 45 reais e 90 centavos no mercado');
  t.ok(c.valor === '45,90' && c.descricao === 'Mercado', '"45 reais e 90 centavos": R$ 45,90, sem "90" na descrição');
  const d = await falar('paguei 12,50 de pão na padaria');
  t.ok(d.valor === '12,50' && /^Pão/.test(d.descricao), 'a descrição volta com acento: "Pão"');
  const e = await falar('emprestei 50 pro João');
  t.ok(e.valor === '50,00' && e.pessoa === 'João', 'o nome de quem deve também: "João"');
  const f = await falar('uber 18 e 90');
  const g = await falar('gastei em tres vezes quinhentos reais no cartão');
  t.ok(f.valor === '18,90' && g.valor === '500,00' && g.parcelas === '3', 'o que já funcionava continua: "18 e 90", e parcelas por extenso não viram preço');

  t.secao('PARCELA NO FIM DO MÊS (CARTÃO QUE FECHA DIA 28)');
  const parc = await p.evaluate(() => {
    const ano = parseInt(obterDataBrasilia().slice(0, 4), 10) + 1;
    const base = ano + '-01-31';
    const datas = [0, 1, 2, 3].map(n => dataDaParcela(base, n, 'Itaú', 'Crédito Parcelado'));
    const faturas = datas.map(x => { const f = getMesFatura(x, 'Crédito Parcelado', 'Itaú'); return f.ano + '-' + String(f.mes + 1).padStart(2, '0'); });
    return { datas, faturas, ano };
  });
  console.log('   ', parc.datas.join(' '), '→', parc.faturas.join(' '));
  t.ok(parc.faturas.join() === [2, 3, 4, 5].map(m => parc.ano + '-0' + m).join(), 'compra em 31/01 em 4x: uma parcela em cada fatura, fev a mai (antes, duas em fevereiro e nenhuma em março)');

  t.secao('BACKUP ERRADO NÃO APAGA NADA');
  await p.evaluate(() => { __lancar({ descricao: 'Mercado', valor: '100,00', conta: 'PicPay', forma: 'Pix', categoria: 'Alimentação' }); });
  const restaurar = (conteudo, aceitar) => p.evaluate(async ({ conteudo, aceitar }) => {
    const qtd = lancamentos.length;
    window.__ultimoAviso = null;
    const confirmOriginal = window.confirm;
    window.confirm = () => aceitar;
    importarBackup({ target: { files: [new File([conteudo], 'x.json', { type: 'application/json' })], value: '' } });
    for (let i = 0; i < 50 && !window.__ultimoAviso && lancamentos.length === qtd; i++) await new Promise(r => setTimeout(r, 20));
    await new Promise(r => setTimeout(r, 50));
    window.confirm = confirmOriginal;
    fecharModal('modalAviso');
    return { aviso: window.__ultimoAviso, antes: qtd, depois: lancamentos.length };
  }, { conteudo, aceitar });
  const lixo = await restaurar(JSON.stringify({ qualquer: 'coisa' }), true);
  t.ok(lixo.aviso === 'backupErro' && lixo.depois === lixo.antes && lixo.antes > 0, 'um JSON que não é backup é recusado e nada some (antes, apagava tudo)');
  const cancelado = await restaurar(JSON.stringify({ lancamentos: [], fixos: [] }), false);
  t.ok(cancelado.depois === cancelado.antes, 'restaurar pergunta antes; cancelar não troca nada');
  const fixosDepois = await p.evaluate(async () => {
    const dados = { lancamentos: [], contas: [{ id: 'c2', nome: 'PicPay', temCredito: false }],
      fixos: [{ id: 'fx', descricao: 'Academia', valor: '99,90', conta: 'PicPay', diaVencimento: 10, categoria: 'Saúde', formaModo: 'À Vista / Débito', dataInicio: __mes(-1, 1), ultimoMesGerado: __chaveMes(-1) }] };
    window.__ultimoAviso = null;
    importarBackup({ target: { files: [new File([JSON.stringify(dados)], 'b.json')], value: '' } });
    for (let i = 0; i < 50 && !window.__ultimoAviso; i++) await new Promise(r => setTimeout(r, 20));
    fecharModal('modalAviso');
    return lancamentos.filter(l => l.fixoId === 'fx').length;
  });
  t.ok(fixosDepois >= 12, 'depois de restaurar, os gastos fixos já são projetados (sem precisar reabrir o app)');

  t.secao('ARMAZENAMENTO CHEIO');
  const cheio = await p.evaluate(async () => {
    window.__ultimoAviso = null;
    window.__gravacaoFalhou = null;
    let erro = null;
    try { localStorage.setItem('enchimento', 'x'.repeat(12 * 1024 * 1024)); } catch (e) { erro = e.name; }
    await new Promise(r => setTimeout(r, 30));
    const r = { erro, aviso: window.__ultimoAviso, falhou: window.__gravacaoFalhou };
    fecharModal('modalAviso');
    return r;
  });
  t.ok(!cheio.erro && cheio.falhou === 'enchimento' && cheio.aviso === 'armazenamentoCheio', 'gravação que não cabe não quebra a tela: o app avisa pra fazer backup');
});
