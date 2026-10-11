#!/usr/bin/env node
/* RODA A SUÍTE INTEIRA
       node testes/rodar-todos.js            todas as suítes
       node testes/rodar-todos.js 03 05      só as que começam com 03 e 05

   Cada suíte roda num processo próprio (armazenamento limpo, sem herdar nada
   da anterior). No fim sai um resumo, e o código de saída é 1 se alguma
   falhou — dá pra usar antes de abrir um PR. A saída completa de cada suíte
   fica em testes/fotos/ultima-rodada.txt. */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const filtros = process.argv.slice(2);

const suites = fs.readdirSync(__dirname)
  .filter(f => /^\d\d-.*\.js$/.test(f))
  .sort()
  .map(f => ({ nome: f.replace(/\.js$/, ''), arquivo: path.join(__dirname, f) }));

const escolhidas = filtros.length ? suites.filter(s => filtros.some(f => s.nome.startsWith(f))) : suites;
if (!escolhidas.length) { console.log('Nenhuma suíte bate com', filtros.join(' ')); process.exit(1); }

fs.mkdirSync(path.join(__dirname, 'fotos'), { recursive: true });
const log = [];
const resultado = [];
for (const s of escolhidas) {
  const inicio = Date.now();
  process.stdout.write(`${s.nome.padEnd(32, ' ')} `);
  const r = spawnSync(process.execPath, [s.arquivo], { cwd: RAIZ, encoding: 'utf8', timeout: 10 * 60 * 1000 });
  const saida = (r.stdout || '') + (r.stderr || '');
  log.push('\n\n' + saida);
  const passou = r.status === 0;
  const qtd = (saida.match(/^ +✔ /gm) || []).length;   // só as verificações (com recuo), não o "tudo certo" do fim
  const falhas = saida.split('\n').filter(l => /✘/.test(l));
  resultado.push({ nome: s.nome, passou, falhas });
  console.log(`${passou ? '✔' : '✘'} ${String(qtd).padStart(3, ' ')} ok   ${((Date.now() - inicio) / 1000).toFixed(0)}s`);
  if (!passou) falhas.slice(0, 8).forEach(l => console.log('      ' + l.trim()));
}
fs.writeFileSync(path.join(__dirname, 'fotos', 'ultima-rodada.txt'), log.join(''));

const ruins = resultado.filter(r => !r.passou);
console.log(ruins.length
  ? `\n✘ ${ruins.length} de ${resultado.length} suítes falharam: ${ruins.map(r => r.nome).join(', ')}`
  : `\n✔ ${resultado.length} suítes, nenhuma falha`);
process.exit(ruins.length ? 1 : 0);
