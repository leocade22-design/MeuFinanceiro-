const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ channel:'chromium' });
  const page = await b.newPage();
  await page.goto('file://' + __dirname + '/manual.html',
                  { waitUntil:'networkidle' });
  await page.waitForTimeout(1200);
  const faltando = await page.$$eval('img', els=>els.filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src')));
  console.log('imagens que nao carregaram:', faltando.length? faltando : 'nenhuma');
  await page.pdf({ path: __dirname + '/../MeuFinanceiro-Manual.pdf', format:'A4', printBackground:true, preferCSSPageSize:true });
  await b.close();
})();
