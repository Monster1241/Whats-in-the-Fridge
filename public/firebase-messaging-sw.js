/**
 * Firebase Cloud Messaging service worker (compat SDK for classic SW).
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

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification ?? {};
  const title = notification.title || 'What\'s in the Fridge';
  const options = {
    body: notification.body || '',
    icon: notification.icon || '/favicon.svg',
    data: payload.data ?? {},
    tag: payload.data?.tag || 'fridge-push',
  };
  return self.registration.showNotification(title, options);
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
