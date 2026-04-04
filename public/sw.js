const CACHE_NAME = 'tv-media-v5';
const IMAGE_CACHE_NAME = 'tv-images-v1';

// Files to cache immediately on install
const PRE_CACHE = [
    '/',
    '/js/myScripts.js',
    '/backgrounds.txt'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/.test(url.pathname);

    // skip POST and Socket.io
    if (event.request.method !== 'GET' || url.pathname.includes('/socket.io/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return from cache, but update in background (Stale-While-Revalidate)
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse.status === 200) {
                        const cacheToUse = isImage ? IMAGE_CACHE_NAME : CACHE_NAME;
                        caches.open(cacheToUse).then((cache) => {
                            cache.put(event.request, networkResponse);
                        });
                    }
                });
                return cachedResponse;
            }

            // Not in cache, fetch from network
            return fetch(event.request).then((networkResponse) => {
                if (networkResponse.status === 200) {
                    const cacheToUse = isImage ? IMAGE_CACHE_NAME : CACHE_NAME;
                    const responseClone = networkResponse.clone();
                    caches.open(cacheToUse).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME && key !== IMAGE_CACHE_NAME) {
                    return caches.delete(key);
                }
            })
        ))
    );
});