/* LABORATÓRIO · FASE 1 — ORÇAMENTO E LIMITES POR MÊS
   Aprovada pelo Leo e pelo Borges em 11/10/2026. Carrega depois do app e do
   lab.js, e troca o card "Metas por categoria" dos Gráficos por "Metas do mês".

   Tudo opcional: sem nada planejado, o card mostra só as categorias, como
   antes. As regras combinadas:
   - RENDA DO MÊS: digitada, ou somada das receitas do mês (sem reembolso,
     empréstimo recebido, empréstimo indireto nem estorno de fatura).
   - GASTO DO ORÇAMENTO: as despesas do mês pela data da compra (a mesma régua
     dos gráficos), já descontados os reembolsos e SEM aportes nem parcelas de
     consórcio — esses contam na meta de investimento (fase 2).
   - AVISO: amarelo a partir de 80% do limite (cada pessoa muda o seu),
     vermelho a partir de 100%.
   - HISTÓRICO: o plano vale a partir do mês em que foi salvo. Mudar um mês que
     já passou não mexe nos seguintes. Tirar um limite nunca apaga lançamento.

   Quando a fase for pro app principal, este código entra no index.html e a
   gaveta passa a ser meu_financeiro_planejamento_v1. */

const CHAVE_PLANEJAMENTO = PREFIXO_GAVETAS + 'planejamento_v1';
const AVISO_PADRAO = 80;
const MESES_A_FRENTE_NAS_METAS = 1;   // dá pra planejar o mês que vem
const MESES_PRA_TRAS_NAS_METAS = 24;

/* { vigencias: [{ desde: 'AAAA-MM', renda, gastoTotal, aviso, limites }] }
   renda: null | { modo: 'digitada', valor } | { modo: 'receitas' }
   Cada vigência vale do mês `desde` até a próxima. */
let planejamento = { vigencias: [] };
let mesMetasOffset = 0;   // mês mostrado no card: 0 = o atual

/* ---------- meses ---------- */
function chaveDoMes(mes, ano) { return ano + '-' + String(mes + 1).padStart(2, '0'); }
function chaveDoMesAtual() { return obterDataBrasilia().slice(0, 7); }
function deslocarChaveMes(chave, n) {
  const [a, m] = chave.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return chaveDoMes(d.getMonth(), d.getFullYear());
}
function nomeDoMesPlano(chave) {
  const [a, m] = chave.split('-').map(Number);
  const nome = NOMES_MESES[m - 1].toLowerCase();
  return a === Number(chaveDoMesAtual().slice(0, 4)) ? nome : nome + '/' + a;
}
function chaveMesDasMetas() { return deslocarChaveMes(chaveDoMesAtual(), mesMetasOffset); }

/* ---------- gaveta ---------- */
function salvarPlanejamento() { localStorage.setItem(CHAVE_PLANEJAMENTO, JSON.stringify(planejamento)); }

function limitesValidos(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(c => {
    const v = Number(typeof obj[c] === 'string' ? parseVal(obj[c]) : obj[c]);
    if (c && v > 0) out[c] = Math.round(v * 100) / 100;
  });
  return out;
}

/* Primeira vez: as metas por categoria de hoje viram o plano inicial, valendo
   desde o lançamento mais antigo — o passado continua comparado com elas,
   como já era. Sem metas, nada é criado. */
function planejamentoInicial(orcamentos) {
  const limites = limitesValidos(orcamentos);
  if (!Object.keys(limites).length) return { vigencias: [] };
  const datas = lancamentos.map(l => l.data).filter(Boolean).sort();
  const desde = (datas[0] || obterDataBrasilia()).slice(0, 7);
  return { vigencias: [{ desde, renda: null, gastoTotal: null, aviso: AVISO_PADRAO, limites }] };
}

function ordenarVigencias() { planejamento.vigencias.sort((a, b) => a.desde.localeCompare(b.desde)); }

