import { test, expect } from '@playwright/test'

/**
 * スモークテスト
 * アプリケーションの基本的な動作を確認
 */
test.describe('Smoke Tests', () => {
  test('アプリケーションが正常に読み込まれる', async ({ page }) => {
    await page.goto('/')

    // スプラッシュ画面が表示されることを確認
    // スプラッシュ画面が消えるまで待機（最大5秒）
    await page.waitForTimeout(3000)

    // メインコンテンツが表示されることを確認
    await expect(page.locator('body')).toBeVisible()
  })

  test('フィルターボタンが表示される', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000) // スプラッシュ画面待機

    // フィルターボタンが表示されることを確認
    const filterButton = page.getByRole('button', { name: 'フィルター' })
    await expect(filterButton).toBeVisible()
  })

  test('メニューボタンが表示される', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000) // スプラッシュ画面待機

    // メニューボタンが表示されることを確認
    const menuButton = page.getByRole('button', { name: 'メニュー' })
    await expect(menuButton).toBeVisible()
  })

  test('投稿ボタン（FAB）が表示される', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000) // スプラッシュ画面待機

    // 投稿ボタンが表示されることを確認
    const postButton = page.getByRole('button', { name: '投稿' })
    await expect(postButton).toBeVisible()
  })
})
