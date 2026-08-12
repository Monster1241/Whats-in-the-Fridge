/**
 * App service worker: offline shell + Firebase Cloud Messaging.
 * Config must match src/firebase/config.js defaults / your Vite env overrides.
 *
 * Important: never cache index.html / hashed JS long-term for navigation.
 * Serving a stale HTML shell that points at deleted /assets/*.js causes a blank page.
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
const SHELL_CACHE = 'fridge-shell-v2';
const PRECACHE_URLS = ['/offline.html', '/manifest.webmanifest', '/favicon.svg'];

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

  // Always prefer network for navigations / HTML so deploys never blank out.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html')),
    );
    return;
  }

  // Do not intercept Vite hashed modules — let the browser load them fresh.
  if (
    url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/src/')
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('.css')
    || url.pathname.endsWith('.jsx')
    || url.pathname.endsWith('.tsx')
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response.ok || response.type !== 'basic') return response;
          if (url.pathname === '/offline.html' || url.pathname === '/manifest.webmanifest' || url.pathname === '/favicon.svg' || url.pathname.startsWith('/icons/')) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
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
