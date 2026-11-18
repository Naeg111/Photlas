import { test, expect, Page } from '@playwright/test'
import {
  initCookieConsent,
  waitForSplash,
  openSignUpDialog,
  fillSignUpForm,
  performSignUp,
  SIGN_UP_HEADING,
  SIGN_UP_CONSENT_CHECKBOXES,
} from './helpers/auth'

/**
 * アカウント作成フローE2Eテスト（実連携版）
 *
 * テスト対象:
 * 1. バリデーションルールに合致している場合、アカウントが正常に作成できること
 * 2. アカウント画像が設定されていてもされていなくてもアカウントが作成されること
 * 3. 確認用のメールが送信されること（成功のお知らせで確認）
 * 4. バリデーションに適合しない場合、エラーメッセージが赤い文字で表示されること
 * 5. バリデーション以外の条件（メール重複等）でアカウント作成が失敗すること
 *
 * 前提条件:
 * - バックエンドが localhost:8080 で起動していること
 * - データベースが正常に接続されていること
 * - 確認メールを送れること（ローカルでは localhost:1025 で SMTP を受け付けるものが必要）
 */

// テストで使用する定数
const VALID_PASSWORD = 'TestPass123'
const VALID_EMAIL_BASE = 'e2e-signup'
const VALID_DISPLAY_NAME = 'E2Eテスト'
const SIGN_UP_SUCCESS_MESSAGE = '確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。'
const PLACEHOLDER = {
  displayName: '山田太郎、半角・全角12文字以内',
  email: 'example@photlas.com',
  password: '例: Abcde123',
  confirmPassword: 'パスワードを再入力',
} as const

/**
 * ユニークなメールアドレスを生成
 */
function generateUniqueEmail(prefix: string = VALID_EMAIL_BASE): string {
  return `${prefix}-${Date.now()}@example.com`
}

/**
 * トップページを開き、新規登録ダイアログを表示する
 */
async function openSignUpPage(page: Page) {
  await initCookieConsent(page)
  await page.goto('/')
  await waitForSplash(page)
  await openSignUpDialog(page)
}

/**
 * フォームに入力する共通処理（同意のチェックボックスは、指定したもの以外すべて入れる）
 */
async function fillValidForm(
  page: Page,
  options: {
    displayName?: string
    email?: string
    password?: string
    confirmPassword?: string
    /** チェックを入れない同意のチェックボックス */
    skipConsent?: keyof typeof SIGN_UP_CONSENT_CHECKBOXES
  } = {}
) {
  const {
    displayName = VALID_DISPLAY_NAME,
    email = generateUniqueEmail(),
    password = VALID_PASSWORD,
    confirmPassword = password,
    skipConsent,
  } = options

  await page.getByPlaceholder(PLACEHOLDER.displayName).fill(displayName)
  await page.getByPlaceholder(PLACEHOLDER.email).fill(email)
  await page.getByPlaceholder(PLACEHOLDER.password).fill(password)
  await page.getByPlaceholder(PLACEHOLDER.confirmPassword).fill(confirmPassword)
  for (const [key, selector] of Object.entries(SIGN_UP_CONSENT_CHECKBOXES)) {
    if (key !== skipConsent) {
      await page.locator(selector).check()
    }
  }

  return { displayName, email, password }
}

/**
 * 登録ボタンを押し、指定したエラーメッセージが赤い文字で表示されることを確かめる
 */
async function submitAndExpectError(page: Page, message: string) {
  await page.getByRole('button', { name: '登録する' }).click()
  const errorMessage = page.getByText(message, { exact: true })
  await expect(errorMessage).toBeVisible({ timeout: 10000 })
  await expect(errorMessage).toHaveClass(/text-red-600/)
  // 登録されず、ダイアログは開いたまま
  await expect(page.getByRole('heading', { name: SIGN_UP_HEADING })).toBeVisible()
}

