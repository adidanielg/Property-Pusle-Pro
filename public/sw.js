// PropertyPulse — Service Worker v2
const CACHE = 'pp-v2';
const STATIC = [
    '/',
    '/css/style.css',
    '/js/i18n.js',
    '/js/notifications.js',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/manifest.json'
];

// Instalar — cachear archivos estáticos
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(STATIC))
            .then(() => self.skipWaiting())
    );
});

// Activar — limpiar caches viejos
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', e => {
    // Solo cachear GET, ignorar API calls y rutas de autenticación
    if (e.request.method !== 'GET') return;
    if (e.request.url.includes('/auth/') || e.request.url.includes('/cliente/') ||
        e.request.url.includes('/tecnico/') || e.request.url.includes('/admin/') ||
        e.request.url.includes('/notificaciones/')) return;

    e.respondWith(
        fetch(e.request)
            .then(res => {
                // Cachear respuesta fresca
                const clone = res.clone();
                caches.open(CACHE).then(cache => cache.put(e.request, clone));
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});

// ── Notificaciones push ───────────────────────────────────────
self.addEventListener('push', event => {
    if (!event.data) return;
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body:    data.body,
            icon:    '/icons/icon-192.png',
            badge:   '/icons/badge-72.png',
            vibrate: [100, 50, 100],
            data:    { url: data.url || '/' }
        })
    );
});

// ── Click en notificación ─────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                const url = event.notification.data?.url || '/';
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(url);
                        return client.focus();
                    }
                }
                if (clients.openWindow) return clients.openWindow(url);
            })
    );
});