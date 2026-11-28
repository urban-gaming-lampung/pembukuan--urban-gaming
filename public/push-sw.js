/* URBAN — service worker notifikasi (push dari server via FCM). Tanpa cache: aplikasi tetap selalu versi terbaru. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (_) { p = {}; }
  const d = p.data || p || {};
  const judul = d.judul || (p.notification && p.notification.title) || "URBAN";
  const isi = d.isi || (p.notification && p.notification.body) || "";
  const base = self.registration.scope;
  e.waitUntil(
    self.registration.showNotification(judul, {
      body: isi,
      tag: d.tag || undefined,
      renotify: !!d.tag,
      icon: base + "icon-192.png",
      badge: base + "badge-96.png",
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: { link: d.link || base },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(link);
    })
  );
});
