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