function carregarPlanejamento() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(CHAVE_PLANEJAMENTO)); } catch (e) { p = null; }
  if (p && Array.isArray(p.vigencias)) {
    planejamento = p;
  } else {
    planejamento = planejamentoInicial(orcamentosCategoria);
    salvarPlanejamento();
  }
  ordenarVigencias();
}

/* O resto do app (a linha de meta no gráfico, o backup, a lista de categorias
   em uso) continua lendo orcamentosCategoria. Ela passa a ser um espelho dos
   limites do mês atual, regravado a cada mudança no plano. */
function espelharLimitesDoMesAtual() {
  if (!planejamento.vigencias.length) return;
  orcamentosCategoria = Object.assign({}, planoDoMes(chaveDoMesAtual()).limites);
  salvarOrcamentos();
}

/* ---------- o plano de cada mês ---------- */
function planoVazio() { return { renda: null, gastoTotal: null, aviso: AVISO_PADRAO, limites: {}, desde: null }; }

// A vigência mais recente que começa no mês ou antes dele
function planoDoMes(chave) {
  let v = null;
  planejamento.vigencias.forEach(x => { if (x.desde <= chave) v = x; });
  if (!v) return planoVazio();
  return {
    renda: v.renda ? Object.assign({}, v.renda) : null,
    gastoTotal: v.gastoTotal > 0 ? v.gastoTotal : null,
    aviso: v.aviso > 0 ? v.aviso : AVISO_PADRAO,
    limites: Object.assign({}, v.limites || {}),
    desde: v.desde
  };
}

function planoTemAlgo(plano) {
  return !!(plano.renda || plano.gastoTotal > 0 || Object.keys(plano.limites).length);
}

/* Grava o plano de um mês. Do mês atual pra frente, vale dali em diante (até a
   próxima vigência que já existir). Num mês que já passou, o mês seguinte é
   congelado antes com o plano que tinha — a mudança vale só naquele mês. */
function gravarPlanoDoMes(chave, plano) {
  if (chave < chaveDoMesAtual()) {
    const seguinte = deslocarChaveMes(chave, 1);
    if (!planejamento.vigencias.some(v => v.desde === seguinte)) {
      const antes = planoDoMes(seguinte);
      planejamento.vigencias.push({ desde: seguinte, renda: antes.renda, gastoTotal: antes.gastoTotal, aviso: antes.aviso, limites: antes.limites });
    }
  }
  const nova = {
    desde: chave,
    renda: plano.renda || null,
    gastoTotal: plano.gastoTotal > 0 ? Math.round(plano.gastoTotal * 100) / 100 : null,
    aviso: plano.aviso > 0 ? Math.min(100, Math.max(1, Math.round(plano.aviso))) : AVISO_PADRAO,
    limites: limitesValidos(plano.limites)
  };
  const i = planejamento.vigencias.findIndex(v => v.desde === chave);
  if (i >= 0) planejamento.vigencias[i] = nova; else planejamento.vigencias.push(nova);
  ordenarVigencias();
  salvarPlanejamento();
  espelharLimitesDoMesAtual();
}

/* ---------- as contas ---------- */
// Aporte e parcela de consórcio são dinheiro guardado, não gasto: ficam fora
// do orçamento e entram na meta de investimento.
function ehInvestimentoNoOrcamento(l) {
  if (l.aporteId) return true;
  if ((l.categoria || '') === 'Investimento') return true;
  if (investimentos.some(i => i.lancamentoId != null && i.lancamentoId === l.id)) return true;
  return !!l.fixoId && consorcios.some(c => c.fixoId && c.fixoId === l.fixoId);
}

function despesasDoOrcamento(chave) {
  const [a, m] = chave.split('-').map(Number);
  return despesasDoMes(m - 1, a).filter(l => !ehInvestimentoNoOrcamento(l));
}

// valorLiquidoDespesa = a régua do "descontar reembolsos" dos gráficos
function gastoPorCategoriaNoOrcamento(chave) {
  const out = {};
  despesasDoOrcamento(chave).forEach(l => {
    const c = l.categoria || 'Outros';
    out[c] = (out[c] || 0) + valorLiquidoDespesa(l);
  });
  return out;
}

