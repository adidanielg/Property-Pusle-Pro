// PropertyPulse — notifications.js
// Registra Service Worker y gestiona suscripciones push

const VAPID_PUBLIC_KEY = 'BO6S5wAwnwxZqXJtfGBQniwzi2XKqkHvndoJodZrPzRMUUWV3Cc_YtIbmy3appADx55ldSAjW5lErYXABC_Fq5g';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function initNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push no soportado en este navegador');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js');

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly:      true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        await fetch('/notificaciones/suscribir', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(subscription)
        });

    } catch (err) {
        console.error('Error inicializando notificaciones:', err);
    }
}

document.addEventListener('DOMContentLoaded', initNotifications);