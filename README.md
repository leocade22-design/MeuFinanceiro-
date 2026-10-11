# MeuFinanceiro

Controle financeiro pessoal que roda no navegador, sem servidor e sem conta.
É um app de arquivo único: todo o código está em `index.html`.

**No ar em:** https://leocade22-design.github.io/MeuFinanceiro-/

## Onde ficam os dados

No `localStorage` do próprio aparelho. Não sobem pra lugar nenhum, e por isso
**não passam de um celular pro outro**. Trocar de aparelho, limpar os dados do
site ou desinstalar o app apaga tudo.

Antes de mexer em qualquer coisa, exporte um backup: aba **Faturas** →
*Backup e restauração* → *Exportar backup*.

> Em "Limpar armazenamento"/"Limpar dados" nas configurações do Android, os
> lançamentos são apagados. "Limpar cache" é seguro — só remove os arquivos
> guardados do app.

## Publicar uma versão nova

A publicação é feita por `.github/workflows/pages.yml`, disparado a cada push na
`main`. Dá pra publicar na mão também: aba **Actions** → *Publicar no GitHub
Pages* → *Run workflow*, sem precisar de commit novo.

> O Pages precisa estar em *Settings → Pages → Source: GitHub Actions*. No modo
> antigo ("Deploy from a branch") a GitHub gera o próprio workflow e ignora este
> arquivo — inclusive o limite de tempo maior que ele define.

**Ao publicar, mude a versão nos dois arquivos, juntos:**

| Arquivo      | Constante     |
|--------------|---------------|
| `sw.js`      | `VERSAO`      |
| `index.html` | `APP_VERSION` |

É a mudança do conteúdo de `sw.js` que faz o navegador perceber que existe
versão nova e reinstalar o service worker. Sem isso, o app instalado na tela
inicial continua rodando a versão antiga indefinidamente.

A versão em uso aparece no rodapé do card *Backup e restauração*, e o botão
"buscar atualização" ali do lado limpa o cache e recarrega (sem tocar nos
lançamentos).

### Quando o deploy falha

O erro que já apareceu várias vezes: o build passa e o deploy fica preso em
`deployment_queued` ou `deployment_in_progress` até estourar o tempo. É fila da
própria GitHub, não erro do código — o site continua no ar com a versão
anterior, e a página de status geral pode seguir verde, porque fila lenta num
repositório não conta como incidente.

O workflow define `timeout: 1800000` (30 min) no passo de publicar justamente
por isso: o padrão de 10 minutos cancelava publicações que estavam a caminho.
Se ainda assim falhar, use *Run workflow* pela aba Actions para tentar de novo
sem precisar de um commit.

## Testar localmente

Abrir o `index.html` direto pelo arquivo funciona pra quase tudo, mas o service
worker exige HTTP:

```
python3 -m http.server 8099
```

Vale lembrar que esse servidor não manda `Cache-Control`, então ele não
reproduz o cenário de cache que o Pages cria. Pra testar atualização do app
instalado, é preciso um servidor que envie `Cache-Control: max-age=600`.

## Testes automáticos

```
node testes/rodar-todos.js          # tudo (uns 40 segundos)
node testes/rodar-todos.js 03 lab   # só as suítes que começam com 03 e o laboratório
```

Os testes abrem o app de verdade num Chromium sem janela (Playwright), num
servidor local que imita o caminho do GitHub Pages, e mexem nele como a
pessoa mexeria. Cada suíte começa com o armazenamento limpo, e as datas são
relativas a hoje, então dá pra rodar em qualquer dia do mês. Erro de
JavaScript na página conta como falha. Rode antes de abrir um PR. Numa
máquina nova, instale o Playwright antes: `npm i playwright` e
`npx playwright install chromium`.

