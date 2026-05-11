import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import {
  PHOTO_CACHE_URL_PATTERN,
  PHOTO_CACHE_NAME,
  PHOTO_CACHE_MAX_ENTRIES,
  PHOTO_CACHE_MAX_AGE_SECONDS,
  PHOTO_CACHEABLE_STATUSES,
} from './src/config/serviceWorkerCache'

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
                maxEntries: PHOTO_CACHE_MAX_ENTRIES,
                maxAgeSeconds: PHOTO_CACHE_MAX_AGE_SECONDS,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [...PHOTO_CACHEABLE_STATUSES] },
            },
          },
        ],
      },
    }),
    // Issue#130: ローカル計測用。dist/stats.html にバンドル内訳を可視化したレポートを生成。
    // CI や本番デプロイには含めず、ローカルでの効果計測時のみ参照する。
    // rollup-plugin-visualizer の rollup 型が Vite 同梱の rollup と異なるため PluginOption にキャスト
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }) as PluginOption,
  ],
  build: {
    rollupOptions: {
      output: {
        // Issue#130: 更新頻度が低い主要ライブラリを独立 chunk に分離してブラウザキャッシュを効かせる。
        // アプリコードの更新があっても下記 chunk は変わらず再ダウンロード不要になる。
        manualChunks: {
          mapbox: ['mapbox-gl', 'react-map-gl'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          motion: ['motion'],
          sentry: ['@sentry/react'],
        },
      },
    },
  },
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
