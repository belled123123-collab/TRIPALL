// 每次修改前端檔案後，手動遞增此版本號（例如 trip-pwa-v2、trip-pwa-v3）
const CACHE_NAME = 'trip-pwa-v7';

// 僅快取同源輕量靜態資源；不寫死大型外部 CDN，避免擋掉更新
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png'
];

// 1. 安裝階段：預先快取核心檔案，並立即跳過等待狀態
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch((err) => console.warn('預快取略過部分檔案:', err))
      .then(() => self.skipWaiting())
  );
});

// 2. 啟用階段：刪除所有非目前版本的舊快取，並立即接管已開啟的頁面
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      ))
      .then(() => self.clients.claim())
  );
});

// 3. 攔截請求：HTML 與同源檔案走網路優先；Supabase / 外部 API 直接走網路不進快取
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 只處理 GET 請求
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 排除 Supabase 資料庫/即時連線與外部匯率 API，一律直接走網路
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('open.er-api.com')
  ) {
    return;
  }

  // 網頁導覽 (HTML) 或同源請求：網路優先 (Network First)，失敗才讀快取
  if (request.mode === 'navigate' || url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
  }
});

// 支援頁面點擊「立即更新」時跳過等待
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
