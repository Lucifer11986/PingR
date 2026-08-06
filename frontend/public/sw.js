// Minimaler Service Worker - nur Push Notifications, KEIN Caching
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// KEIN fetch intercepting - Browser holt alles direkt vom Server
self.addEventListener('fetch', () => {})

// Push Notifications
self.addEventListener('push', e => {
  const d = e.data?.json() || {}
  e.waitUntil(
    self.registration.showNotification(d.title || 'Nokki', {
      body: d.body || 'Neue Nachricht',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: d.tag || 'pingr-msg',
      data: { url: d.url || '/chat' },
      vibrate: [200, 100, 200]
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(cs => {
      const url = e.notification.data?.url || '/chat'
      const ex = cs.find(c => c.url.includes('/chat'))
      if (ex) { ex.focus(); ex.navigate(url) }
      else clients.openWindow(url)
    })
  )
})
