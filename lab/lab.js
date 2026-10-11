/* LABORATÓRIO — infraestrutura
   Carrega depois do script do app (ver gerar-lab.js). Cuida de três coisas:
   1. a cópia dos dados do app de verdade pra cá — sempre num sentido só;
   2. o service worker e o cache do laboratório, sem encostar nos do app;
   3. a versão mostrada em Ajustes.

   As gavetas do app de verdade são lidas SÓ em gavetasDoAppPrincipal() e na
   cópia, e nunca são gravadas nem apagadas. */
const PREFIXO_GAVETAS = 'meu_financeiro_lab_';
const LAB_VERSAO = 'lab-2026.10.11-1';   // muda junto com VERSAO em lab/sw.js

// Lembretes e notificações do laboratório começam desligados: copiar a
// escolha de lá faria o celular avisar a mesma cobrança duas vezes.
const GAVETAS_QUE_NAO_VEM = [
  'meu_financeiro_lembretes', 'meu_financeiro_lembrete_dias',
  'meu_financeiro_ultimo_aviso', 'meu_financeiro_ultimo_aviso_boleto'
];
const CHAVE_COPIADO_EM = PREFIXO_GAVETAS + 'copiado_em';
const CHAVE_OFERTA_VISTA = PREFIXO_GAVETAS + 'oferta_vista';

function gavetasDoAppPrincipal() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k === 'valoresOcultos' || (k.startsWith('meu_financeiro_') && !k.startsWith(PREFIXO_GAVETAS))) out.push(k);
  }
  return out;
}

function gavetasDoLaboratorio() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIXO_GAVETAS)) out.push(k);
  }
  return out;
}

function gavetaNoLaboratorio(k) {
  return k === 'valoresOcultos' ? PREFIXO_GAVETAS + 'valoresOcultos' : PREFIXO_GAVETAS + k.slice('meu_financeiro_'.length);
}

function resumoDoAppPrincipal() {
  let lancamentosLa = 0;
  try { lancamentosLa = (JSON.parse(localStorage.getItem('meu_financeiro_v1')) || []).length; } catch (e) { /* gaveta estragada: conta zero */ }
  return { lancamentos: lancamentosLa, gavetas: gavetasDoAppPrincipal().length };
}

/* Apaga o que o laboratório tinha e traz uma cópia de tudo que o app de
   verdade guarda neste navegador. Devolve quantas gavetas vieram. */
function copiarDadosDoAppPrincipal() {
  const origem = gavetasDoAppPrincipal().filter(k => !GAVETAS_QUE_NAO_VEM.includes(k));
  gavetasDoLaboratorio().filter(k => k !== CHAVE_OFERTA_VISTA).forEach(k => localStorage.removeItem(k));
  origem.forEach(k => localStorage.setItem(gavetaNoLaboratorio(k), localStorage.getItem(k)));
  localStorage.setItem(CHAVE_COPIADO_EM, new Date().toISOString());
  localStorage.setItem(CHAVE_OFERTA_VISTA, '1');
  return origem.length;
}

document.body.insertAdjacentHTML('beforeend', `
  <div id="modalCopiaApp" class="modal-overlay escondido" onclick="if(event.target===this) fecharCopiaDoApp()">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Copiar meus dados do app</h3>
        <button class="btn-fechar" onclick="fecharCopiaDoApp()">&times;</button>
      </div>
      <p style="font-size:13px;color:var(--texto-medio);line-height:1.5;margin-bottom:12px;">
        O laboratório guarda tudo separado do Meu Financeiro de verdade. Este botão traz pra cá uma
        cópia dos seus dados de lá: lançamentos, contas, cartões, gastos fixos, investimentos e metas.
      </p>
      <div class="box-resumo-modal" id="resumoCopiaApp" style="margin-bottom:12px;"></div>
      <ul style="font-size:12px;color:var(--texto-medio);line-height:1.5;margin:0 0 14px 18px;">
        <li>O app de verdade não muda: a cópia só vai de lá pra cá.</li>
        <li>O que você fez aqui no laboratório é trocado pela cópia.</li>
        <li>Lembretes e notificações ficam desligados aqui.</li>
      </ul>
      <div style="display:flex;gap:10px;">
        <button type="button" class="btn-cancelar" id="btnCopiaCancelar" style="flex:1;margin:0;" onclick="fecharCopiaDoApp()">Agora não</button>
        <button type="button" class="btn-salvar" id="btnCopiaConfirmar" style="flex:1;margin:0;" onclick="confirmarCopiaDoApp()">Copiar agora</button>
      </div>
    </div>
  </div>`);

function abrirCopiaDoApp(primeiraVez) {
  const r = resumoDoAppPrincipal();
  const copiadoEm = localStorage.getItem(CHAVE_COPIADO_EM);
  const quando = copiadoEm
    ? new Date(copiadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'nenhuma ainda';
  document.getElementById('resumoCopiaApp').innerHTML = r.gavetas
    ? `<div class="linha-subtotal" style="cursor:default;"><span>No app de verdade</span><strong>${r.lancamentos.toLocaleString('pt-BR')} lançamentos</strong></div>`
      + `<div class="linha-subtotal" style="cursor:default;margin-bottom:0;"><span>Última cópia</span><strong>${quando}</strong></div>`
    : `<p style="font-size:12.5px;color:var(--amarelo);line-height:1.5;margin:0;">Não achei dados do app de verdade neste navegador. `
      + `O laboratório só enxerga o app aberto no mesmo navegador. Outro caminho: exporte um backup lá e importe aqui, em Ajustes.</p>`;
  const btn = document.getElementById('btnCopiaConfirmar');
  btn.disabled = !r.gavetas;
  btn.style.opacity = r.gavetas ? '' : '.5';
  document.getElementById('btnCopiaCancelar').textContent = primeiraVez ? 'Começar vazio' : 'Agora não';
  document.getElementById('modalCopiaApp').classList.remove('escondido');
}

function fecharCopiaDoApp() {
  localStorage.setItem(CHAVE_OFERTA_VISTA, '1');
  fecharModal('modalCopiaApp');
}

function confirmarCopiaDoApp() {
  if (!resumoDoAppPrincipal().gavetas) return;
  copiarDadosDoAppPrincipal();
  location.reload();
}

// Botão de emergência, versão do laboratório: só o cache e o service worker
// DAQUI. O original apagava tudo do endereço — inclusive o do app de verdade.
window.forcarAtualizacao = async function () {
  try {
    if (window.caches) {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter(n => n.startsWith('meu-financeiro-lab-')).map(n => caches.delete(n)));
    }
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.filter(r => /\/lab\/$/.test(r.scope)).map(r => r.unregister()));
    }
  } catch (e) { /* segue e recarrega mesmo assim */ }
  location.reload(true);
};

(function iniciarLaboratorio() {
  const elVersao = document.getElementById('versaoApp');
  if (elVersao) elVersao.textContent = 'laboratório ' + LAB_VERSAO + ' · base ' + APP_VERSION;
  // Primeira visita: oferece trazer os dados (uma vez só; depois, pela faixa)
  if (!localStorage.getItem(CHAVE_COPIADO_EM) && !localStorage.getItem(CHAVE_OFERTA_VISTA)) {
    abrirCopiaDoApp(true);
  }
})();
