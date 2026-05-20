// Service Worker for SSC GK Score Booster
// Handles push notification display

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Handle push events (for future server-side push — not used in V2)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "ssc-reminder",
      renotify: true,
      data: { url: data.url || "/" },
    })
  );
});

// Handle notification click — open/focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(
            event.notification.data?.url || "/"
          );
        }
      })
  );
});

// Handle scheduled notification alarm (message from main thread)
self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "ssc-daily-reminder",
      renotify: true,
      data: { url: "/" },
      actions: [
        { action: "play", title: "Play Now 🎯" },
        { action: "dismiss", title: "Later" },
      ],
    });
  }
});
