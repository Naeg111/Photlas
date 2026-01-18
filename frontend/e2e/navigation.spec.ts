import { test, expect } from '@playwright/test'

/**
 * ナビゲーションテスト
 * メニューとダイアログの操作を確認
 */
test.describe('Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // スプラッシュ画面が消えるまで待機
    await page.waitForTimeout(3000)
  })

  test('メニューボタンをクリックするとメニューパネルが開く', async ({ page }) => {
    // メニューボタンをクリック
    await page.getByRole('button', { name: 'メニュー' }).click()

    // メニューパネル内のボタンが表示されることを確認
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()
    await expect(page.getByRole('button', { name: '新規アカウント作成' })).toBeVisible()
  })

  test('フィルターボタンをクリックするとフィルターパネルが開く', async ({ page }) => {
    // フィルターボタンをクリック
    await page.getByRole('button', { name: 'フィルター' }).click()

    // フィルターパネルが表示されることを確認（適用ボタンで判定）
    await expect(page.getByRole('button', { name: '適用' })).toBeVisible()
  })

  test('メニューからログインダイアログを開く', async ({ page }) => {
    // メニューを開く
    await page.getByRole('button', { name: 'メニュー' }).click()

    // メニュー内のログインボタンをクリック
    await page.getByRole('button', { name: 'ログイン' }).click()

    // ログインダイアログが表示されることを確認
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
  })

  test('メニューから新規登録ダイアログを開く', async ({ page }) => {
    // メニューを開く
    await page.getByRole('button', { name: 'メニュー' }).click()

    // 新規登録ボタンをクリック
    await page.getByRole('button', { name: '新規アカウント作成' }).click()

    // 新規登録ダイアログが表示されることを確認
    await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()
  })

  test('投稿ボタンをクリックするとログイン要求ダイアログが表示される（未ログイン時）', async ({ page }) => {
    // 投稿ボタンをクリック
    await page.getByRole('button', { name: '投稿' }).click()

    // ログイン要求ダイアログが表示されることを確認
    await expect(page.getByRole('heading', { name: 'ログインが必要です' })).toBeVisible()
  })

  test('ダイアログを閉じることができる', async ({ page }) => {
    // メニューを開く
    await page.getByRole('button', { name: 'メニュー' }).click()
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()

    // Escキーで閉じる
    await page.keyboard.press('Escape')

    // メニューが閉じることを確認
    await expect(page.getByRole('button', { name: 'ログイン' })).not.toBeVisible()
  })
})
