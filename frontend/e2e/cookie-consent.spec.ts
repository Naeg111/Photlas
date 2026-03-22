import { test, expect } from '@playwright/test'

/**
 * Cookie同意バナーテスト（Issue#71: GDPR対応）
 * 同意/拒否ボタン、日英バイリンガル表示、再表示防止を確認
 */
test.describe('Cookie Consent Banner Tests', () => {
  test('初回アクセス時にCookie同意バナーが表示される', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000) // スプラッシュ画面待機

    const banner = page.getByTestId('cookie-consent-banner')
    await expect(banner).toBeVisible({ timeout: 5000 })

    // 日英両方の説明文が表示される
    await expect(page.getByText(/Google Analytics/)).toBeVisible()
    await expect(page.getByText(/service improvement/i)).toBeVisible()
  })

  test('「同意する / Accept」と「拒否する / Decline」ボタンが表示される', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)

    await expect(page.getByRole('button', { name: /同意する/ })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /拒否する/ })).toBeVisible()
  })

  test('「同意する」をクリックするとバナーが非表示になる', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)

    const banner = page.getByTestId('cookie-consent-banner')
    await expect(banner).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: /同意する/ }).click()

    await expect(banner).not.toBeVisible()
  })

  test('「拒否する」をクリックするとバナーが非表示になる', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)

    const banner = page.getByTestId('cookie-consent-banner')
    await expect(banner).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: /拒否する/ }).click()

    await expect(banner).not.toBeVisible()
  })

  test('同意後のリロードではバナーが表示されない', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)

    await expect(page.getByTestId('cookie-consent-banner')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /同意する/ }).click()

    await page.reload()
    await page.waitForTimeout(3000)

    await expect(page.getByTestId('cookie-consent-banner')).not.toBeVisible()
  })

  test('拒否後のリロードではバナーが表示されない', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)

    await expect(page.getByTestId('cookie-consent-banner')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /拒否する/ }).click()

    await page.reload()
    await page.waitForTimeout(3000)

    await expect(page.getByTestId('cookie-consent-banner')).not.toBeVisible()
  })

  test('バナーにプライバシーポリシーへのリンクが含まれる', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)

    await expect(page.getByTestId('cookie-consent-banner')).toBeVisible({ timeout: 5000 })

    const link = page.getByTestId('cookie-consent-banner').getByRole('link', { name: /プライバシーポリシー/ })
    await expect(link).toBeVisible()
  })
})
