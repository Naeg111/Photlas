import { test, expect } from '@playwright/test'
import { initCookieConsent } from './helpers/auth'

/**
 * 利用規約・プライバシーポリシー言語切替テスト
 * トグルスイッチによる日本語/英語切替を確認
 */
test.describe('Language Toggle Tests', () => {
  test.beforeEach(async ({ page }) => {
    await initCookieConsent(page)
    await page.goto('/')
    await page.waitForTimeout(3000) // スプラッシュ画面待機
  })

  test.describe('利用規約の言語切替', () => {
    test.beforeEach(async ({ page }) => {
      // メニュー → 利用規約を開く
      await page.getByRole('button', { name: 'メニュー' }).click()
      await page.waitForTimeout(500) // メニューアニメーション待機
      await page.getByRole('button', { name: '利用規約' }).click()
      await expect(page.getByRole('heading', { name: '利用規約' })).toBeVisible({ timeout: 10000 })
    })

    test('初期表示は日本語である', async ({ page }) => {
      await expect(page.getByText('第1条（適用）')).toBeVisible()
    })

    test('言語トグルスイッチが表示される', async ({ page }) => {
      await expect(page.getByText('日本語')).toBeVisible()
      await expect(page.getByText('英語')).toBeVisible()
      await expect(page.getByRole('switch', { name: '言語切替' })).toBeVisible()
    })

    test('トグルを切り替えると英語版が表示される', async ({ page }) => {
      await page.getByRole('switch', { name: '言語切替' }).click()

      await expect(page.getByText('Article 1 (Application)')).toBeVisible()
      await expect(page.getByText('第1条（適用）')).not.toBeVisible()
    })

    test('トグルを再度切り替えると日本語版に戻る', async ({ page }) => {
      const toggle = page.getByRole('switch', { name: '言語切替' })

      await toggle.click()
      await expect(page.getByText('Article 1 (Application)')).toBeVisible()

      await toggle.click()
      await expect(page.getByText('第1条（適用）')).toBeVisible()
    })
  })

  test.describe('プライバシーポリシーの言語切替', () => {
    test.beforeEach(async ({ page }) => {
      // メニュー → プライバシーポリシーを開く
      await page.getByRole('button', { name: 'メニュー' }).click()
      await page.waitForTimeout(500) // メニューアニメーション待機
      await page.getByRole('button', { name: 'プライバシーポリシー' }).click()
      await expect(page.getByRole('heading', { name: 'プライバシーポリシー', exact: true })).toBeVisible({ timeout: 10000 })
    })

    test('初期表示は日本語である', async ({ page }) => {
      await expect(page.getByText('第1条（基本方針）')).toBeVisible()
    })

    test('言語トグルスイッチが表示される', async ({ page }) => {
      await expect(page.getByText('日本語')).toBeVisible()
      await expect(page.getByText('英語')).toBeVisible()
      await expect(page.getByRole('switch', { name: '言語切替' })).toBeVisible()
    })

    test('トグルを切り替えると英語版が表示される', async ({ page }) => {
      await page.getByRole('switch', { name: '言語切替' }).click()

      await expect(page.getByText('Article 1 (Basic Policy)')).toBeVisible()
      await expect(page.getByText('第1条（基本方針）')).not.toBeVisible()
    })

    test('トグルを再度切り替えると日本語版に戻る', async ({ page }) => {
      const toggle = page.getByRole('switch', { name: '言語切替' })

      await toggle.click()
      await expect(page.getByText('Article 1 (Basic Policy)')).toBeVisible()

      await toggle.click()
      await expect(page.getByText('第1条（基本方針）')).toBeVisible()
    })
  })
})
