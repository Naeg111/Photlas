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
    // 基本設定のみ
    testTimeout: 10000,
    // 明示的にシーケンシャル実行
    sequence: {
      concurrent: false,
    },
    // ファイル間の完全分離
    isolate: true,
  },
})
