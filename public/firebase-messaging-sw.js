importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCP2bu3DuGXEuzeQVn3Y_09Mp0Qd2TpbU8",
  authDomain: "trainingsplaner-796d3.firebaseapp.co",
  projectId: "trainingsplaner-796d3",
  storageBucket: "trainingsplaner-796d3.firebasestorage.app",
  messagingSenderId: "946824686799",
  appId: "1:946824686799:web:e9772752716fbf49491bba",
});

const messaging = firebase.messaging();

// Background message handler — shows the notification when the tab is not in focus
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? payload.data?.title ?? "Notification";
  const body = payload.notification?.body ?? payload.data?.body ?? "";
  const link = payload.data?.link ?? "/";

  self.registration.showNotification(title, {
    body,
    icon: "/web-app-manifest-192x192.png",
    badge: "/favicon-96x96.png",
    data: { link },
    tag: payload.data?.notifId ?? "default",
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(link);
          return;
        }
      }
      return clients.openWindow(link);
    }),
  );
});
