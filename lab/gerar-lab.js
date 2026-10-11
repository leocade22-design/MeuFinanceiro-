#!/usr/bin/env node
/* GERADOR DO LABORATÓRIO
   O laboratório é uma cópia do app principal, publicada em /lab/, onde as
   ideias novas são testadas sem encostar no app de verdade. Este script monta
   lab/index.html a partir do ../index.html atual — rode de novo sempre que o
   app principal mudar, e o laboratório acompanha:

       node lab/gerar-lab.js
       node lab/gerar-lab.js --verificar   (só confere, sem gravar)

   O que muda na cópia:
   - GAVETAS: todo nome de gaveta do localStorage ganha o prefixo
     meu_financeiro_lab_. Os sites do GitHub Pages do Leo dividem o mesmo
     armazenamento no navegador; sem isto o laboratório leria e gravaria os
     dados reais.
   - Título, faixa LAB no topo, nome do arquivo de backup.
   - Três ganchos (exportar, importar e renomear categoria) que o código das
     fases usa pra guardar o planejamento junto com o resto.
   - No fim da página entram lab.js (a infraestrutura do laboratório) e o
     código de cada fase.

   Se o app principal mudar a ponto de um trecho esperado sumir, o script para
   com erro em vez de gerar uma cópia pela metade. */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ORIGEM = path.join(RAIZ, 'index.html');
const DESTINO = path.join(__dirname, 'index.html');

// código das fases, na ordem em que carregam (depois de lab.js)
const FASES = ['fase1-planejamento.js'];

let html = fs.readFileSync(ORIGEM, 'utf8');

function trocar(descricao, de, para, minimo = 1, maximo = Infinity) {
  const partes = html.split(de);
  const qtd = partes.length - 1;
  if (qtd < minimo || qtd > maximo) {
    throw new Error(`${descricao}: esperava ${minimo}${maximo === Infinity ? '+' : '–' + maximo} ocorrência(s) de ${JSON.stringify(de)}, achei ${qtd}`);
  }
  html = partes.join(para);
  return qtd;
}

const versaoBase = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
if (!versaoBase) throw new Error('não achei APP_VERSION no index.html principal');

// 1) gavetas separadas — o prefixo vem sempre entre aspas no app
const qtdDupla = trocar('gavetas (aspas duplas)', '"meu_financeiro_', '"meu_financeiro_lab_');
const qtdSimples = trocar('gavetas (aspas simples)', "'meu_financeiro_", "'meu_financeiro_lab_");
const qtdOlho = trocar('gaveta do olho', "'valoresOcultos'", "'meu_financeiro_lab_valoresOcultos'");
if (/meu_financeiro_(?!lab_)/.test(html)) throw new Error('sobrou nome de gaveta sem o prefixo do laboratório');
if (/localStorage\.(getItem|setItem|removeItem)\('(?!meu_financeiro_lab_)/.test(html)) {
  throw new Error('há gaveta com nome literal fora do padrão: confira antes de publicar');
}

// 2) cara de laboratório
trocar('título', '<title>Meu Financeiro</title>', '<title>Meu Financeiro LAB</title>', 1, 1);
trocar('faixa LAB', '<div class="app-container">', `<div class="app-container">
    <!-- LAB: faixa fixa no topo, pra ninguém lançar gasto de verdade aqui -->
    <div id="faixaLab" style="display:flex;align-items:center;gap:8px;background:#6d28d9;color:#fff;border-radius:10px;padding:7px 10px;margin-bottom:10px;font-size:11.5px;line-height:1.3;">
      <strong style="letter-spacing:.6px;">LABORATÓRIO</strong>
      <span style="opacity:.9;flex:1;min-width:0;">testes à parte · não mexe no app de verdade</span>
      <button type="button" onclick="abrirCopiaDoApp()" style="background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:4px 9px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">copiar dados</button>
    </div>`, 1, 1);
trocar('nome do backup', 'backup-meu-financeiro-', 'backup-meu-financeiro-LAB-', 1, 1);
trocar('título do backup', "'Backup do MeuFinanceiro'", "'Backup do MeuFinanceiro LAB'", 1, 2);

// 3) ganchos que o código das fases usa
trocar('gancho: exportar', `        correcoesSaldo
      };
`, `        correcoesSaldo
      };
      if (window.labAoExportar) window.labAoExportar(payload);   // LAB
`, 1, 1);
trocar('gancho: importar', `correcoesSaldo = Array.isArray(data.correcoesSaldo) ? data.correcoesSaldo : [];
`, `correcoesSaldo = Array.isArray(data.correcoesSaldo) ? data.correcoesSaldo : [];
          if (window.labAoImportar) window.labAoImportar(data);   // LAB
`, 1, 1);
trocar('gancho: renomear categoria', `          if (orcamentosCategoria[nomeAntigo] !== undefined) {
`, `          if (window.labAoRenomearCategoria) window.labAoRenomearCategoria(nomeAntigo, nome);   // LAB
          if (orcamentosCategoria[nomeAntigo] !== undefined) {
`, 1, 1);

// 4) infraestrutura do laboratório e código das fases, depois do script do app
trocar('scripts do laboratório', '</body>', `  <!-- LAB: infraestrutura do laboratório e código das fases -->
  <script src="lab.js"></script>
${FASES.map(f => `  <script src="${f}"></script>`).join('\n')}
</body>`, 1, 1);

html = html.replace('<!DOCTYPE html>', `<!DOCTYPE html>
<!-- LABORATÓRIO — gerado por lab/gerar-lab.js a partir do index.html principal
     (versão ${versaoBase}). Não edite este arquivo à mão: mude o gerador, o
     lab.js ou o código das fases e rode o gerador de novo. -->`);

// --verificar: não grava nada, só diz se o lab/index.html está em dia com o app
if (process.argv.includes('--verificar')) {
  const atual = fs.existsSync(DESTINO) ? fs.readFileSync(DESTINO, 'utf8') : '';
  if (atual === html) { console.log(`lab/index.html em dia com a versão ${versaoBase} do app.`); process.exit(0); }
  console.log(`lab/index.html desatualizado: o app principal mudou (versão ${versaoBase}). Rode node lab/gerar-lab.js.`);
  process.exit(1);
}

fs.writeFileSync(DESTINO, html);
console.log(`lab/index.html gerado a partir da versão ${versaoBase}: ` +
  `${qtdDupla + qtdSimples} nomes de gaveta com prefixo de laboratório, ${qtdOlho} do olho.`);
