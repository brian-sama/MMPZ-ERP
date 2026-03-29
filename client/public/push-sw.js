self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {
      title: 'MMPZ ERP',
      body: 'You have a new notification.',
    };
  }

  const title = payload.title || 'MMPZ ERP';
  const options = {
    body: payload.body || 'You have a new notification.',
    icon: payload.icon || '/mmpz-logo.png',
    badge: payload.badge || '/mmpz-logo.png',
    tag: payload.tag || undefined,
    data: {
      url: payload.url || '/',
      eventId: payload.eventId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'notification-click',
            url: targetUrl,
            eventId: event.notification.data?.eventId || null,
          });
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