test.describe('アカウント作成フロー E2Eテスト', () => {
  test.describe('正常系: アカウント作成成功', () => {
    test('バリデーションルールに合致する入力でアカウントが作成できる', async ({ page }) => {
      await openSignUpPage(page)

      // 共通の補助関数（他のテストのアカウント作成でも使う）で登録する
      await performSignUp(page, generateUniqueEmail('signup-valid'), VALID_PASSWORD, VALID_DISPLAY_NAME)

      // 成功のお知らせが表示され、ダイアログが閉じる
      await expect(page.getByText(SIGN_UP_SUCCESS_MESSAGE)).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('heading', { name: SIGN_UP_HEADING })).not.toBeVisible()
    })

    test('プロフィール画像なしでアカウントが作成できる', async ({ page }) => {
      await openSignUpPage(page)

      await fillValidForm(page, { email: generateUniqueEmail('signup-noimage') })
      await page.getByRole('button', { name: '登録する' }).click()

      await expect(page.getByText(SIGN_UP_SUCCESS_MESSAGE)).toBeVisible({ timeout: 10000 })
    })

    test('プロフィール画像ありでアカウントが作成できる', async ({ page }) => {
      await openSignUpPage(page)

      // プロフィール画像を選ぶと、トリミングの画面が開くので「確定」する（1x1 の最小 PNG）
      await page.locator('input[type="file"]').setInputFiles({
        name: 'test-image.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        ),
      })
      await page.getByRole('button', { name: '確定' }).click()
      await expect(page.getByRole('button', { name: '確定' })).not.toBeVisible()

      await fillValidForm(page, { email: generateUniqueEmail('signup-withimage') })
      await page.getByRole('button', { name: '登録する' }).click()

      await expect(page.getByText(SIGN_UP_SUCCESS_MESSAGE)).toBeVisible({ timeout: 10000 })
    })

    test('表示名が2文字でアカウントが作成できる（最小境界値）', async ({ page }) => {
      await openSignUpPage(page)

      await fillValidForm(page, { displayName: 'AB', email: generateUniqueEmail('signup-minname') })
      await page.getByRole('button', { name: '登録する' }).click()

      await expect(page.getByText(SIGN_UP_SUCCESS_MESSAGE)).toBeVisible({ timeout: 10000 })
    })

    test('表示名が12文字でアカウントが作成できる（最大境界値）', async ({ page }) => {
      await openSignUpPage(page)

      await fillValidForm(page, { displayName: 'abcdefghijkl', email: generateUniqueEmail('signup-maxname') })
      await page.getByRole('button', { name: '登録する' }).click()

      await expect(page.getByText(SIGN_UP_SUCCESS_MESSAGE)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('異常系: バリデーションエラー', () => {
    test.describe('表示名のバリデーション', () => {
      test('表示名が空白のみの場合、登録ボタンが無効化されている', async ({ page }) => {
        await openSignUpPage(page)

        await fillValidForm(page, { displayName: '   ' })

        // 空白のみは有効な表示名として扱われない
        await expect(page.getByRole('button', { name: '登録する' })).toBeDisabled()
      })

      test('表示名が1文字の場合、エラーメッセージが赤い文字で表示される（最小境界値未満）', async ({ page }) => {
        await openSignUpPage(page)

        await fillValidForm(page, { displayName: 'A' })

        await submitAndExpectError(page, '表示名は2文字以上12文字以内で入力してください。')
      })

      test('表示名が13文字の場合、エラーメッセージが赤い文字で表示される（最大境界値超過）', async ({ page }) => {
        await openSignUpPage(page)

        await fillValidForm(page, { displayName: 'abcdefghijklm' })

        await submitAndExpectError(page, '表示名は2文字以上12文字以内で入力してください。')
      })

      test('表示名の先頭が数字の場合、サーバーの入力チェックのエラーが赤い文字で表示される', async ({ page }) => {
        // 先頭の文字の確認はサーバーだけが行う（Spec#98）。サーバーのエラーが表示名の欄に出ることを確かめる
        await openSignUpPage(page)

        await fillValidForm(page, { displayName: '123456789012', email: generateUniqueEmail('signup-name-digit') })

        await submitAndExpectError(
          page,
          '表示名の先頭は英字または日本語にしてください（数字・アンダースコア・ハイフンは先頭に使えません）。'
        )
      })
    })

    test.describe('メールアドレスのバリデーション', () => {
      test('メールアドレス形式が不正な場合、エラーメッセージが赤い文字で表示される', async ({ page }) => {
        await openSignUpPage(page)

        await fillValidForm(page, { email: 'invalid-email' })

        await submitAndExpectError(page, '正しいメールアドレスの形式で入力してください')
      })
    })

    test.describe('パスワードのバリデーション', () => {
      test('パスワードが8文字未満の場合、エラーメッセージが赤い文字で表示される', async ({ page }) => {
        await openSignUpPage(page)

        await fillValidForm(page, { password: 'Short1A' })

        await submitAndExpectError(page, 'パスワードは8文字以上20文字以内で入力してください')
      })

      test('パスワードは20文字までしか入力できない', async ({ page }) => {
        // パスワード欄は maxLength=20 のため、21 文字目以降は入力されない
        await openSignUpPage(page)

        const longPassword = 'Abcdefghijklmnop12345' // 21文字
        await page.getByPlaceholder(PLACEHOLDER.password).fill(longPassword)
        await page.getByPlaceholder(PLACEHOLDER.confirmPassword).fill(longPassword)

        await expect(page.getByPlaceholder(PLACEHOLDER.password)).toHaveValue(longPassword.slice(0, 20))
        await expect(page.getByPlaceholder(PLACEHOLDER.confirmPassword)).toHaveValue(longPassword.slice(0, 20))
      })

      test('パスワードに数字が含まれていない場合、エラーメッセージが赤い文字で表示される', async ({ page }) => {
        await openSignUpPage(page)

        await fillValidForm(page, { password: 'NoNumbersHere' })

        await submitAndExpectError(page, 'パスワードには数字を1文字以上含めてください')
      })

      test('パスワードに小文字が含まれていない場合、エラーメッセージが赤い文字で表示される', async ({ page }) => {
        await openSignUpPage(page)

        await fillValidForm(page, { password: 'NOLOWER123' })

        await submitAndExpectError(page, 'パスワードにはローマ字小文字を1文字以上含めてください')
      })

      test('パスワードに大文字が含まれていない場合、エラーメッセージが赤い文字で表示される', async ({ page }) => {
        await openSignUpPage(page)

        await fillValidForm(page, { password: 'noupper123' })

        await submitAndExpectError(page, 'パスワードにはローマ字大文字を1文字以上含めてください')
      })

      test('パスワードに記号が含まれている場合、エラーメッセージが赤い文字で表示される', async ({ page }) => {
        await openSignUpPage(page)

        await fillValidForm(page, { password: 'Test@Pass1' })

        await submitAndExpectError(page, 'パスワードに記号を含めることはできません')
      })
    })

    test.describe('パスワード確認のバリデーション', () => {
      test('パスワードと確認用パスワードが一致しない場合、エラーメッセージが赤い文字で表示される', async ({ page }) => {
        await openSignUpPage(page)

        await fillValidForm(page, { confirmPassword: 'DifferentPass1' })

        await submitAndExpectError(page, 'パスワードが一致しません')
      })
    })

    test.describe('同意のバリデーション', () => {
      const consents: Array<[keyof typeof SIGN_UP_CONSENT_CHECKBOXES, string]> = [
        ['terms', '利用規約'],
        ['privacy', 'プライバシーポリシー'],
        ['age', '13歳以上であることの確認'],
      ]
      for (const [key, label] of consents) {
        test(`${label}にチェックしていない場合、登録ボタンが無効化されている`, async ({ page }) => {
          await openSignUpPage(page)

          await fillValidForm(page, { skipConsent: key })

          await expect(page.getByRole('button', { name: '登録する' })).toBeDisabled()
        })
      }
    })
  })

  test.describe('異常系: サーバーサイドエラー', () => {
    test('メールアドレスが既に登録されている場合、エラーメッセージが赤い文字で表示される', async ({ page }) => {
      const duplicateEmail = generateUniqueEmail('signup-duplicate')

      // 1回目: ユーザーを登録
      await openSignUpPage(page)
      await fillSignUpForm(page, duplicateEmail, VALID_PASSWORD, VALID_DISPLAY_NAME)
      await page.getByRole('button', { name: '登録する' }).click()
      await expect(page.getByText(SIGN_UP_SUCCESS_MESSAGE)).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('heading', { name: SIGN_UP_HEADING })).not.toBeVisible()

      // 2回目: 同じメールアドレスで登録を試みる（サーバーは 409 EMAIL_ALREADY_IN_USE を返す）
      await openSignUpDialog(page)
      await fillSignUpForm(page, duplicateEmail, VALID_PASSWORD, VALID_DISPLAY_NAME)

      await submitAndExpectError(page, 'このメールアドレスはすでに使用されています')
    })
  })

  test.describe('セキュリティ', () => {
    test('XSS攻撃文字列を含む表示名でも安全に処理される', async ({ page }) => {
      await openSignUpPage(page)

      const xssPayload = '<script>alert("XSS")</script>'
      await fillValidForm(page, { displayName: xssPayload, email: generateUniqueEmail('signup-xss') })

      // 表示名として受け付けられず（12 文字超・記号を含む）、scriptタグとして実行もされない
      await submitAndExpectError(page, '表示名は2文字以上12文字以内で入力してください。')
      await expect(page.locator('script:has-text("XSS")')).toHaveCount(0)
    })
  })

  test.describe('フォーム状態の検証', () => {
    test('必須項目が未入力の場合、登録ボタンが無効化されている', async ({ page }) => {
      await openSignUpPage(page)

      await expect(page.getByRole('button', { name: '登録する' })).toBeDisabled()
    })

    test('全ての必須項目が入力されると、登録ボタンが有効化される', async ({ page }) => {
      await openSignUpPage(page)

      await fillValidForm(page)

      await expect(page.getByRole('button', { name: '登録する' })).toBeEnabled()
    })
  })
})