function gastoDoOrcamento(chave) {
  return despesasDoOrcamento(chave).reduce((s, l) => s + valorLiquidoDespesa(l), 0);
}

function receitaContaComoRenda(l) {
  return l.tipo === 'receita' && !l.reembolsoDe && !l.emprestimoPara && !ehEmprestimoIndireto(l) && !l.ajusteFatura;
}

function rendaSomadaDasReceitas(chave) {
  return lancamentos.filter(l => receitaContaComoRenda(l) && (l.data || '').slice(0, 7) === chave)
    .reduce((s, l) => s + parseVal(l.valor), 0);
}

function rendaDoMes(chave, plano) {
  const r = (plano || planoDoMes(chave)).renda;
  if (!r) return null;
  if (r.modo === 'receitas') return { valor: rendaSomadaDasReceitas(chave), modo: 'receitas' };
  return r.valor > 0 ? { valor: r.valor, modo: 'digitada' } : null;
}

/* O teto do mês: o "quanto quero gastar" digitado; sem ele, a soma dos limites.
   Com a soma dos limites, o gasto comparado é só o dessas categorias — somar o
   mês inteiro contra limites parciais acusaria um estouro que não existe. */
function tetoDoMes(chave, plano, porCat) {
  if (plano.gastoTotal > 0) {
    return { valor: plano.gastoTotal, origem: 'digitado', gasto: Object.values(porCat).reduce((s, v) => s + v, 0) };
  }
  const cats = Object.keys(plano.limites);
  if (!cats.length) return null;
  return {
    valor: cats.reduce((s, c) => s + plano.limites[c], 0),
    origem: 'limites',
    gasto: cats.reduce((s, c) => s + (porCat[c] || 0), 0),
    qtd: cats.length
  };
}

function corDoUso(pct, aviso) {
  return pct >= 100 ? 'var(--vermelho)' : pct >= aviso ? 'var(--amarelo)' : 'var(--verde)';
}

/* ---------- o card "Metas do mês" ---------- */
function mudarMesMetas(delta) {
  mesMetasOffset = Math.max(-MESES_PRA_TRAS_NAS_METAS, Math.min(MESES_A_FRENTE_NAS_METAS, mesMetasOffset + delta));
  renderizarMetasCategorias();
}

