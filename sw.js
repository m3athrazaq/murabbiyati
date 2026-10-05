/* مربّيتي — service worker: keeps the app working offline and receives shared CSV files */
const VERSION = 'murabbiyati-v1.0.0-1c4542b40f';
/* the card reader's files (~9 MB) are cached on first use, in their own cache that app updates keep */
const OCR_CACHE = 'murabbiyati-ocr-eddbb7af58';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('murabbiyati-') && k !== VERSION && k !== OCR_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* tiny IndexedDB helper, same database the page uses */
function idbPut(key, value) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('murabbiyati', 1);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  /* Android share sheet → "مربّيتي": stash the file, then open the app to import it */
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      try {
        const form = await req.formData();
        const files = [];
        for (const f of form.getAll('file')) {
          if (f && typeof f.arrayBuffer === 'function') files.push({ name: f.name || 'shared.csv', type: f.type || '', buf: await f.arrayBuffer() });
        }
        await idbPut('pendingShare', { at: Date.now(), files });
      } catch (e) { /* the page will say nothing arrived */ }
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }

  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match('./index.html');
      if (hit) return hit;
      try { return await fetch(req); }
      catch (e) { return new Response('<meta charset="utf-8"><p style="font-family:sans-serif;padding:2em" dir="rtl">افتح التطبيق مرة واحدة وأنت متصل بالإنترنت ليعمل بعدها دون اتصال.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
    })());
    return;
  }

  const ocr = url.pathname.indexOf('/ocr/') >= 0;
  event.respondWith((async () => {
    const cache = await caches.open(ocr ? OCR_CACHE : VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response('', { status: 504 });
    }
  })());
});
