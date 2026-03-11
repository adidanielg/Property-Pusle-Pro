// PropertyPulse — Service Worker
// Maneja notificaciones push en segundo plano

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

// ── Recibir notificación push ─────────────────────────────────
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

// ── Click en notificación → abrir la URL correcta ─────────────
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