import { test, expect } from '@playwright/test'

/**
 * 場所検索テスト（Issue#69）
 * 検索ボタン、検索ダイアログ、候補表示、地図移動を確認
 */
test.describe('Place Search Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cookie_consent_acknowledged', 'true'))
    await page.goto('/')
    await page.waitForTimeout(3000) // スプラッシュ画面待機
    // 地図が読み込まれるまで待機
    await expect(page.locator('.mapboxgl-map')).toBeVisible({ timeout: 10000 })
  })

  test('場所検索ボタンが表示される', async ({ page }) => {
    const searchButton = page.getByRole('button', { name: '場所検索' })
    await expect(searchButton).toBeVisible()
  })

  test('場所検索ボタンをクリックすると検索ダイアログが開く', async ({ page }) => {
    await page.getByRole('button', { name: '場所検索' }).click()

    // 検索ボックスが表示される
    await expect(page.getByPlaceholder('場所を検索')).toBeVisible()
  })

  test('検索ダイアログに半透明オーバーレイが表示される', async ({ page }) => {
    await page.getByRole('button', { name: '場所検索' }).click()

    // オーバーレイが表示される
    const overlay = page.getByTestId('search-overlay')
    await expect(overlay).toBeVisible()
  })

  test('オーバーレイをクリックすると検索ダイアログが閉じる', async ({ page }) => {
    await page.getByRole('button', { name: '場所検索' }).click()
    await expect(page.getByPlaceholder('場所を検索')).toBeVisible()

    // オーバーレイをクリック
    await page.getByTestId('search-overlay').click()

    // 検索ボックスが非表示になる
    await expect(page.getByPlaceholder('場所を検索')).not.toBeVisible()
  })

  test('検索ボックスに入力すると候補が表示される', async ({ page }) => {
    await page.getByRole('button', { name: '場所検索' }).click()

    const searchInput = page.getByPlaceholder('場所を検索')
    await searchInput.fill('東京')

    // 候補リストが表示されるまで待機（API応答 + デバウンス300ms）
    await expect(page.locator('button').filter({ hasText: /東京/ }).first()).toBeVisible({ timeout: 5000 })
  })

  test('候補を選択すると検索ダイアログが閉じる', async ({ page }) => {
    await page.getByRole('button', { name: '場所検索' }).click()

    const searchInput = page.getByPlaceholder('場所を検索')
    await searchInput.fill('東京タワー')

    // 候補が表示されるまで待機
    const suggestion = page.locator('button').filter({ hasText: /東京タワー/ }).first()
    await expect(suggestion).toBeVisible({ timeout: 5000 })

    // 候補をクリック
    await suggestion.click()

    // 検索ダイアログが閉じる
    await expect(page.getByPlaceholder('場所を検索')).not.toBeVisible()
  })

  test('検索ボックスが不透明な白色背景を持つ', async ({ page }) => {
    await page.getByRole('button', { name: '場所検索' }).click()

    const searchInput = page.getByPlaceholder('場所を検索')
    const bgColor = await searchInput.evaluate(el => el.style.backgroundColor)
    expect(bgColor).toBe('rgb(255, 255, 255)')
  })
})
