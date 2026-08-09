# Manual de uso

O PDF pronto está na raiz do repositório: [`MeuFinanceiro-Manual.pdf`](../MeuFinanceiro-Manual.pdf).

Estes arquivos servem pra **gerar o PDF de novo** quando o app mudar, em vez de
editar o PDF à mão.

## Como regerar

Precisa do Playwright com Chromium disponível.

```bash
node manual/gerar-telas.js   # abre o app, popula dados fictícios e tira as telas em img/
node manual/gerar-pdf.js     # transforma manual.html no PDF
```

- `gerar-telas.js` — sobe o `index.html` num navegador, preenche um cenário de
  demonstração (salário, mercado, cartão, empréstimos, viagem) e recorta cada
  card num PNG. Os dados são fictícios: nenhum número real do app sai daqui.
- `manual.html` — o texto e o layout. É HTML comum; edite direto.
- `gerar-pdf.js` — imprime o HTML em A4.

As datas do cenário são ancoradas no mês corrente, então os totais que aparecem
no manual continuam coerentes independente de quando ele for regerado.
