import { test, expect } from '@playwright/test'

/**
 * Cookie同意バナーテスト（Issue#60）
 * バナー表示、承認、再表示防止を確認
 */
test.describe('Cookie Consent Banner Tests', () => {
  test('初回アクセス時にCookie同意バナーが表示される', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000) // スプラッシュ画面待機

    // 同意バナーが表示される
    const banner = page.getByTestId('cookie-consent-banner')
    await expect(banner).toBeVisible({ timeout: 5000 })

    // Google Analyticsに関する説明文が表示される
    await expect(page.getByText(/Google Analytics/)).toBeVisible()

    // OKボタンが表示される
    await expect(page.getByRole('button', { name: 'OK' })).toBeVisible()
  })

  test('OKボタンをクリックするとバナーが非表示になる', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)

    const banner = page.getByTestId('cookie-consent-banner')
    await expect(banner).toBeVisible({ timeout: 5000 })

    // OKボタンをクリック
    await page.getByRole('button', { name: 'OK' }).click()

    // バナーが非表示になる
    await expect(banner).not.toBeVisible()
  })

  test('OKクリック後のリロードではバナーが表示されない', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)

    // 同意する
    const banner = page.getByTestId('cookie-consent-banner')
    await expect(banner).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'OK' }).click()
    await expect(banner).not.toBeVisible()

    // ページをリロード
    await page.reload()
    await page.waitForTimeout(3000)

    // バナーが表示されない
    await expect(page.getByTestId('cookie-consent-banner')).not.toBeVisible()
  })

  test('バナーにプライバシーポリシーへのリンクが含まれる', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)

    await expect(page.getByTestId('cookie-consent-banner')).toBeVisible({ timeout: 5000 })

    // プライバシーポリシーリンクが存在する
    const link = page.getByTestId('cookie-consent-banner').getByRole('link', { name: /プライバシーポリシー/ })
    await expect(link).toBeVisible()
  })
})
