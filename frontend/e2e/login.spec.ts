import { test, expect, Page } from '@playwright/test'

/**
 * ログイン機能E2Eテスト（実連携版）
 *
 * テスト対象:
 * 1. 正しい認証情報でログインが成功すること
 * 2. ログイン後の認証済みUI表示
 * 3. ログアウト機能
 * 4. セッション保持（Remember Me）
 * 5. ログイン失敗時のエラー表示
 * 6. ダイアログ間の遷移
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
  // スプラッシュ画面が消えるまで待機
  await page.waitForTimeout(3000)
  // メニューを開いてログインダイアログを表示
  await page.getByRole('button', { name: 'メニュー' }).click()
  await page.getByRole('button', { name: 'ログイン' }).click()
  // ダイアログが開くのを待機
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
    await page.getByRole('checkbox').check()
  }
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
}

/**
 * アカウントを作成する共通処理
 */
async function createAccount(page: Page, email: string, password: string) {
  await openSignUpDialog(page)
  await page.getByPlaceholder('山田太郎').fill('テストユーザー')
  await page.getByPlaceholder('example@photlas.com').fill(email)
  await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill(password)
  await page.getByPlaceholder('パスワードを再入力').fill(password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '登録する' }).click()
  await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({ timeout: 10000 })
}

/**
 * 認証済み状態を確認
 */
async function expectAuthenticated(page: Page) {
  await page.getByRole('button', { name: 'メニュー' }).click()
  await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
  // メニューを閉じる
  await page.keyboard.press('Escape')
}

/**
 * 未認証状態を確認
 */
async function expectUnauthenticated(page: Page) {
  await page.getByRole('button', { name: 'メニュー' }).click()
  await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()
  // メニューを閉じる
  await page.keyboard.press('Escape')
}

