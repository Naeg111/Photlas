import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { PHOTO_CACHE_URL_PATTERN, PHOTO_CACHE_NAME } from './src/config/serviceWorkerCache'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Issue#129: Service Worker による写真画像キャッシュ
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: PHOTO_CACHE_URL_PATTERN,
            handler: 'CacheFirst',
            options: {
              cacheName: PHOTO_CACHE_NAME,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      'react-map-gl': 'react-map-gl/mapbox',
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
