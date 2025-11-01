const CACHE_NAME = 'signature-tv-v1';
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/signature-tv-logo.png',
];

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch strategy: Cache-first for images, network-first for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache images and posters
  if (request.url.includes('backblaze') || 
      request.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) return cached;
          
          return fetch(request)
            .then(response => {
              // Only cache successful responses
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            })
            .catch(() => {
              // Return placeholder on error
              return caches.match('/movie-placeholder.jpg') || new Response('Image not available');
            });
        })
    );
    return;
  }

  // Network-first for API calls
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request)
      .then(cached => cached || fetch(request))
  );
});