window.renderizarMetasCategorias = function () {
  const box = document.getElementById('planoDoMesBox');
  const lista = document.getElementById('listaMetasCategoria');
  if (!box || !lista) return;
  const chave = chaveMesDasMetas();
  const atual = chaveDoMesAtual();
  const plano = planoDoMes(chave);
  const porCat = gastoPorCategoriaNoOrcamento(chave);
  const teto = tetoDoMes(chave, plano, porCat);
  const renda = rendaDoMes(chave, plano);
  const aviso = plano.aviso;
  const tempo = chave === atual ? 'atual' : (chave < atual ? 'passado' : 'futuro');

  const navegar = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
      <button type="button" class="btn-mini" onclick="mudarMesMetas(-1)" aria-label="Mês anterior"${mesMetasOffset <= -MESES_PRA_TRAS_NAS_METAS ? ' disabled' : ''}>‹</button>
      <div style="text-align:center;line-height:1.2;">
        <strong style="font-size:13.5px;">${nomeDoMesPlano(chave).replace(/^./, s => s.toUpperCase())}</strong>
        <div style="font-size:10.5px;color:var(--texto-tenue);">${tempo === 'atual' ? 'mês atual' : tempo === 'passado' ? 'já fechou' : 'planejando à frente'}</div>
      </div>
      <button type="button" class="btn-mini" onclick="mudarMesMetas(1)" aria-label="Próximo mês"${mesMetasOffset >= MESES_A_FRENTE_NAS_METAS ? ' disabled' : ''}>›</button>
    </div>`;

  let orcamento = '';
  if (teto) {
    const pct = teto.valor > 0 ? (teto.gasto / teto.valor) * 100 : 0;
    const cor = corDoUso(pct, aviso);
    const sobra = teto.valor - teto.gasto;
    let rodape;
    if (tempo === 'atual') {
      const { dia, diasNoMes } = fracaoDoMes();
      const faltam = Math.max(1, diasNoMes - dia + 1);
      rodape = sobra >= 0
        ? `sobram <strong>${fmtOculto(sobra)}</strong> · ${fmtOculto(sobra / faltam)} por dia nos ${faltam === 1 ? 'último dia' : faltam + ' dias que faltam'}`
        : `<span style="color:var(--vermelho);">passou ${fmtOculto(-sobra)} do orçamento</span>`;
    } else if (tempo === 'passado') {
      rodape = sobra >= 0 ? `fechou ${fmtOculto(sobra)} abaixo do orçamento` : `<span style="color:var(--vermelho);">fechou ${fmtOculto(-sobra)} acima do orçamento</span>`;
    } else {
      rodape = 'o mês ainda não começou';
    }
    orcamento = `
      <div class="meta-item" style="cursor:pointer;" onclick="abrirPlanejarMes()">
        <div class="meta-item-topo">
          <div><strong>Orçamento</strong> <span> ${fmtOculto(teto.gasto)} de ${fmtOculto(teto.valor)}</span></div>
          <span style="color:${cor};font-weight:700;">${Math.round(pct)}%</span>
        </div>
        <div class="meta-barra"><div class="meta-barra-fill" style="width:${Math.min(100, pct)}%;background:${cor};"></div></div>
        <div style="font-size:11px;color:var(--texto-fraco);margin-top:6px;">${rodape}</div>
        ${teto.origem === 'limites' ? `<div style="font-size:10.5px;color:var(--texto-tenue);margin-top:2px;">teto = soma dos limites de ${teto.qtd} ${teto.qtd === 1 ? 'categoria' : 'categorias'}</div>` : ''}
      </div>`;
  }

  const linhaRenda = renda
    ? `<div class="linha-subtotal" style="cursor:pointer;margin:8px 2px 0;" onclick="abrirPlanejarMes()"><span>Renda do mês <span style="color:var(--texto-tenue);font-size:11px;">${renda.modo === 'receitas' ? '(somada das receitas)' : '(digitada)'}</span></span>`
      + `<strong style="color:var(--verde);">${renda.valor > 0 ? fmtOculto(renda.valor) : '<span style="color:var(--texto-tenue);font-weight:400;">aguardando</span>'}</strong></div>`
    : '';

  const vazio = !planoTemAlgo(plano)
    ? `<p style="font-size:12px;color:var(--texto-medio);line-height:1.5;margin-bottom:8px;">Nada planejado ${tempo === 'passado' ? 'para' : 'ainda para'} ${nomeDoMesPlano(chave)}. `
      + `Defina quanto quer gastar no mês e, se quiser, um limite por categoria. Tudo é opcional.</p>`
    : '';

  box.innerHTML = navegar + vazio + orcamento + linhaRenda
    + `<p style="font-size:10.5px;color:var(--texto-tenue);margin:8px 2px 0;line-height:1.45;">Gasto pela data da compra, já descontados os reembolsos. Aportes e consórcio ficam fora: contam como investimento.</p>`
    + `<div class="titulo-sem-meta" style="margin-top:14px;">limites por categoria</div>`;

  // Resumo de uma linha do card fechado
  const resumo = document.getElementById('resumoMetas');
  if (resumo) {
    const comLimite = Object.keys(plano.limites);
    const estouradas = comLimite.filter(c => (porCat[c] || 0) > plano.limites[c]);
    if (teto) {
      const pct = Math.round(teto.valor > 0 ? teto.gasto / teto.valor * 100 : 0);
      resumo.textContent = pct + '% do orçamento' + (estouradas.length ? ' · ' + estouradas.length + (estouradas.length === 1 ? ' estourou' : ' estouraram') : '');
      // uma categoria estourada pesa mais que o orçamento ainda folgado
      resumo.style.color = estouradas.length ? 'var(--vermelho)' : corDoUso(pct, aviso);
    } else if (comLimite.length) {
      resumo.textContent = estouradas.length
        ? estouradas.length + (estouradas.length === 1 ? ' estourou' : ' estouraram')
        : comLimite.length + (comLimite.length === 1 ? ' limite' : ' limites') + ' dentro do teto';
      resumo.style.color = estouradas.length ? 'var(--vermelho)' : 'var(--verde)';
    } else {
      resumo.textContent = 'nada planejado';
      resumo.style.color = 'var(--texto-medio)';
    }
  }

  // Lista: com limite primeiro, inteiros; sem limite no fim, apagados
  lista.innerHTML = '';
  const categoriasDoCard = obterCategoriasDespesas().filter(c => c !== 'Investimento');
  Object.keys(plano.limites).forEach(c => { if (!categoriasDoCard.includes(c)) categoriasDoCard.push(c); });
  const comLimite = categoriasDoCard.filter(c => plano.limites[c] > 0)
    .sort((a, b) => ((porCat[b] || 0) / plano.limites[b]) - ((porCat[a] || 0) / plano.limites[a]));
  const semLimite = categoriasDoCard.filter(c => !(plano.limites[c] > 0))
    .sort((a, b) => (porCat[b] || 0) - (porCat[a] || 0));

  comLimite.forEach(cat => {
    const gasto = porCat[cat] || 0;
    const limite = plano.limites[cat];
    const pct = (gasto / limite) * 100;
    const cor = corDoUso(pct, aviso);
    const resto = limite - gasto;
    const div = document.createElement('div');
    div.className = 'meta-item';
    div.dataset.categoria = cat;
    div.onclick = () => abrirEdicaoMeta(cat);
    div.innerHTML = `
      <div class="meta-item-topo">
        <div><strong>${cat}</strong><span> ${fmtOculto(gasto)} de ${fmtOculto(limite)}</span></div>
        <span style="color:${cor};font-weight:700;">${Math.round(pct)}%</span>
      </div>
      <div class="meta-barra"><div class="meta-barra-fill" style="width:${Math.min(100, pct)}%;background:${cor};"></div></div>
      <div style="font-size:10.5px;color:${resto >= 0 ? 'var(--texto-tenue)' : 'var(--vermelho)'};margin-top:4px;">${resto >= 0 ? 'faltam ' + fmtOculto(resto) : 'passou ' + fmtOculto(-resto)}</div>`;
    lista.appendChild(div);
  });

  if (semLimite.length) {
    if (comLimite.length) {
      const cab = document.createElement('div');
      cab.className = 'titulo-sem-meta';
      cab.textContent = 'sem limite';
      lista.appendChild(cab);
    }
    semLimite.forEach(cat => {
      const div = document.createElement('div');
      div.className = 'meta-item sem-meta';
      div.dataset.categoria = cat;
      div.onclick = () => abrirEdicaoMeta(cat);
      div.innerHTML = `
        <div class="meta-item-topo">
          <div><strong>${cat}</strong> <span>${fmtOculto(porCat[cat] || 0)} no mês</span></div>
          <span>definir</span>
        </div>`;
      lista.appendChild(div);
    });
  }
};

/* ---------- limite de uma categoria (o balão que já existia) ---------- */
window.abrirEdicaoMeta = function (categoria) {
  metaEditandoCategoria = categoria;
  const chave = chaveMesDasMetas();
  const atual = planoDoMes(chave).limites[categoria] || 0;
  document.getElementById('tituloEdicaoMeta').textContent = categoria + ' · ' + nomeDoMesPlano(chave);
  const inp = document.getElementById('inputEdicaoMeta');
  inp.value = atual > 0 ? atual : '';
  const dica = document.querySelector('#modalEdicaoMeta p');
  if (dica) {
    dica.textContent = chave < chaveDoMesAtual()
      ? `Vale só para ${nomeDoMesPlano(chave)}: os meses seguintes continuam como estão.`
      : `Vale para ${nomeDoMesPlano(chave)} e os próximos meses. Os meses que já passaram não mudam.`;
  }
  document.querySelector('#modalEdicaoMeta label').textContent = 'Limite no mês';
  document.querySelector('#modalEdicaoMeta .btn-salvar').textContent = 'Salvar limite';
  const btnTirar = document.getElementById('btnRemoverMeta');
  btnTirar.textContent = 'Tirar o limite';
  btnTirar.classList.toggle('escondido', !(atual > 0));
  document.getElementById('modalEdicaoMeta').classList.remove('escondido');
  setTimeout(() => inp.focus(), 120);
};

function gravarLimite(categoria, valor) {
  const chave = chaveMesDasMetas();
  const plano = planoDoMes(chave);
  if (valor > 0) plano.limites[categoria] = valor; else delete plano.limites[categoria];
  gravarPlanoDoMes(chave, plano);
  atualizarResumoEGraficos();
}

window.confirmarEdicaoMeta = function () {
  if (!metaEditandoCategoria) return;
  gravarLimite(metaEditandoCategoria, Number(document.getElementById('inputEdicaoMeta').value) || 0);
  fecharModal('modalEdicaoMeta');
  metaEditandoCategoria = null;
};

window.removerMetaEditando = function () {
  if (!metaEditandoCategoria) return;
  gravarLimite(metaEditandoCategoria, 0);
  fecharModal('modalEdicaoMeta');
  metaEditandoCategoria = null;
};

/* ---------- janela "Planejar o mês" ---------- */
let modoRendaPlano = 'nenhuma';

document.body.insertAdjacentHTML('beforeend', `
  <div id="modalPlanejarMes" class="modal-overlay escondido" onclick="if(event.target===this) fecharModal('modalPlanejarMes')">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="tituloPlanejarMes">Planejar o mês</h3>
        <button class="btn-fechar" onclick="fecharModal('modalPlanejarMes')">&times;</button>
      </div>
      <div class="form-group">
        <label>Renda do mês</label>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;" id="modosRendaPlano">
          <button type="button" class="btn-periodo" data-modo="nenhuma" onclick="setModoRendaPlano('nenhuma')">Não usar</button>
          <button type="button" class="btn-periodo" data-modo="digitada" onclick="setModoRendaPlano('digitada')">Digitar</button>
          <button type="button" class="btn-periodo" data-modo="receitas" onclick="setModoRendaPlano('receitas')">Somar receitas</button>
        </div>
      </div>
      <div class="form-group escondido" id="wrapRendaDigitada">
        <label for="planoRendaValor">Quanto entra no mês</label>
        <input type="text" id="planoRendaValor" inputmode="numeric" placeholder="R$ 0,00" oninput="mascaraMoeda(this); previaPlanoMes();">
      </div>
      <p id="dicaRendaReceitas" class="escondido" style="font-size:11.5px;color:var(--texto-fraco);line-height:1.45;margin:-4px 0 14px;"></p>
      <div class="form-group">
        <label for="planoGastoTotal">Quanto quero gastar no mês <span style="color:var(--texto-tenue);">(opcional)</span></label>
        <input type="text" id="planoGastoTotal" inputmode="numeric" placeholder="R$ 0,00" oninput="mascaraMoeda(this); previaPlanoMes();">
      </div>
      <div class="form-group">
        <label for="planoAviso">Avisar quando chegar em</label>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="number" id="planoAviso" min="1" max="100" step="1" inputmode="numeric" style="width:90px;" oninput="previaPlanoMes()">
          <span style="font-size:13px;color:var(--texto-medio);">% do limite</span>
        </div>
      </div>
      <p id="previaPlanoMes" style="font-size:11.5px;line-height:1.45;color:var(--texto-fraco);margin-bottom:12px;"></p>
      <button type="button" class="btn-salvar" style="margin-top:0;" onclick="salvarPlanoMes()">Salvar</button>
    </div>
  </div>`);

function abrirPlanejarMes() {
  const chave = chaveMesDasMetas();
  const plano = planoDoMes(chave);
  document.getElementById('tituloPlanejarMes').textContent = 'Planejar ' + nomeDoMesPlano(chave);
  const r = plano.renda;
  document.getElementById('planoRendaValor').value = r && r.modo === 'digitada' && r.valor > 0 ? fmtVal(r.valor) : '';
  document.getElementById('planoGastoTotal').value = plano.gastoTotal > 0 ? fmtVal(plano.gastoTotal) : '';
  document.getElementById('planoAviso').value = plano.aviso;
  setModoRendaPlano(r ? r.modo : 'nenhuma');
  document.getElementById('modalPlanejarMes').classList.remove('escondido');
}

function setModoRendaPlano(modo) {
  modoRendaPlano = ['digitada', 'receitas'].includes(modo) ? modo : 'nenhuma';
  document.querySelectorAll('#modosRendaPlano .btn-periodo').forEach(b => b.classList.toggle('ativo', b.dataset.modo === modoRendaPlano));
  document.getElementById('wrapRendaDigitada').classList.toggle('escondido', modoRendaPlano !== 'digitada');
  const dica = document.getElementById('dicaRendaReceitas');
  dica.classList.toggle('escondido', modoRendaPlano !== 'receitas');
  if (modoRendaPlano === 'receitas') {
    const chave = chaveMesDasMetas();
    dica.innerHTML = `Soma as receitas de ${nomeDoMesPlano(chave)}, menos reembolsos, empréstimos e estornos. `
      + `Até agora: <strong>${fmtVal(rendaSomadaDasReceitas(chave))}</strong>.`;
  }
  previaPlanoMes();
}

function lerPlanoDaJanela() {
  const chave = chaveMesDasMetas();
  const plano = planoDoMes(chave);
  const valorRenda = lerDinheiro('planoRendaValor');
  if (modoRendaPlano === 'digitada' && !(valorRenda > 0)) return { erro: 'Digite quanto entra no mês, ou escolha outra opção de renda.' };
  plano.renda = modoRendaPlano === 'digitada' ? { modo: 'digitada', valor: valorRenda }
    : modoRendaPlano === 'receitas' ? { modo: 'receitas' } : null;
  plano.gastoTotal = lerDinheiro('planoGastoTotal') || null;
  const aviso = parseInt(document.getElementById('planoAviso').value, 10);
  if (!(aviso >= 1 && aviso <= 100)) return { erro: 'O aviso vai de 1% a 100%.' };
  plano.aviso = aviso;
  return { chave, plano };
}

function previaPlanoMes() {
  const el = document.getElementById('previaPlanoMes');
  const r = lerPlanoDaJanela();
  if (r.erro) { el.style.color = 'var(--amarelo)'; el.textContent = r.erro; return; }
  el.style.color = 'var(--texto-fraco)';
  const somaLimites = Object.values(r.plano.limites).reduce((s, v) => s + v, 0);
  const partes = [];
  partes.push(r.chave < chaveDoMesAtual()
    ? `Vale só para ${nomeDoMesPlano(r.chave)}: os meses seguintes continuam como estão.`
    : `Vale para ${nomeDoMesPlano(r.chave)} e os próximos meses. Os meses que já passaram não mudam.`);
  if (!r.plano.gastoTotal) {
    partes.push(somaLimites > 0
      ? `Sem valor aqui, o teto do mês é a soma dos limites por categoria (${fmtVal(somaLimites)}).`
      : 'Sem valor aqui e sem limites por categoria, o card não mostra orçamento.');
  }
  el.innerHTML = partes.join('<br>');
}

function salvarPlanoMes() {
  const r = lerPlanoDaJanela();
  if (r.erro) { previaPlanoMes(); return; }
  gravarPlanoDoMes(r.chave, r.plano);
  fecharModal('modalPlanejarMes');
  atualizarResumoEGraficos();
}

/* ---------- "Quanto posso gastar" passa a usar o orçamento ---------- */
const quantoPossoGastarSemOrcamento = window.quantoPossoGastar;
window.quantoPossoGastar = function () {
  const chave = chaveDoMesAtual();
  const plano = planoDoMes(chave);
  const teto = tetoDoMes(chave, plano, gastoPorCategoriaNoOrcamento(chave));
  if (!teto) return quantoPossoGastarSemOrcamento();
  const { dia, diasNoMes } = fracaoDoMes();
  const faltam = Math.max(1, diasNoMes - dia + 1);
  const sobra = teto.valor - teto.gasto;
  const fonte = teto.origem === 'digitado'
    ? 'seu orçamento do mês é'
    : `seus limites de ${teto.qtd} ${teto.qtd === 1 ? 'categoria' : 'categorias'} somam`;
  const regra = '<br><span style="color:var(--texto-fraco);">Aportes e consórcio ficam fora; reembolsos já descontados.</span>';
  if (sobra <= 0) {
    return `Gastou ${fmtOculto(teto.gasto)} e ${fonte} ${fmtOculto(teto.valor)}.<br>`
      + `<span style="color:var(--vermelho);">Estourou em ${fmtOculto(-sobra)}</span>, e ainda ${faltam === 1 ? 'falta 1 dia' : 'faltam ' + faltam + ' dias'} de mês.${regra}`;
  }
  return `Gastou ${fmtOculto(teto.gasto)} de ${fmtOculto(teto.valor)} (${fonte} isso).<br>`
    + `Sobram <b>${fmtOculto(sobra)}</b> pra ${faltam === 1 ? 'o último dia' : faltam + ' dias'} — `
    + `dá <b>${fmtOculto(sobra / faltam)}</b> por dia.${regra}`;
};

/* ---------- backup e renomear categoria (ganchos do gerar-lab.js) ---------- */
window.labAoExportar = function (payload) { payload.planejamento = planejamento; };

window.labAoImportar = function (data) {
  planejamento = data && data.planejamento && Array.isArray(data.planejamento.vigencias)
    ? data.planejamento
    : planejamentoInicial(data && data.orcamentosCategoria);
  ordenarVigencias();
  salvarPlanejamento();
};

window.labAoRenomearCategoria = function (antigo, novo) {
  let mudou = false;
  planejamento.vigencias.forEach(v => {
    if (v.limites && v.limites[antigo] !== undefined) {
      v.limites[novo] = v.limites[antigo];
      delete v.limites[antigo];
      mudou = true;
    }
  });
  if (mudou) salvarPlanejamento();
};

/* ---------- montagem ---------- */
(function iniciarFase1() {
  carregarPlanejamento();
  espelharLimitesDoMesAtual();
  const card = document.querySelector('[data-card="metas"]');
  if (!card) return;
  card.dataset.cardTitulo = 'Metas do mês';
  const titulo = card.querySelector('h3');
  if (titulo) titulo.textContent = 'Metas do mês';
  const corpo = document.getElementById('corpo-metas');
  const explicacaoAntiga = corpo.querySelector('p');
  if (explicacaoAntiga) explicacaoAntiga.remove();
  corpo.insertAdjacentHTML('afterbegin', '<div id="planoDoMesBox"></div>');
  corpo.insertAdjacentHTML('beforeend',
    '<button type="button" class="btn-backup" id="btnPlanejarMes" style="margin-top:12px;" onclick="abrirPlanejarMes()">Planejar o mês</button>');
  equiparCamposComCalculadora(document.getElementById('modalPlanejarMes'));
  if (typeof renderizarOrdemCards === 'function') renderizarOrdemCards('abaGraficos');
  renderizarMetasCategorias();
})();
