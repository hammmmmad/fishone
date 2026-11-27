/* ═══════════════════════════════════════════════════════════════
   Daily Fashion AF — Service Worker
   نسخه 1.0.0
   ═══════════════════════════════════════════════════════════════ */
const CACHE_VERSION = 'df-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

/* فایل‌هایی که باید حتماً کش شوند (App Shell) */
const PRECACHE_URLS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './image/logo.jpg',
  './image/icon-192.png',
  './image/icon-512.png'
];

/* ── نصب: پیش‌کش ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Precache partial fail:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

/* ── فعال‌سازی: پاک‌سازی کش‌های قدیمی ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('df-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch strategy ── */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // فقط GET
  if (req.method !== 'GET') return;

  // درخواست‌های GitHub API و raw را کش نکن
  if (url.hostname === 'api.github.com' ||
      url.hostname === 'raw.githubusercontent.com') {
    return;
  }

  // Google Fonts — cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // ویدیوها و عکس‌های ریپو — cache-first با پیشرفت نرم
  if (/\.(mp4|webm|mov)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        // ویدیوهای بزرگ را کش نکن (فقط نمایش)
        return res;
      }).catch(() => caches.match('./offline.html')))
    );
    return;
  }

  // سایر درخواست‌های هم‌مبدا: Network-first با fallback به کش
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./offline.html')))
    );
    return;
  }

  // بقیه: کش اول، شبکه دوم
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(() => caches.match('./offline.html')))
  );
});

/* ── پیام از سمت کلاینت (برای update / skipWaiting) ── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
