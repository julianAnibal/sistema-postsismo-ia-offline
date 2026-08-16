const CACHE = '1000-ojos-v9-gemma-sync';
const CORE = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/litert-lm/wasm/litertlm_wasm_compat_asyncify_internal.js',
  '/litert-lm/wasm/litertlm_wasm_compat_asyncify_internal.wasm',
];

const precacheApp = async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(CORE);
  const shell = await cache.match('/');
  if (!shell) throw new Error('PWA shell was not cached.');
  const html = await shell.text();
  const appAssets = [...html.matchAll(/(?:src|href)=["'](\/_expo\/[^"']+)["']/g)]
    .map((match) => match[1]);
  if (appAssets.length) await cache.addAll([...new Set(appAssets)]);
};

self.addEventListener('install', (event) => {
  event.waitUntil(precacheApp());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isAuthenticated = event.request.headers.has('authorization');
  const isApiRequest = url.pathname.startsWith('/api/');
  if (
    url.origin !== self.location.origin ||
    url.pathname.endsWith('.litertlm') ||
    isAuthenticated ||
    isApiRequest
  ) return;
  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return (await caches.match('/')) ?? response;
          }
          return response;
        }
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return (await caches.match('/')) ?? Response.error();
        }
        return Response.error();
      }),
  );
});
