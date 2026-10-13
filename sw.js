/* Quỹ Lông thủ — lưu sẵn giao diện để app mở nhanh và vẫn mở được khi mạng chập chờn.
   Số liệu luôn lấy trực tiếp từ Google Sheet (không lưu lại ở đây). */
const CACHE = 'qlt-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const keep = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // gọi Google Sheet (POST) đi thẳng ra mạng
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // giao diện: lấy bản mới nhất nếu có mạng, không có mạng thì dùng bản đã lưu
    e.respondWith(fetch(req).then(res => keep(req, res))
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
  } else if (/^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/.test(url.hostname)) {
    // phông chữ và thư viện mã QR: dùng bản đã lưu cho nhanh
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => keep(req, res))));
  }
});
