import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E テスト設定
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // テストディレクトリ
  testDir: './e2e',

  // テスト全体のタイムアウト
  timeout: 30000,

  // 各テストのリトライ回数（CI環境では1回リトライ）
  retries: process.env.CI ? 1 : 0,

  // 並列実行のワーカー数
  workers: process.env.CI ? 1 : undefined,

  // レポーター設定
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // 共通設定
  use: {
    // ベースURL（開発サーバー）
    baseURL: 'http://localhost:5173',

    // スクリーンショット設定（失敗時のみ）
    screenshot: 'only-on-failure',

    // トレース設定（リトライ時のみ）
    trace: 'on-first-retry',

    // ビデオ設定（失敗時のみ）
    video: 'on-first-retry',
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
  ],

  // 開発サーバーの自動起動設定
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
