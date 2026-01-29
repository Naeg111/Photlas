import { Page, expect } from '@playwright/test'

/**
 * E2Eテスト用認証ヘルパー
 */

// テストで使用する定数
export const TEST_PASSWORD = 'TestPass123'
export const SPLASH_WAIT_MS = 3000

/**
 * ユニークなメールアドレスを生成
 */
export function generateUniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@example.com`
}

/**
 * スプラッシュ画面の終了を待機
 */
export async function waitForSplash(page: Page): Promise<void> {
  await page.waitForTimeout(SPLASH_WAIT_MS)
}

/**
 * ログインダイアログを開く
 */
export async function openLoginDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'メニュー' }).click()
  await page.getByRole('button', { name: 'ログイン' }).click()
  await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
}

/**
 * 新規登録ダイアログを開く
 */
export async function openSignUpDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'メニュー' }).click()
  await page.getByRole('button', { name: '新規アカウント作成' }).click()
  await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()
}

/**
 * ログインを実行
 */
export async function performLogin(
  page: Page,
  email: string,
  password: string,
  rememberMe: boolean = true
): Promise<void> {
  await page.getByPlaceholder('example@photlas.com').fill(email)
  await page.getByPlaceholder('パスワードを入力').fill(password)
  if (rememberMe) {
    await page.getByLabel('ログイン状態を保持する').check()
    await page.waitForTimeout(100)
  }
  const loginButton = page.getByRole('button', { name: 'ログイン', exact: true })
  await expect(loginButton).toBeEnabled()
  await loginButton.click()
}

/**
 * 新規登録を実行
 */
export async function performSignUp(
  page: Page,
  email: string,
  password: string,
  displayName: string = 'テストユーザー'
): Promise<void> {
  await page.getByPlaceholder('山田太郎').fill(displayName)
  await page.getByPlaceholder('example@photlas.com').fill(email)
  await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill(password)
  await page.getByPlaceholder('パスワードを再入力').fill(password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '登録する' }).click()
}

/**
 * 認証済み状態を確認
 */
export async function expectAuthenticated(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'メニュー' }).click()
  await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
  await page.keyboard.press('Escape')
}

/**
 * 未認証状態を確認
 */
export async function expectUnauthenticated(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'メニュー' }).click()
  await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()
  await page.keyboard.press('Escape')
}

/**
 * ログアウトを実行
 */
export async function performLogout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'メニュー' }).click()
  await page.getByRole('button', { name: 'ログアウト' }).click()
}

/**
 * ローカルストレージとセッションストレージをクリア
 */
export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

/**
 * 新規アカウントを作成してログイン状態にする
 */
export async function createAccountAndLogin(
  page: Page,
  emailPrefix: string = 'e2e-test'
): Promise<string> {
  const email = generateUniqueEmail(emailPrefix)

  await openSignUpDialog(page)
  await performSignUp(page, email, TEST_PASSWORD)

  // トースト表示を待機
  await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({ timeout: 10000 })

  // ログインダイアログに切り替わるのを待機
  await page.waitForTimeout(1000)

  // ログインを実行
  await openLoginDialog(page)
  await performLogin(page, email, TEST_PASSWORD)

  // 認証状態を確認
  await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)

  return email
}
