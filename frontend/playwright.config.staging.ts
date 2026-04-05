import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E テスト設定（ステージング環境用）
 * ステージング環境（test.photlas.jp）に対してテストを実行する
 */
export default defineConfig({
  testDir: './e2e',

  // ステージング環境はネットワーク遅延があるためタイムアウトを長めに設定
  timeout: 120000,

  retries: 0,

  workers: 1,

  reporter: [
    ['html', { outputFolder: 'playwright-report-staging' }],
    ['list'],
  ],

  use: {
    baseURL: 'https://test.photlas.jp',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // ステージング環境ではローカルサーバー不要
  // webServer は設定しない
})
