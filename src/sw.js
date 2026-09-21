// Kisan Saathi — Custom Service Worker
// Handles: PWA caching (Workbox injected) + Web Push Notifications
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// ──────────────────────────────────────────────
// 1. WORKBOX PRECACHE (auto-injected by vite-plugin-pwa)
// ──────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// ──────────────────────────────────────────────
// 2. RUNTIME CACHING STRATEGIES
// ──────────────────────────────────────────────

// API: Network first (fresh data, fallback cache)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'kisan-api-cache-v2',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 60 * 5 }), // 5 min max
    ],
  })
);

// Unsplash images: Stale-while-revalidate (images rarely change)
registerRoute(
  ({ url }) => url.hostname.includes('unsplash.com'),
  new StaleWhileRevalidate({
    cacheName: 'kisan-images-cache-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 }), // 7 days
    ],
  })
);

// ──────────────────────────────────────────────
// 3. INSTALL & ACTIVATE — Skip waiting for immediate takeover
// ──────────────────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// ──────────────────────────────────────────────
// 4. WEB PUSH — Receive and show system notifications
// ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Kisan Saathi Alert', body: event.data.text(), type: 'general' };
  }

  const {
    title = '🌾 Kisan Saathi',
    body = 'You have a new procurement update.',
    type = 'general',
    url = '/',
    token = '',
    farmer_id = ''
  } = payload;

  // Choose icon + badge by notification type
  const iconMap = {
    slot_update:    '/pwa-192x192.png',
    queue_call:     '/pwa-192x192.png',
    payment_update: '/pwa-192x192.png',
    weighment:      '/pwa-192x192.png',
    urgent:         '/pwa-192x192.png',
    general:        '/pwa-192x192.png',
  };

  const colorMap = {
    slot_update:    '#046A38',
    queue_call:     '#FF9933',
    payment_update: '#059669',
    weighment:      '#6D28D9',
    urgent:         '#DC2626',
    general:        '#0B2545',
  };

  const notificationOptions = {
    body,
    icon:  iconMap[type] || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag:   `kisan-${type}-${Date.now()}`,
    renotify: true,
    requireInteraction: type === 'queue_call' || type === 'urgent',
    vibrate: type === 'queue_call' ? [200, 100, 200, 100, 400] : [200, 100, 200],
    timestamp: Date.now(),
    data: { url, type, token, farmer_id },
    actions: type === 'queue_call'
      ? [
          { action: 'view_queue',   title: '👁️ View Queue' },
          { action: 'check_in',     title: '✅ Check In' },
        ]
      : type === 'payment_update'
      ? [
          { action: 'view_payment', title: '💰 View Payment' },
          { action: 'dismiss',      title: '✕ Dismiss' },
        ]
      : [
          { action: 'open_app',     title: '📱 Open App' },
          { action: 'dismiss',      title: '✕ Dismiss' },
        ],
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// ──────────────────────────────────────────────
// 5. NOTIFICATION CLICK — Route to right screen
// ──────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action } = event;
  const { url, type } = event.notification.data || {};

  let targetUrl = '/';
  if (action === 'view_queue' || type === 'queue_call')    targetUrl = '/?screen=queue';
  if (action === 'view_payment' || type === 'payment_update') targetUrl = '/?screen=tracking';
  if (action === 'check_in')   targetUrl = '/?screen=queue&action=checkin';
  if (action === 'dismiss')    return;
  if (url)                     targetUrl = url;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', screen: type, targetUrl });
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ──────────────────────────────────────────────
// 6. PUSH SUBSCRIPTION CHANGE — Re-subscribe on key rotation
// ──────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.newSubscription?.options?.applicationServerKey
    }).then((sub) => {
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub })
      });
    })
  );
});