| Suíte | O que confere |
|-------|---------------|
| `01-sanidade` | Cenário cheio, as seis abas, o backup indo e voltando, os oito temas |
| `02-lancamentos` | Formulário e confirmação, parcelado, edição, lixeira, transferência, filtros da lista |
| `03-faturas` | Em que fatura a compra cai, pagar tudo com ajuste, em partes, levar o resto, parcelar |
| `04-saldo` | A régua do caixa: débito, crédito, boleto a pagar, transferência, saldo inicial e correção |
| `05-emprestimos` | Meio a meio, rateio, receber e desfazer, quitar, "Recebi um valor", indireto, grupo |
| `06-fixos-e-consorcios` | Projeção de 12 meses, "Paguei", editar e excluir fixo, parcelas e encerramento do consórcio |
| `07-investimentos` | Aporte pelo lançamento, os dois andando juntos, valor do grupo, total com consórcio |
| `08-graficos-e-consulta` | A régua do consumo, metas, descontar reembolsos, ranking, respostas da Consulta rápida |
| `09-categorias-e-contatos` | Criar, renomear, excluir (e não voltar sozinha), nome canônico, renomear contato |
| `10-telas` | Em 360 e 412 px, nada rola pro lado; fotos de cada aba |
| `lab` | Isolamento do laboratório, a cópia de dados, a Fase 1, e se ele está em dia com o app |

O resultado aparece na tela, e a saída completa fica em
`testes/fotos/ultima-rodada.txt`, junto com as fotos. A pasta `fotos/` não
vai pro repositório. Uma função nova pede uma verificação nova, na suíte da
área dela. A base comum está em `testes/ajuda.js`: abrir o app, preencher
dados, lançar pelo formulário, datas relativas.

## Laboratório

**No ar em:** https://leocade22-design.github.io/MeuFinanceiro-/lab/

Uma cópia do app, à parte, onde as ideias novas (o projeto de planejamento:
orçamento, limites, metas) são testadas antes de entrar no app de verdade. Tem
nome, ícone e uma faixa roxa próprios, e guarda tudo em gavetas com o prefixo
`meu_financeiro_lab_`. Isso é obrigatório: os dois ficam no mesmo endereço e
dividem o armazenamento do navegador.

- **Dados:** na primeira visita ele oferece copiar os dados do app de verdade,
  sempre só de lá pra cá. O botão "copiar dados" da faixa repete a cópia.
- **Gerado, não editado:** `lab/index.html` sai do `index.html` principal pelo
  `node lab/gerar-lab.js`. Rode de novo sempre que o app mudar, e o
  laboratório acompanha. O que é só do laboratório fica em `lab/lab.js`, e
  cada fase do projeto num arquivo próprio (`lab/fase1-planejamento.js`).
- **Service worker e cache próprios:** `lab/sw.js` só apaga caches que começam
  com `meu-financeiro-lab-`. Mude `VERSAO` ali e `LAB_VERSAO` em `lab/lab.js`
  juntos.
- **Teste:** `node lab/testes/teste-laboratorio.js` (precisa do Playwright).
  Ele confere que o laboratório nunca grava nas gavetas do app de verdade.

## Estrutura

Tudo em `index.html`: estilos no `<style>` do topo, marcação das cinco abas
(Lançamentos, Faturas, Gráficos, Grupos, Investimentos), os modais, e o
JavaScript num `<script>` único no fim.

Dois conceitos que aparecem no código inteiro e valem conhecer antes de mexer:

- **`eCredito(formaModo)`** — o que cai na fatura do cartão. Crédito à vista e
  crédito parcelado entram os dois; só o débito sai na hora. Comparar direto
  com `'Crédito Parcelado'` fica reservado a quem precisa saber de *parcelas*.
- **`getMesFatura(data, formaModo)`** — em que mês a despesa aparece. Compra no
  crédito depois do fechamento (dia 3) cai na fatura do mês seguinte. É por isso
  que as abas Faturas e Gráficos batem: as duas contam pelo mesmo critério.
