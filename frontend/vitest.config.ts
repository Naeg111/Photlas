/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // E2Eテスト（Playwright）を除外
    exclude: ['**/node_modules/**', '**/e2e/**'],
    // 基本設定のみ
    testTimeout: 10000,
    // 明示的にシーケンシャル実行
    sequence: {
      concurrent: false,
    },
    // ファイル間の完全分離
    isolate: true,
    // テスト用環境変数
    env: {
      VITE_GOOGLE_MAPS_API_KEY: 'test-api-key',
    },
  },
})
