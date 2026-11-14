const CACHE = 'iptv-gladiator-v5'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

function isChannelRequest(url) {
  return url.pathname.indexOf('/channels/') !== -1
}

function isAsset(url) {
  return url.pathname.indexOf('/assets/') !== -1
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.indexOf('/relay') !== -1 || isChannelRequest(url)) return
  if (/\.(m3u8?|ts|mp4|m4s|mpd|webm|flv)(\?|$)/i.test(url.pathname)) return
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      return new Response('Hors connexion', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }))
    return
  }
  if (!isAsset(url)) return
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
      }
      return response
    }).catch(async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      return new Response('Hors connexion', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }),
  )
})
