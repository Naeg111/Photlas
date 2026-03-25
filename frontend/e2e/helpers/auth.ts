import { Page, expect } from '@playwright/test'

/**
 * E2Eテスト用認証ヘルパー
 */

// テストで使用する定数
export const TEST_PASSWORD = 'TestPass123'
export const SPLASH_WAIT_MS = 3000
const TEST_API_KEY = 'e2e-test-api-key'

/**
 * バックエンドAPIのベースURLを取得
 * ステージング環境ではtest.photlas.jpのAPI、ローカルではlocalhost:8080を使用
 */
function getApiBaseUrl(page: Page): string {
  const baseURL = page.url()
  if (baseURL.includes('test.photlas.jp')) {
    return 'https://test.photlas.jp/api/v1'
  }
  return 'http://localhost:8080/api/v1'
}

/**
 * ユニークなメールアドレスを生成
 */
export function generateUniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@example.com`
}

/**
 * Cookie同意バナーが表示されないよう、ページ読み込み前に同意済み状態を設定
 * page.goto() の前に呼ぶこと
 */
export async function initCookieConsent(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'))
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
 * メール認証をバイパスする（テスト用内部APIを使用）
 */
export async function verifyEmailByApi(page: Page, email: string): Promise<void> {
  const apiBaseUrl = getApiBaseUrl(page)
  const response = await page.request.post(`${apiBaseUrl}/internal/test/verify-email`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': TEST_API_KEY,
    },
    data: { email },
  })
  if (!response.ok()) {
    throw new Error(`メール認証バイパスに失敗: ${response.status()} ${await response.text()}`)
  }
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
    // Cookie同意バナーが表示されないよう、同意済み状態を設定
    localStorage.setItem('cookie_consent', 'accepted')
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

  // トースト表示を待機（ステージング環境ではAPI応答が遅い場合がある）
  await expect(page.getByText('確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。')).toBeVisible({ timeout: 30000 })

  // メール認証をバイパス
  await verifyEmailByApi(page, email)

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
