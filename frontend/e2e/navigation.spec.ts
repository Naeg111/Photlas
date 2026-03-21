import { test, expect } from '@playwright/test'
import { initCookieConsent } from './helpers/auth'

/**
 * ナビゲーションテスト
 * メニューとダイアログの操作を確認
 */
test.describe('Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await initCookieConsent(page)
    await page.goto('/')
    // スプラッシュ画面が消えるまで待機
    await page.waitForTimeout(3000)
  })

  test('メニューボタンをクリックするとメニューパネルが開く', async ({ page }) => {
    await page.getByRole('button', { name: 'メニュー' }).click()

    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()
    await expect(page.getByRole('button', { name: '新規アカウント作成' })).toBeVisible()
  })

  test('フィルターボタンをクリックするとフィルターパネルが開く', async ({ page }) => {
    await page.getByRole('button', { name: 'フィルター' }).click()

    await expect(page.getByRole('button', { name: '適用' })).toBeVisible()
  })

  test('メニューからログインダイアログを開く', async ({ page }) => {
    await page.getByRole('button', { name: 'メニュー' }).click()

    await page.getByRole('button', { name: 'ログイン' }).click()

    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
  })

  test('メニューから新規登録ダイアログを開く', async ({ page }) => {
    await page.getByRole('button', { name: 'メニュー' }).click()

    await page.getByRole('button', { name: '新規アカウント作成' }).click()

    await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()
  })

  test('投稿ボタンをクリックするとログイン要求ダイアログが表示される（未ログイン時）', async ({ page }) => {
    await page.getByRole('button', { name: '投稿' }).click()

    await expect(page.getByRole('heading', { name: 'ログインが必要です' })).toBeVisible()
  })

  test('ダイアログを閉じることができる', async ({ page }) => {
    await page.getByRole('button', { name: 'メニュー' }).click()
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('button', { name: 'ログイン' })).not.toBeVisible()
  })

  test('メニューから利用規約を開くとダイアログが表示される', async ({ page }) => {
    await page.getByRole('button', { name: 'メニュー' }).click()
    // メニューアニメーション完了を待機
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: '利用規約' }).click()

    // ダイアログのheadingで確認（メニュー内のボタンと区別するため）
    await expect(page.getByRole('heading', { name: '利用規約' })).toBeVisible({ timeout: 10000 })
  })

  test('メニューからプライバシーポリシーを開くとダイアログが表示される', async ({ page }) => {
    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: 'プライバシーポリシー' }).click()

    await expect(page.getByRole('heading', { name: 'プライバシーポリシー' })).toBeVisible({ timeout: 10000 })
  })

  test('メニューからPhotlasとは？を開くとダイアログが表示される', async ({ page }) => {
    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: 'Photlasとは？' }).click()

    await expect(page.getByText('Photlasとは？')).toBeVisible({ timeout: 10000 })
  })
})
