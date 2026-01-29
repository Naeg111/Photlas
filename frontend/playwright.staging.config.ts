import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E テスト設定（テスト環境用）
 *
 * 使用方法:
 * pnpm playwright test --config=playwright.staging.config.ts
 *
 * または:
 * pnpm test:e2e:staging
 */
export default defineConfig({
  // テストディレクトリ
  testDir: './e2e',

  // テスト全体のタイムアウト（テスト環境はネットワーク遅延があるため長めに設定）
  timeout: 60000,

  // expect のタイムアウト
  expect: {
    timeout: 10000,
  },

  // 各テストのリトライ回数
  retries: process.env.CI ? 2 : 1,

  // 並列実行のワーカー数（テスト環境への負荷を考慮して制限）
  workers: process.env.CI ? 1 : 2,

  // レポーター設定
  reporter: [
    ['html', { outputFolder: 'playwright-report-staging' }],
    ['list'],
  ],

  // 共通設定
  use: {
    // テスト環境のベースURL
    baseURL: 'https://test.photlas.jp',

    // スクリーンショット設定（失敗時のみ）
    screenshot: 'only-on-failure',

    // トレース設定（リトライ時のみ）
    trace: 'on-first-retry',

    // ビデオ設定（失敗時のみ）
    video: 'on-first-retry',

    // HTTPSを使用するためのオプション
    ignoreHTTPSErrors: true,

    // ビューポート設定
    viewport: { width: 1280, height: 720 },

    // ナビゲーションタイムアウト
    navigationTimeout: 30000,

    // アクションタイムアウト
    actionTimeout: 15000,
  },

  // テスト対象のブラウザ・デバイス
  projects: [
    // デスクトップ Chromium
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // モバイル（Android）
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },

    // デスクトップ Firefox
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // デスクトップ Safari
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // テスト環境では開発サーバーは起動しない
  // webServer: undefined,
})
