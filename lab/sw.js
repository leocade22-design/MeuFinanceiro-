// SERVICE WORKER DO LABORATÓRIO
// Mude VERSAO aqui e LAB_VERSAO em lab/lab.js juntas quando o laboratório mudar.
//
// O laboratório divide o endereço (e o armazenamento de cache) com o app de
// verdade. Por isso tudo aqui tem nome próprio e este arquivo só apaga caches
// que começam com 'meu-financeiro-lab-' — o do app de verdade fica intocado.
const VERSAO = 'lab-2026.10.11-1';
const PREFIXO_CACHE = 'meu-financeiro-lab-';
const CACHE_NAME = PREFIXO_CACHE + VERSAO;

const ARQUIVOS_PARA_CACHE = [
  './',
  './index.html',
  './lab.js',
  './fase1-planejamento.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ARQUIVOS_PARA_CACHE.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes
        .filter((n) => n.startsWith(PREFIXO_CACHE) && n !== CACHE_NAME)
        .map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'ATIVAR_AGORA') self.skipWaiting();
});

// Mesma estratégia do app: rede primeiro (sem o cache HTTP do navegador),
// cópia guardada só quando não há internet.
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
      // offline: só o cache do laboratório; navegação sem cache volta pro index DAQUI
      .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(event.request).then((c) =>
        c || (event.request.mode === 'navigate' ? cache.match('./index.html') : undefined)
      )))
  );
});
