/* Quỹ Lông thủ — lưu sẵn giao diện để app mở nhanh và vẫn mở được khi mạng chập chờn.
   Số liệu luôn lấy trực tiếp từ Google Sheet (không lưu lại ở đây). */
const PREFIX = 'qlt-';
const CACHE = PREFIX + 'v2';
const WAIT = 1500;   // mạng chậm hơn mức này thì mở bằng bản đã lưu, bản mới vẫn tải về cho lần sau
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

// chỉ dọn bộ nhớ cũ của chính app này (app kia trên cùng trang github.io dùng tên khác)
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const keep = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // gọi Google Sheet (POST) đi thẳng ra mạng
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // giao diện: lấy bản mới nhất; mạng chậm hoặc mất mạng thì dùng ngay bản đã lưu
    const saved = () => caches.match(req, { cacheName: CACHE }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html', { cacheName: CACHE }) : undefined));
    e.respondWith(new Promise(resolve => {
      let done = false;
      const finish = res => { if (!done && res) { done = true; resolve(res); } return !!res; };
      const net = fetch(req).then(res => keep(req, res));
      const timer = setTimeout(() => saved().then(finish), WAIT);
      net.then(res => { clearTimeout(timer); finish(res); })
        .catch(() => { clearTimeout(timer); saved().then(hit => { if (!finish(hit)) finish(Response.error()); }); });
    }));
  } else if (/^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/.test(url.hostname)) {
    // phông chữ và thư viện mã QR: dùng bản đã lưu cho nhanh
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => keep(req, res))));
  }
});
