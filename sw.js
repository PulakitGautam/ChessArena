/* Chess Arena service worker: makes the app open and run offline. */
const V = 'arena-v11';
const SHELL = ['./', './index.html', './index.css', './index.js', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await c.addAll(SHELL);
    // Third-party files are cached best-effort; a failure here must not block install.
    await Promise.allSettled(CDN.map(async u => { const r = await fetch(u, { mode: 'no-cors' }); await c.put(u, r); }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;
  if (url.hostname.endsWith('supabase.co')) return; // never cache sign-in or tournament data

  // Pages: try the network first so updates arrive, fall back to the saved copy offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html', { ignoreSearch: true }).then(r => r || caches.match('./')))
    );
    return;
  }

  // Our own files (index.css, index.js, icons): network first, so the page and its scripts never get out of step after an update.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); } return r; })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Third-party files (chess.js, fonts): use the saved copy instantly and refresh it in the background.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
