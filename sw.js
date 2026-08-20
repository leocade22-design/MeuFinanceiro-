// IMPORTANTE: ao publicar uma versão nova do app, mude VERSAO aqui e a constante
// APP_VERSION no index.html (as duas juntas). É a mudança neste arquivo que faz o
// navegador perceber que existe versão nova e reinstalar o service worker.
const VERSAO = '2026.08.20-2';
const CACHE_NAME = 'meu-financeiro-' + VERSAO;

const ARQUIVOS_PARA_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // cache: 'reload' garante que a instalação pegue os arquivos da REDE, e não
    // uma cópia velha do cache HTTP do navegador
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ARQUIVOS_PARA_CACHE.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Permite que a página mande ativar a versão nova sem esperar
self.addEventListener('message', (event) => {
  if (event.data === 'ATIVAR_AGORA') self.skipWaiting();
});

// Network-first DE VERDADE: o segredo é o cache: 'no-store'. Sem ele, o fetch aqui
// dentro ainda passa pelo cache HTTP do navegador — e o GitHub Pages manda
// max-age=600, o que fazia o app continuar servindo a versão antiga mesmo online.
// O cache local só entra em cena quando não há internet.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(new Request(event.request.url, {
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'follow'
    }))
      .then((resposta) => {
        if (resposta && resposta.status === 200 && resposta.type === 'basic') {
          const clone = resposta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return resposta;
      })
      // offline: cai pro que estiver guardado; navegação sem cache volta pro index
      .catch(() => caches.match(event.request).then((c) =>
        c || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined)
      ))
  );
});
