const CACHE_NAME = 'meu-financeiro-v1';
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Network-first: sempre busca a versão mais nova quando há internet
// (importante porque o app ainda está em desenvolvimento ativo),
// e só cai pro cache quando estiver offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((respostaRede) => {
        if (respostaRede && respostaRede.status === 200) {
          const clone = respostaRede.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return respostaRede;
      })
      .catch(() => caches.match(event.request))
  );
});
