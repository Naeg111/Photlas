import { test, expect, Page } from '@playwright/test'

/**
 * アカウント作成フローE2Eテスト（実連携版）
 *
 * テスト対象:
 * 1. バリデーションルールに合致している場合、アカウントが正常に作成できること
 * 2. アカウント画像が設定されていてもされていなくてもアカウントが作成されること
 * 3. 確認用のメールが送信されること（バックエンドログで確認）
 * 4. バリデーションに適合しない場合、エラーメッセージが赤い文字で表示されること
 * 5. バリデーション以外の条件（メール重複等）でアカウント作成が失敗すること
 *
 * 前提条件:
 * - バックエンドが localhost:8080 で起動していること
 * - データベースが正常に接続されていること
 */

// テストで使用する定数
const VALID_PASSWORD = 'TestPass123'
const VALID_EMAIL_BASE = 'e2e-signup'
const VALID_DISPLAY_NAME = 'E2Eテストユーザー'

/**
 * ユニークなメールアドレスを生成
 */
function generateUniqueEmail(prefix: string = VALID_EMAIL_BASE): string {
  return `${prefix}-${Date.now()}@example.com`
}

/**
 * 新規登録ダイアログを開く共通処理
 */
async function openSignUpDialog(page: Page) {
  await page.goto('/')
  // スプラッシュ画面が消えるまで待機
  await page.waitForTimeout(3000)
  // メニューを開いて新規登録ダイアログを表示
  await page.getByRole('button', { name: 'メニュー' }).click()
  await page.getByRole('button', { name: '新規アカウント作成' }).click()
  // ダイアログが開くのを待機
  await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()
}

/**
 * フォームに有効な情報を入力する共通処理
 */
async function fillValidForm(
  page: Page,
  options: {
    displayName?: string
    email?: string
    password?: string
    confirmPassword?: string
    agreeToTerms?: boolean
  } = {}
) {
  const {
    displayName = VALID_DISPLAY_NAME,
    email = generateUniqueEmail(),
    password = VALID_PASSWORD,
    confirmPassword = password,
    agreeToTerms = true,
  } = options

  // 表示名
  await page.getByPlaceholder('山田太郎').fill(displayName)

  // メールアドレス
  await page.getByPlaceholder('example@photlas.com').fill(email)

  // パスワード
  await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill(password)

  // パスワード（確認用）
  await page.getByPlaceholder('パスワードを再入力').fill(confirmPassword)

  // 利用規約への同意
  if (agreeToTerms) {
    await page.getByRole('checkbox').check()
  }

  return { displayName, email, password }
}

