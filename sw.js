/* SymbolBox 서비스 워커 — v2.0.0
   · 앱 셸은 미리 받아 두고, 문서 요청은 네트워크 우선(항상 최신 데이터)
   · 오프라인이면 캐시된 셸로 대체
   · 글꼴 CDN은 stale-while-revalidate — 한 번 받아 두면 오프라인에서도 기호가 깨지지 않습니다 */
const VERSION    = 'v2.0.0';
const SHELL      = 'symbolbox-shell-' + VERSION;
const FONTS      = 'symbolbox-fonts-' + VERSION;
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-any-192.png',
  './icons/icon-any-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];
const FONT_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => Promise.allSettled(SHELL_URLS.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== FONTS).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* 글꼴·아이콘 CDN — 캐시를 먼저 내주고 뒤에서 조용히 갱신 */
  if (FONT_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(
      caches.open(FONTS).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req)
            .then((res) => {
              if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  /* 앱 자체 — 네트워크 우선, 실패하면 캐시 */
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match('./index.html'))
      )
  );
});