test.describe('ログイン機能 E2Eテスト', () => {
  const testUserPassword = VALID_PASSWORD

  test.describe('正常系: ログイン', () => {
    test('正しい認証情報でログインが成功する', async ({ page }) => {
      // テスト用ユーザーを作成
      const testUserEmail = generateUniqueEmail('login-success')
      await createAccount(page, testUserEmail, testUserPassword)

      // ログイン
      await openLoginDialog(page)
      await performLogin(page, testUserEmail, testUserPassword)

      // 成功トーストが表示されることを確認
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

      // ダイアログが閉じることを確認
      await expect(page.getByRole('heading', { name: 'ログイン' })).not.toBeVisible()
    })

    test('ログイン成功後、認証済みUIが表示される', async ({ page }) => {
      const testUserEmail = generateUniqueEmail('login-auth-ui')
      await createAccount(page, testUserEmail, testUserPassword)

      await openLoginDialog(page)
      await performLogin(page, testUserEmail, testUserPassword)
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

      // 認証済み状態を確認
      await expectAuthenticated(page)
    })
  })

  test.describe('正常系: ログアウト', () => {
    test('ログイン状態からログアウトが成功する', async ({ page }) => {
      const testUserEmail = generateUniqueEmail('logout-success')
      await createAccount(page, testUserEmail, testUserPassword)

      // ログイン
      await openLoginDialog(page)
      await performLogin(page, testUserEmail, testUserPassword)
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

      // ログアウト
      await page.getByRole('button', { name: 'メニュー' }).click()
      await page.getByRole('button', { name: 'ログアウト' }).click()

      // 未認証状態に戻ることを確認
      await expectUnauthenticated(page)
    })
  })

  test.describe('正常系: セッション保持', () => {
    test('「ログイン状態を保持する」ONでページリロード後も認証状態が維持される', async ({
      page,
    }) => {
      const testUserEmail = generateUniqueEmail('session-persist')
      await createAccount(page, testUserEmail, testUserPassword)

      await openLoginDialog(page)
      await performLogin(page, testUserEmail, testUserPassword, true) // rememberMe=true
      await expect(page.getByText('ログインしました')).toBeVisible({ timeout: 10000 })

      // ページリロード
      await page.reload()
      await page.waitForTimeout(3000)

      // 認証状態が維持されていることを確認
      await expectAuthenticated(page)
    })
  })

  test.describe('異常系: ログイン失敗', () => {
    test('間違ったパスワードでログインが失敗する', async ({ page }) => {
      const testUserEmail = generateUniqueEmail('login-wrong-pass')
      await createAccount(page, testUserEmail, testUserPassword)

      await openLoginDialog(page)
      await performLogin(page, testUserEmail, 'WrongPass123')

      // エラーメッセージが表示されることを確認
      await expect(
        page.getByText('メールアドレスまたはパスワードが正しくありません')
      ).toBeVisible({ timeout: 10000 })

      // ダイアログが閉じないことを確認
      await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
    })

    test('存在しないメールアドレスでログインが失敗する', async ({ page }) => {
      await openLoginDialog(page)
      await performLogin(page, 'nonexistent@example.com', testUserPassword)

      // エラーメッセージが表示されることを確認
      await expect(
        page.getByText('メールアドレスまたはパスワードが正しくありません')
      ).toBeVisible({ timeout: 10000 })

      // ダイアログが閉じないことを確認
      await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
    })
  })

  test.describe('バリデーションエラー', () => {
    test('メールアドレスとパスワードが空の場合、エラーメッセージが表示される', async ({
      page,
    }) => {
      await openLoginDialog(page)

      // 何も入力せずにログインボタンをクリック
      await page.getByRole('button', { name: 'ログイン', exact: true }).click()

      // エラーメッセージが表示されることを確認
      await expect(page.getByText('メールアドレスとパスワードを入力してください')).toBeVisible()
    })

    test('メールアドレスのみ入力でエラーメッセージが表示される', async ({ page }) => {
      await openLoginDialog(page)

      await page.getByPlaceholder('example@photlas.com').fill('test@example.com')
      await page.getByRole('button', { name: 'ログイン', exact: true }).click()

      await expect(page.getByText('メールアドレスとパスワードを入力してください')).toBeVisible()
    })

    test('パスワードのみ入力でエラーメッセージが表示される', async ({ page }) => {
      await openLoginDialog(page)

      await page.getByPlaceholder('パスワードを入力').fill('TestPass123')
      await page.getByRole('button', { name: 'ログイン', exact: true }).click()

      await expect(page.getByText('メールアドレスとパスワードを入力してください')).toBeVisible()
    })
  })

  test.describe('フォーム状態', () => {
    test('パスワードの表示/非表示切り替えが正常に動作する', async ({ page }) => {
      await openLoginDialog(page)

      const passwordInput = page.getByPlaceholder('パスワードを入力')
      await passwordInput.fill('TestPass123')

      // 初期状態ではパスワードが非表示
      await expect(passwordInput).toHaveAttribute('type', 'password')

      // 表示ボタンをクリック
      await page.getByRole('button', { name: 'パスワードを表示' }).click()

      // パスワードが表示される
      await expect(passwordInput).toHaveAttribute('type', 'text')

      // 非表示ボタンをクリック
      await page.getByRole('button', { name: 'パスワードを非表示' }).click()

      // パスワードが非表示に戻る
      await expect(passwordInput).toHaveAttribute('type', 'password')
    })

    test('「ログイン状態を保持する」チェックボックスが正常に動作する', async ({ page }) => {
      await openLoginDialog(page)

      const checkbox = page.getByRole('checkbox')

      // 初期状態ではチェックされていない
      await expect(checkbox).not.toBeChecked()

      // チェックする
      await checkbox.click()
      await expect(checkbox).toBeChecked()

      // チェックを外す
      await checkbox.click()
      await expect(checkbox).not.toBeChecked()
    })
  })

  test.describe('ダイアログ遷移', () => {
    test('「新規登録」リンクをクリックするとSignUpDialogが開く', async ({ page }) => {
      await openLoginDialog(page)

      // 新規登録リンクをクリック
      await page.getByRole('button', { name: '新規登録' }).click()

      // SignUpDialogが開くことを確認
      await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()

      // LoginDialogが閉じていることを確認
      await expect(page.getByRole('heading', { name: 'ログイン' })).not.toBeVisible()
    })

    test('「パスワードをお忘れですか？」リンクをクリックするとPasswordResetDialogが開く', async ({
      page,
    }) => {
      await openLoginDialog(page)

      // パスワードリセットリンクをクリック
      await page.getByRole('button', { name: 'パスワードをお忘れですか？' }).click()

      // PasswordResetDialogが開くことを確認（ダイアログのタイトルを確認）
      await expect(page.getByRole('heading', { name: 'パスワードリセット' })).toBeVisible()

      // LoginDialogが閉じていることを確認
      await expect(page.getByRole('heading', { name: 'ログイン' })).not.toBeVisible()
    })
  })
})
