const CACHE_NAME = "studio-os-shell-v3";
const SHELL_URLS = ["/studio-os", "/studio-os-manifest.json", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith("/studio-os")) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match("/studio-os") || caches.match(event.request))
  );
});

// Phase 2 Web Push Notification Handler
// Triggered only for: promises due <= 3h, client portal approvals/changes, or project forecast turning late
self.addEventListener("push", (event) => {
  let payload = {
    title: "Studio OS",
    body: "Studio OS alert",
    url: "/studio-os",
    tag: "studio-os-alert",
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: payload.tag || "studio-os-alert",
      data: { url: payload.url || "/studio-os" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/studio-os";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/studio-os") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
