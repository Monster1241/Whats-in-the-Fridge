/**
 * App service worker: offline shell + Firebase Cloud Messaging.
 * Config must match src/firebase/config.js defaults / your Vite env overrides.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBc9LDIPH__J3JgN8F7NnP7pDGwTebCysU',
  authDomain: 'my-household-hub.firebaseapp.com',
  projectId: 'my-household-hub',
  storageBucket: 'my-household-hub.firebasestorage.app',
  messagingSenderId: '268899548006',
  appId: '1:268899548006:web:0cc638e66159ef602ae6a7',
});

const messaging = firebase.messaging();
const SHELL_CACHE = 'fridge-shell-v1';
const PRECACHE_URLS = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/favicon.svg'];

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification ?? {};
  const title = notification.title || "What's in the Fridge";
  const options = {
    body: notification.body || '',
    icon: notification.icon || '/icons/icon-192.png',
    data: payload.data ?? {},
    tag: payload.data?.tag || 'fridge-push',
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('fridge-') && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || caches.match('/offline.html');
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response.ok || response.type !== 'basic') return response;
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('/offline.html'));
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
      return undefined;
    }),
  );
});
