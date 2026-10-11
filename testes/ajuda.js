/* BASE DOS TESTES DO APP
   Cada suíte (testes/NN-nome.js) chama iniciar(nome, async t => {...}). Esta
   base sobe um servidor local que serve o repositório em /MeuFinanceiro-/ (o
   mesmo caminho do GitHub Pages), abre o Chromium do Playwright e entrega um
   objeto `t` com o que toda suíte usa:

     t.abrir()         abre o app com o armazenamento limpo e devolve a página
     t.recarregar(p)   recarrega e espera o app montar
     t.ok(cond, msg)   uma verificação (✔ ou ✘)
     t.secao(titulo)   separador no relatório
     t.foto(p, nome, seletor?)  foto em testes/fotos/

   Dentro da página ficam três ajudas pra datas relativas a HOJE (os testes
   rodam em qualquer dia do mês):
     __dia(n)          hoje + n dias, 'AAAA-MM-DD'
     __mes(k, dia)     o dia `dia` do mês atual + k, 'AAAA-MM-DD'
     __chaveMes(k)     'AAAA-MM' do mês atual + k

   Erros de JavaScript da página contam como falha. Confirmações (confirm)
   são aceitas sozinhas; prompt devolve o que estiver em window.__resposta. */
const path = require('path');
const fs = require('fs');
const http = require('http');

function carregarPlaywright() {
  const candidatos = [process.env.PLAYWRIGHT, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
  for (const c of candidatos) {
    try { return require(c); } catch (e) { /* tenta o próximo */ }
  }
  throw new Error('Playwright não encontrado: rode "npm i playwright" ou aponte a variável PLAYWRIGHT para a pasta dele.');
}

const RAIZ = path.join(__dirname, '..');
const FOTOS = path.join(__dirname, 'fotos');

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.pdf': 'application/pdf', '.css': 'text/css'
};

function servir() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/MeuFinanceiro-/, '');
      const arq = path.join(RAIZ, caminho.endsWith('/') ? caminho + 'index.html' : caminho);
      if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { resp.writeHead(404); resp.end(); return; }
      resp.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
      fs.createReadStream(arq).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

// Roda dentro da página, antes do app: as ajudas de data e a resposta dos prompts
function ajudasDaPagina() {
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  window.__dia = n => { const x = new Date(obterDataBrasilia() + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x); };
  window.__mes = (k, dia) => {
    const h = obterDataBrasilia();
    const d = new Date(parseInt(h.slice(0, 4), 10), parseInt(h.slice(5, 7), 10) - 1 + k, 1);
    return iso(d).slice(0, 8) + String(dia || 1).padStart(2, '0');
  };
  window.__chaveMes = k => window.__mes(k, 1).slice(0, 7);
  window.__resposta = null;
  window.prompt = () => window.__resposta;

  // Grava um cenário direto nas gavetas (depois, t.recarregar pra o app montar)
  window.__semear = d => {
    if (d.contas) { contas = d.contas; salvarContas(); }
    if (d.lancamentos) { lancamentos = d.lancamentos; salvarLocalStorage(); }
    if (d.fixos) { fixos = d.fixos; salvarFixos(); }
    if (d.investimentos) { investimentos = d.investimentos; salvarInvest(); }
    if (d.consorcios) { consorcios = d.consorcios; salvarConsorcios(); }
    if (d.grupos) { grupos = d.grupos; salvarGrupos(); }
    if (d.transferencias) { transferencias = d.transferencias; salvarTransferencias(); }
    if (d.contatos) { contatos = d.contatos; salvarContatos(); }
    if (d.metas) { orcamentosCategoria = d.metas; salvarOrcamentos(); }   // metas do jeito antigo: viram o plano ao recarregar
    if (d.planejamento) { planejamento = d.planejamento; salvarPlanejamento(); }
    if (d.faturasPagas) { faturasPagas = d.faturasPagas; salvarFaturasPagas(); }
  };

  // Lança pelo formulário de verdade, como a pessoa faria (sem a janela de confirmar)
  window.__lancar = o => {
    alternarTipo(o.tipo || 'despesa');
    document.getElementById('descricao').value = o.descricao || '';
    document.getElementById('valor').value = 'R$ ' + o.valor;
    if (o.conta) document.getElementById('conta').value = o.conta;
    atualizarVisibilidadeForma();
    if (o.categoria) { document.getElementById('categoria').value = o.categoria; atualizarDestinoInvestimento(); }
    if (o.forma) { document.getElementById('formaModo').value = o.forma; verificarParcelamento(o.forma); }
    if (o.parcelas) document.getElementById('numParcelas').value = String(o.parcelas);
    document.getElementById('dataCompra').value = o.data || obterDataBrasilia();
    if (o.destino) escolherDestinoInvestimento(o.destino);
    executarSalvarLancamento(parseVal(o.valor));
  };

  window.__aba = id => {
    const bt = [...document.querySelectorAll('.nav-tab')].find(x => (x.getAttribute('onclick') || '').includes(id));
    mudarAba(id, bt);
  };
  window.__texto = sel => { const el = document.querySelector(sel); return el ? el.innerText.replace(/\s+/g, ' ').trim() : ''; };
}

async function iniciar(nome, corpo) {
  const { chromium } = carregarPlaywright();
  const srv = await servir();
  const BASE = `http://127.0.0.1:${srv.address().port}/MeuFinanceiro-/`;
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  await contexto.addInitScript(ajudasDaPagina);
  const erros = [];
  let falhas = 0, verificacoes = 0;

  const t = {
    BASE,
    ok(cond, msg) {
      verificacoes++;
      console.log((cond ? '  ✔ ' : '  ✘ FALHOU: ') + msg);
      if (!cond) falhas++;
      return !!cond;
    },
    secao(titulo) { console.log('\n┌─ ' + titulo + ' ─┐'); },
    async abrir(caminho = 'index.html') {
      const p = await contexto.newPage();
      p.on('pageerror', e => erros.push(e.message));
      p.on('dialog', d => d.accept());
      await p.goto(BASE + caminho);
      await p.waitForTimeout(700);
      await p.evaluate(() => localStorage.clear());
      await t.recarregar(p);
      return p;
    },
    async recarregar(p) {
      await p.reload();
      await p.waitForFunction(() => typeof atualizarTudo === 'function' && document.getElementById('versaoApp')
        && !/—/.test(document.getElementById('versaoApp').textContent));
      await p.waitForTimeout(300);
    },
    async foto(p, nomeArquivo, seletor) {
      fs.mkdirSync(FOTOS, { recursive: true });
      const alvo = seletor ? await p.$(seletor) : null;
      const destino = path.join(FOTOS, nomeArquivo);
      if (alvo) await alvo.screenshot({ path: destino });
      else await p.screenshot({ path: destino, fullPage: true });
    }
  };

  console.log('════════ ' + nome + ' ════════');
  try {
    await corpo(t);
  } catch (e) {
    falhas++;
    console.log('  ✘ ERRO NO TESTE: ' + (e && e.stack || e));
  }
  if (erros.length) {
    falhas++;
    console.log('\nerros de js:', erros);
  } else {
    console.log('\nerros de js: nenhum');
  }
  console.log(falhas ? `\n✘ ${falhas} FALHA(S) em ${verificacoes} verificações` : `\n✔ tudo certo (${verificacoes} verificações)`);
  await navegador.close();
  srv.close();
  process.exit(falhas ? 1 : 0);
}

module.exports = { iniciar, RAIZ, FOTOS };
