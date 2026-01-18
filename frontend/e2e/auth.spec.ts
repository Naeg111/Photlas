import { test, expect } from '@playwright/test'

/**
 * 認証テスト
 * ログイン・新規登録のフォーム操作を確認
 */
test.describe('Authentication Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // スプラッシュ画面が消えるまで待機
    await page.waitForTimeout(3000)
  })

  test.describe('ログインフォーム', () => {
    test.beforeEach(async ({ page }) => {
      // メニューを開いてログインダイアログを表示
      await page.getByRole('button', { name: 'メニュー' }).click()
      await page.getByRole('button', { name: 'ログイン' }).click()
      // ダイアログが開くのを待機
      await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
    })

    test('ログインフォームが表示される', async ({ page }) => {
      // メールアドレス入力欄が表示されることを確認
      await expect(page.getByPlaceholder('example@photlas.com')).toBeVisible()
      // パスワード入力欄が表示されることを確認
      await expect(page.getByPlaceholder('パスワードを入力')).toBeVisible()
    })

    test('メールアドレスとパスワードを入力できる', async ({ page }) => {
      await page.getByPlaceholder('example@photlas.com').fill('test@example.com')
      await page.getByPlaceholder('パスワードを入力').fill('Password123')

      // 入力値が反映されていることを確認
      await expect(page.getByPlaceholder('example@photlas.com')).toHaveValue('test@example.com')
      await expect(page.getByPlaceholder('パスワードを入力')).toHaveValue('Password123')
    })

    test('パスワードの表示/非表示を切り替えられる', async ({ page }) => {
      const passwordInput = page.getByPlaceholder('パスワードを入力')
      await passwordInput.fill('Password123')

      // 初期状態ではパスワードが非表示（type="password"）
      await expect(passwordInput).toHaveAttribute('type', 'password')

      // 表示ボタンをクリック
      await page.getByRole('button', { name: 'パスワードを表示' }).click()

      // パスワードが表示される（type="text"）
      await expect(passwordInput).toHaveAttribute('type', 'text')
    })

    test('「ログイン状態を保持する」チェックボックスが機能する', async ({ page }) => {
      const checkbox = page.getByRole('checkbox')

      // 初期状態ではチェックされていない
      await expect(checkbox).not.toBeChecked()

      // クリックしてチェック
      await checkbox.click()
      await expect(checkbox).toBeChecked()
    })

    test('新規登録リンクから新規登録ダイアログに遷移できる', async ({ page }) => {
      // ダイアログ内の新規登録リンクをクリック
      await page.getByRole('button', { name: '新規登録' }).click()

      // 新規登録ダイアログが表示されることを確認
      await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()
    })
  })

  test.describe('新規登録フォーム', () => {
    test.beforeEach(async ({ page }) => {
      // メニューを開いて新規登録ダイアログを表示
      await page.getByRole('button', { name: 'メニュー' }).click()
      await page.getByRole('button', { name: '新規アカウント作成' }).click()
      // ダイアログが開くのを待機
      await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()
    })

    test('新規登録フォームが表示される', async ({ page }) => {
      // 表示名入力欄が表示されることを確認
      await expect(page.getByPlaceholder('山田太郎')).toBeVisible()
      // メールアドレス入力欄が表示されることを確認
      await expect(page.getByPlaceholder('example@photlas.com')).toBeVisible()
      // パスワード入力欄が表示されることを確認
      await expect(page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む')).toBeVisible()
    })

    test('フォームに入力できる', async ({ page }) => {
      await page.getByPlaceholder('山田太郎').fill('テストユーザー')
      await page.getByPlaceholder('example@photlas.com').fill('test@example.com')

      // 入力値が反映されていることを確認
      await expect(page.getByPlaceholder('山田太郎')).toHaveValue('テストユーザー')
      await expect(page.getByPlaceholder('example@photlas.com')).toHaveValue('test@example.com')
    })

    test('ログインリンクからログインダイアログに遷移できる', async ({ page }) => {
      // ダイアログ内のログインリンクをクリック
      await page.getByRole('button', { name: 'ログイン' }).click()

      // ログインダイアログが表示されることを確認
      await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
    })
  })
})
