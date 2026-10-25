// ACORE SERVICE WORKER
// Кешування файлів, офлайн режим, синхронізація

const CACHE_NAME = 'acore';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/css/style.css',
    '/js/config.js',
    '/js/core.js',
    '/js/ai.js',
    '/js/news.js',
    '/js/tools.js',
    '/js/mail.js',
    '/js/chat.js',
    '/js/games/manager.js',
    '/js/boot.js'
];

// ============ INSTALL ============
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Service Worker: кешування файлів');
                return cache.addAll(urlsToCache);
            })
            .catch(err => console.log('⚠️ Помилка кешування:', err))
    );
    self.skipWaiting();
});

// ============ ACTIVATE ============
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Видалення старого кеша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// ============ FETCH ============
self.addEventListener('fetch', event => {
    const { request } = event;

    // Ігноруємо non-GET запити
    if (request.method !== 'GET') return;

    // Стратегія: Cache First для статичних активів, Network First для динамічного контенту
    const isStatic = /\.(js|css|png|jpg|gif|svg|woff|woff2)$/i.test(request.url) ||
                     request.url.includes('icons/');

    if (isStatic) {
        // Cache First для статичних файлів
        event.respondWith(
            caches.match(request)
                .then(response => response || fetch(request))
                .catch(() => {
                    // Повертаємо offline page якщо доступна
                    return caches.match('/index.html');
                })
        );
    } else {
        // Network First для динамічного контенту (новини, API)
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Кешуємо успішні responses
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // При помилці мережі, беремо з кеша
                    return caches.match(request)
                        .then(response => response || caches.match('/index.html'));
                })
        );
    }
});

// ============ MESSAGE HANDLING ============
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
