/**
 * Issue#70: PWA対応のための最小限Service Worker
 *
 * - PWAインストール要件を満たす
 * - ネットワークファースト（オフラインキャッシュは行わない）
 * - 地図タイルのキャッシュは行わない（Mapbox利用規約に準拠）
 */

const CACHE_NAME = 'photlas-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // ナビゲーションリクエストはネットワークファースト
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // その他のリクエストはネットワークのみ
  event.respondWith(fetch(event.request))
})
