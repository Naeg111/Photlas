import { test, expect, Page } from '@playwright/test'

/**
 * 認証フロー全体E2Eテスト（実連携版）
 *
 * テスト対象:
 * 1. 新規登録→ログイン→ログアウトの一連フロー
 * 2. JWTトークンの保存・削除
 * 3. 認証必須画面のアクセス制御
 * 4. 認証状態の永続化
 * 5. エッジケース（連続操作など）
 *
 * 前提条件:
 * - バックエンドが localhost:8080 で起動していること
 * - データベースが正常に接続されていること
 */

// テストで使用する定数
const VALID_PASSWORD = 'TestPass123'

/**
 * ユニークなメールアドレスを生成
 */
function generateUniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@example.com`
}

/**
 * ログインダイアログを開く共通処理
 */
async function openLoginDialog(page: Page) {
  await page.goto('/')
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: 'メニュー' }).click()
  await page.getByRole('button', { name: 'ログイン' }).click()
  await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
}

/**
 * 新規登録ダイアログを開く共通処理
 */
async function openSignUpDialog(page: Page) {
  await page.goto('/')
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: 'メニュー' }).click()
  await page.getByRole('button', { name: '新規アカウント作成' }).click()
  await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()
}

/**
 * ログインを実行する共通処理
 */
async function performLogin(
  page: Page,
  email: string,
  password: string,
  rememberMe: boolean = false
) {
  await page.getByPlaceholder('example@photlas.com').fill(email)
  await page.getByPlaceholder('パスワードを入力').fill(password)
  if (rememberMe) {
    // ログインダイアログ内の「ログイン状態を保持する」チェックボックスを特定
    await page.getByLabel('ログイン状態を保持する').check()
    // チェックボックス操作後に少し待機
    await page.waitForTimeout(100)
  }
  // ログインボタンが有効になっていることを確認してからクリック
  const loginButton = page.getByRole('button', { name: 'ログイン', exact: true })
  await expect(loginButton).toBeEnabled()
  await loginButton.click()
}

/**
 * フォームに有効な情報を入力して登録する共通処理
 */
async function fillValidFormAndSubmit(page: Page, email: string, password: string) {
  await page.getByPlaceholder('山田太郎').fill('テストユーザー')
  await page.getByPlaceholder('example@photlas.com').fill(email)
  await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill(password)
  await page.getByPlaceholder('パスワードを再入力').fill(password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '登録する' }).click()
}

/**
 * 認証済み状態を確認
 */
async function expectAuthenticated(page: Page) {
  await page.getByRole('button', { name: 'メニュー' }).click()
  await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
  await page.keyboard.press('Escape')
}

/**
 * 未認証状態を確認
 */
async function expectUnauthenticated(page: Page) {
  await page.getByRole('button', { name: 'メニュー' }).click()
  await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()
  await page.keyboard.press('Escape')
}

test.describe('認証フロー全体 E2Eテスト', () => {
  test.describe('E2Eシナリオ: 新規登録→ログイン→ログアウト', () => {
    test('新規登録後、同じ認証情報でログインできる', async ({ page }) => {
      const uniqueEmail = generateUniqueEmail('flow-signup-login')
      const password = VALID_PASSWORD

      // 1. 新規登録
      await openSignUpDialog(page)
      await fillValidFormAndSubmit(page, uniqueEmail, password)
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })

      // 2. ログイン
      await openLoginDialog(page)
      await performLogin(page, uniqueEmail, password)
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

      // 3. 認証済み状態を確認
      await expectAuthenticated(page)
    })

    test('ログアウト後、再度同じ認証情報でログインできる', async ({ page }) => {
      const uniqueEmail = generateUniqueEmail('flow-logout-relogin')
      const password = VALID_PASSWORD

      // 1. 新規登録
      await openSignUpDialog(page)
      await fillValidFormAndSubmit(page, uniqueEmail, password)
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })

      // 2. ログイン
      await openLoginDialog(page)
      await performLogin(page, uniqueEmail, password)
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

      // 3. ログアウト
      await page.getByRole('button', { name: 'メニュー' }).click()
      await page.getByRole('button', { name: 'ログアウト' }).click()

      // 4. 未認証状態を確認
      await expectUnauthenticated(page)

      // 5. 再度ログイン
      await openLoginDialog(page)
      await performLogin(page, uniqueEmail, password)
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

      // 6. 認証済み状態を確認
      await expectAuthenticated(page)
    })
  })

  test.describe('JWTトークン管理', () => {
    test('ログイン成功後、JWTトークンがlocalStorageに保存される（Remember Me ON）', async ({
      page,
    }) => {
      const uniqueEmail = generateUniqueEmail('flow-token-local')
      const password = VALID_PASSWORD

      // ユーザー作成
      await openSignUpDialog(page)
      await fillValidFormAndSubmit(page, uniqueEmail, password)
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })

      // ログイン（Remember Me ON）
      await openLoginDialog(page)
      await performLogin(page, uniqueEmail, password, true)
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

      // localStorageにトークンが保存されていることを確認
      const token = await page.evaluate(() => localStorage.getItem('auth_token'))
      expect(token).not.toBeNull()
      expect(token).toMatch(/^eyJ/) // JWTトークンの形式確認（eyJで始まる）
    })

    test('ログイン成功後、JWTトークンがsessionStorageに保存される（Remember Me OFF）', async ({
      page,
    }) => {
      const uniqueEmail = generateUniqueEmail('flow-token-session')
      const password = VALID_PASSWORD

      // ユーザー作成
      await openSignUpDialog(page)
      await fillValidFormAndSubmit(page, uniqueEmail, password)
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })

      // ログイン（Remember Me OFF）
      await openLoginDialog(page)
      await performLogin(page, uniqueEmail, password, false)
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

      // sessionStorageにトークンが保存されていることを確認
      const token = await page.evaluate(() => sessionStorage.getItem('auth_token'))
      expect(token).not.toBeNull()
      expect(token).toMatch(/^eyJ/)

      // localStorageには保存されていないことを確認
      const localToken = await page.evaluate(() => localStorage.getItem('auth_token'))
      expect(localToken).toBeNull()
    })

    test('ログアウト後、JWTトークンがストレージから削除される', async ({ page }) => {
      const uniqueEmail = generateUniqueEmail('flow-token-delete')
      const password = VALID_PASSWORD

      // 前のテストのストレージ状態を完全にクリア
      // まずabout:blankに移動してからストレージをクリアし、新しいセッションとして/に移動
      await page.goto('about:blank')
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      // ブラウザコンテキストのクッキーもクリア
      await page.context().clearCookies()
      // 新しいセッションとしてページに移動
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      // ユーザー作成
      await openSignUpDialog(page)
      await fillValidFormAndSubmit(page, uniqueEmail, password)
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 15000,
      })

      // ログイン
      await openLoginDialog(page)
      await performLogin(page, uniqueEmail, password, true)
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

      // トークンが保存されていることを確認
      let token = await page.evaluate(() => localStorage.getItem('auth_token'))
      expect(token).not.toBeNull()

      // ログアウト
      await page.getByRole('button', { name: 'メニュー' }).click()
      await page.getByRole('button', { name: 'ログアウト' }).click()

      // トークンが削除されていることを確認
      token = await page.evaluate(() => localStorage.getItem('auth_token'))
      expect(token).toBeNull()

      const sessionToken = await page.evaluate(() => sessionStorage.getItem('auth_token'))
      expect(sessionToken).toBeNull()
    })
  })

  test.describe('認証必須画面のアクセス制御', () => {
    test('未ログイン状態で写真投稿ボタンをクリックするとLoginRequiredDialogが表示される', async ({
      page,
    }) => {
      await page.goto('/')
      await page.waitForTimeout(3000)

      // 写真投稿ボタンをクリック
      await page.getByRole('button', { name: '投稿' }).click()

      // LoginRequiredDialogが表示されることを確認
      await expect(page.getByText('ログインが必要です')).toBeVisible({ timeout: 5000 })
    })

    test('LoginRequiredDialogの「ログイン」ボタンでLoginDialogが開く', async ({ page }) => {
      await page.goto('/')
      await page.waitForTimeout(3000)

      // 写真投稿ボタンをクリック
      await page.getByRole('button', { name: '投稿' }).click()

      // LoginRequiredDialogの「ログイン」ボタンをクリック
      await page.getByRole('button', { name: 'ログイン' }).click()

      // LoginDialogが開くことを確認
      await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
    })

    test('LoginRequiredDialogの「新規アカウント作成」ボタンでSignUpDialogが開く', async ({
      page,
    }) => {
      await page.goto('/')
      await page.waitForTimeout(3000)

      // 写真投稿ボタンをクリック
      await page.getByRole('button', { name: '投稿' }).click()

      // LoginRequiredDialogの「新規アカウント作成」ボタンをクリック
      await page.getByRole('button', { name: '新規アカウント作成' }).click()

      // SignUpDialogが開くことを確認
      await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()
    })
  })

  test.describe('認証状態の永続化', () => {
    test('ログイン状態でページリロード後も認証状態が維持される（localStorage使用時）', async ({
      page,
    }) => {
      const uniqueEmail = generateUniqueEmail('flow-persist')
      const password = VALID_PASSWORD

      // ユーザー作成
      await openSignUpDialog(page)
      await fillValidFormAndSubmit(page, uniqueEmail, password)
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })

      // ログイン（Remember Me ON）
      await openLoginDialog(page)
      await performLogin(page, uniqueEmail, password, true)
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

      // ページリロード
      await page.reload()
      await page.waitForTimeout(3000)

      // 認証状態が維持されていることを確認
      await expectAuthenticated(page)
    })
  })

  test.describe('エッジケース', () => {
    test('登録直後のユーザーでログインできる（登録とログインの連続実行）', async ({
      page,
    }) => {
      const uniqueEmail = generateUniqueEmail('flow-immediate-login')
      const password = VALID_PASSWORD

      // 1. 新規登録
      await openSignUpDialog(page)
      await fillValidFormAndSubmit(page, uniqueEmail, password)
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })

      // 2. すぐにログイン
      await openLoginDialog(page)
      await performLogin(page, uniqueEmail, password)

      // ログインが成功することを確認
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })
    })

    test('複数回のログイン/ログアウトを繰り返しても正常に動作する', async ({ page }) => {
      const uniqueEmail = generateUniqueEmail('flow-multiple-auth')
      const password = VALID_PASSWORD

      // ユーザー作成
      await openSignUpDialog(page)
      await fillValidFormAndSubmit(page, uniqueEmail, password)
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })

      // 3回ログイン/ログアウトを繰り返す
      for (let i = 0; i < 3; i++) {
        // ログイン
        await openLoginDialog(page)
        await performLogin(page, uniqueEmail, password)
        await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

        // 認証済み状態を確認
        await expectAuthenticated(page)

        // ログアウト
        await page.getByRole('button', { name: 'メニュー' }).click()
        await page.getByRole('button', { name: 'ログアウト' }).click()

        // 未認証状態を確認
        await expectUnauthenticated(page)
      }
    })
  })
})