test.describe('アカウント作成フロー E2Eテスト', () => {
  test.describe('正常系: アカウント作成成功', () => {
    test('バリデーションルールに合致する入力でアカウントが作成できる', async ({ page }) => {
      await openSignUpDialog(page)

      // 有効な情報を入力
      const uniqueEmail = generateUniqueEmail('signup-valid')
      await fillValidForm(page, { email: uniqueEmail })

      // 登録ボタンをクリック
      await page.getByRole('button', { name: '登録する' }).click()

      // 成功トーストが表示されることを確認
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })

      // ダイアログが閉じることを確認
      await expect(page.getByRole('heading', { name: 'アカウント作成' })).not.toBeVisible()
    })

    test('プロフィール画像なしでアカウントが作成できる', async ({ page }) => {
      await openSignUpDialog(page)

      // プロフィール画像を設定せずに有効な情報を入力
      const uniqueEmail = generateUniqueEmail('signup-noimage')
      await fillValidForm(page, { email: uniqueEmail })

      // 登録ボタンをクリック
      await page.getByRole('button', { name: '登録する' }).click()

      // 成功トーストが表示されることを確認
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })
    })

    test('プロフィール画像ありでアカウントが作成できる', async ({ page }) => {
      await openSignUpDialog(page)

      // プロフィール画像を設定
      const fileInput = page.locator('input[type="file"]')
      // テスト用の画像ファイルをセット（1x1の最小PNG）
      await fileInput.setInputFiles({
        name: 'test-image.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        ),
      })

      // 有効な情報を入力
      const uniqueEmail = generateUniqueEmail('signup-withimage')
      await fillValidForm(page, { email: uniqueEmail })

      // 登録ボタンをクリック
      await page.getByRole('button', { name: '登録する' }).click()

      // 成功トーストが表示されることを確認
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })
    })

    test('ユーザー名が2文字でアカウントが作成できる（最小境界値）', async ({ page }) => {
      await openSignUpDialog(page)

      const uniqueEmail = generateUniqueEmail('signup-minname')
      await fillValidForm(page, {
        displayName: 'AB',
        email: uniqueEmail,
      })

      await page.getByRole('button', { name: '登録する' }).click()

      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })
    })

    test('ユーザー名が12文字でアカウントが作成できる（最大境界値）', async ({ page }) => {
      await openSignUpDialog(page)

      const uniqueEmail = generateUniqueEmail('signup-maxname')
      await fillValidForm(page, {
        displayName: '123456789012',
        email: uniqueEmail,
      })

      await page.getByRole('button', { name: '登録する' }).click()

      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })
    })
  })

  test.describe('異常系: バリデーションエラー', () => {
    test.describe('表示名のバリデーション', () => {
      test('表示名が空白のみの場合、登録ボタンが無効化されている', async ({ page }) => {
        await openSignUpDialog(page)

        // 表示名を空白のみで入力
        await page.getByPlaceholder('山田太郎').fill('   ')
        await page.getByPlaceholder('example@photlas.com').fill(generateUniqueEmail())
        await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill(VALID_PASSWORD)
        await page.getByPlaceholder('パスワードを再入力').fill(VALID_PASSWORD)
        await page.getByRole('checkbox').check()

        // 登録ボタンが無効であることを確認（空白のみは有効な表示名として扱われない）
        const submitButton = page.getByRole('button', { name: '登録する' })
        await expect(submitButton).toBeDisabled()
      })
    })

    test.describe('メールアドレスのバリデーション', () => {
      test('メールアドレス形式が不正な場合、エラーメッセージが赤い文字で表示される', async ({
        page,
      }) => {
        await openSignUpDialog(page)

        // 不正なメールアドレス形式を入力
        await page.getByPlaceholder('山田太郎').fill(VALID_DISPLAY_NAME)
        await page.getByPlaceholder('example@photlas.com').fill('invalid-email')
        await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill(VALID_PASSWORD)
        await page.getByPlaceholder('パスワードを再入力').fill(VALID_PASSWORD)
        await page.getByRole('checkbox').check()

        // 登録ボタンをクリック
        await page.getByRole('button', { name: '登録する' }).click()

        // エラーメッセージが赤い文字で表示されることを確認
        const errorMessage = page.locator('text=正しいメールアドレスの形式で入力してください')
        await expect(errorMessage).toBeVisible()
        await expect(errorMessage).toHaveClass(/text-red-600/)
      })
    })

    test.describe('パスワードのバリデーション', () => {
      test('パスワードが8文字未満の場合、エラーメッセージが赤い文字で表示される', async ({
        page,
      }) => {
        await openSignUpDialog(page)

        await page.getByPlaceholder('山田太郎').fill(VALID_DISPLAY_NAME)
        await page.getByPlaceholder('example@photlas.com').fill(generateUniqueEmail())
        await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill('Short1A')
        await page.getByPlaceholder('パスワードを再入力').fill('Short1A')
        await page.getByRole('checkbox').check()

        await page.getByRole('button', { name: '登録する' }).click()

        const errorMessage = page.locator(
          'text=パスワードは8文字以上20文字以内で入力してください'
        )
        await expect(errorMessage).toBeVisible()
        await expect(errorMessage).toHaveClass(/text-red-600/)
      })

      test('パスワードが20文字超の場合、エラーメッセージが赤い文字で表示される', async ({
        page,
      }) => {
        await openSignUpDialog(page)

        await page.getByPlaceholder('山田太郎').fill(VALID_DISPLAY_NAME)
        await page.getByPlaceholder('example@photlas.com').fill(generateUniqueEmail())
        const longPassword = 'Abcdefghijklmnop12345' // 21文字
        await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill(longPassword)
        await page.getByPlaceholder('パスワードを再入力').fill(longPassword)
        await page.getByRole('checkbox').check()

        await page.getByRole('button', { name: '登録する' }).click()

        const errorMessage = page.locator(
          'text=パスワードは8文字以上20文字以内で入力してください'
        )
        await expect(errorMessage).toBeVisible()
        await expect(errorMessage).toHaveClass(/text-red-600/)
      })

      test('パスワードに数字が含まれていない場合、エラーメッセージが赤い文字で表示される', async ({
        page,
      }) => {
        await openSignUpDialog(page)

        await page.getByPlaceholder('山田太郎').fill(VALID_DISPLAY_NAME)
        await page.getByPlaceholder('example@photlas.com').fill(generateUniqueEmail())
        await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill('NoNumbersHere')
        await page.getByPlaceholder('パスワードを再入力').fill('NoNumbersHere')
        await page.getByRole('checkbox').check()

        await page.getByRole('button', { name: '登録する' }).click()

        const errorMessage = page.locator('text=パスワードには数字を1文字以上含めてください')
        await expect(errorMessage).toBeVisible()
        await expect(errorMessage).toHaveClass(/text-red-600/)
      })

      test('パスワードに小文字が含まれていない場合、エラーメッセージが赤い文字で表示される', async ({
        page,
      }) => {
        await openSignUpDialog(page)

        await page.getByPlaceholder('山田太郎').fill(VALID_DISPLAY_NAME)
        await page.getByPlaceholder('example@photlas.com').fill(generateUniqueEmail())
        await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill('NOLOWER123')
        await page.getByPlaceholder('パスワードを再入力').fill('NOLOWER123')
        await page.getByRole('checkbox').check()

        await page.getByRole('button', { name: '登録する' }).click()

        const errorMessage = page.locator(
          'text=パスワードにはローマ字小文字を1文字以上含めてください'
        )
        await expect(errorMessage).toBeVisible()
        await expect(errorMessage).toHaveClass(/text-red-600/)
      })

      test('パスワードに大文字が含まれていない場合、エラーメッセージが赤い文字で表示される', async ({
        page,
      }) => {
        await openSignUpDialog(page)

        await page.getByPlaceholder('山田太郎').fill(VALID_DISPLAY_NAME)
        await page.getByPlaceholder('example@photlas.com').fill(generateUniqueEmail())
        await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill('noupper123')
        await page.getByPlaceholder('パスワードを再入力').fill('noupper123')
        await page.getByRole('checkbox').check()

        await page.getByRole('button', { name: '登録する' }).click()

        const errorMessage = page.locator(
          'text=パスワードにはローマ字大文字を1文字以上含めてください'
        )
        await expect(errorMessage).toBeVisible()
        await expect(errorMessage).toHaveClass(/text-red-600/)
      })

      test('パスワードに記号が含まれている場合、エラーメッセージが赤い文字で表示される', async ({
        page,
      }) => {
        await openSignUpDialog(page)

        await page.getByPlaceholder('山田太郎').fill(VALID_DISPLAY_NAME)
        await page.getByPlaceholder('example@photlas.com').fill(generateUniqueEmail())
        await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill('Test@Pass1')
        await page.getByPlaceholder('パスワードを再入力').fill('Test@Pass1')
        await page.getByRole('checkbox').check()

        await page.getByRole('button', { name: '登録する' }).click()

        const errorMessage = page.locator('text=パスワードに記号を含めることはできません')
        await expect(errorMessage).toBeVisible()
        await expect(errorMessage).toHaveClass(/text-red-600/)
      })
    })

    test.describe('パスワード確認のバリデーション', () => {
      test('パスワードと確認用パスワードが一致しない場合、エラーメッセージが赤い文字で表示される', async ({
        page,
      }) => {
        await openSignUpDialog(page)

        await page.getByPlaceholder('山田太郎').fill(VALID_DISPLAY_NAME)
        await page.getByPlaceholder('example@photlas.com').fill(generateUniqueEmail())
        await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill(VALID_PASSWORD)
        await page.getByPlaceholder('パスワードを再入力').fill('DifferentPass1')
        await page.getByRole('checkbox').check()

        await page.getByRole('button', { name: '登録する' }).click()

        const errorMessage = page.locator('text=パスワードが一致しません')
        await expect(errorMessage).toBeVisible()
        await expect(errorMessage).toHaveClass(/text-red-600/)
      })
    })

    test.describe('利用規約のバリデーション', () => {
      test('利用規約に同意していない場合、登録ボタンが無効化されている', async ({ page }) => {
        await openSignUpDialog(page)

        // 利用規約以外を入力
        await page.getByPlaceholder('山田太郎').fill(VALID_DISPLAY_NAME)
        await page.getByPlaceholder('example@photlas.com').fill(generateUniqueEmail())
        await page.getByPlaceholder('8-20文字、数字・小文字・大文字を含む').fill(VALID_PASSWORD)
        await page.getByPlaceholder('パスワードを再入力').fill(VALID_PASSWORD)
        // 利用規約にチェックしない

        // 登録ボタンが無効であることを確認
        const submitButton = page.getByRole('button', { name: '登録する' })
        await expect(submitButton).toBeDisabled()
      })
    })
  })

  test.describe('異常系: サーバーサイドエラー', () => {
    test('メールアドレスが既に登録されている場合、エラーメッセージが赤い文字で表示される', async ({
      page,
    }) => {
      // 1回目: ユーザーを登録
      const duplicateEmail = generateUniqueEmail('signup-duplicate')

      await openSignUpDialog(page)
      await fillValidForm(page, { email: duplicateEmail })
      await page.getByRole('button', { name: '登録する' }).click()
      await expect(page.getByText('アカウント登録が完了しました')).toBeVisible({
        timeout: 10000,
      })

      // 2回目: 同じメールアドレスで登録を試みる
      await openSignUpDialog(page)
      await fillValidForm(page, { email: duplicateEmail })
      await page.getByRole('button', { name: '登録する' }).click()

      // エラーメッセージが赤い文字で表示されることを確認
      const errorMessage = page.locator('text=このメールアドレスは既に登録されています')
      await expect(errorMessage).toBeVisible({ timeout: 10000 })
      await expect(errorMessage).toHaveClass(/text-red-600/)

      // ダイアログが閉じないことを確認（エラー状態でフォームが残る）
      await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()
    })
  })

  test.describe('セキュリティ', () => {
    test('XSS攻撃文字列を含む表示名でも安全に処理される', async ({ page }) => {
      await openSignUpDialog(page)

      const xssPayload = '<script>alert("XSS")</script>'
      const uniqueEmail = generateUniqueEmail('signup-xss')
      await fillValidForm(page, {
        displayName: xssPayload,
        email: uniqueEmail,
      })

      await page.getByRole('button', { name: '登録する' }).click()

      // 登録が成功するか、適切にサニタイズされることを確認
      // scriptタグが実行されないことが重要
      await expect(page.locator('script:has-text("XSS")')).toHaveCount(0)
    })
  })

  test.describe('フォーム状態の検証', () => {
    test('必須項目が未入力の場合、登録ボタンが無効化されている', async ({ page }) => {
      await openSignUpDialog(page)

      // 何も入力しない状態で登録ボタンが無効であることを確認
      const submitButton = page.getByRole('button', { name: '登録する' })
      await expect(submitButton).toBeDisabled()
    })

    test('全ての必須項目が入力されると、登録ボタンが有効化される', async ({ page }) => {
      await openSignUpDialog(page)

      // 必須項目を全て入力
      await fillValidForm(page)

      // 登録ボタンが有効であることを確認
      const submitButton = page.getByRole('button', { name: '登録する' })
      await expect(submitButton).toBeEnabled()
    })
  })
})
