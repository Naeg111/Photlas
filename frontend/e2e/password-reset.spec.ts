import { test, expect, Page } from '@playwright/test'
import {
  waitForSplash,
  clearStorage,
  openLoginDialog,
} from './helpers/auth'

/**
 * パスワードリセット機能 E2Eテスト
 *
 * テスト対象:
 * 1. パスワードリセットリクエストダイアログの表示と操作
 * 2. パスワードリセットリクエストのバリデーション
 * 3. パスワードリセットページの表示と操作
 * 4. パスワードリセットページのバリデーション
 *
 * 前提条件:
 * - テスト環境が稼働していること
 */

/**
 * パスワードリセットリクエストダイアログを開く
 */
async function openPasswordResetDialog(page: Page): Promise<void> {
  await openLoginDialog(page)
  await page.getByRole('button', { name: 'パスワードをお忘れですか？' }).click()
  await expect(page.getByRole('heading', { name: 'パスワードリセット' })).toBeVisible()
}

test.describe('パスワードリセット機能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForSplash(page)
    await clearStorage(page)
  })

  // ============================================================
  // パスワードリセットリクエストダイアログ
  // ============================================================

  test.describe('リセットリクエストダイアログ', () => {
    test('ログインダイアログからパスワードリセットダイアログが開く', async ({ page }) => {
      await openPasswordResetDialog(page)

      // ダイアログが表示される
      await expect(page.getByRole('heading', { name: 'パスワードリセット' })).toBeVisible()
      await expect(page.getByText('登録メールアドレスを入力してください。')).toBeVisible()
    })

    test('メールアドレスを入力して送信できる', async ({ page }) => {
      await openPasswordResetDialog(page)

      // メールアドレスを入力
      await page.getByLabel('メールアドレス').fill('test@example.com')

      // 送信ボタンをクリック
      await page.getByRole('button', { name: '送信' }).click()

      // 成功メッセージが表示される（ユーザー列挙攻撃防止のため、存在しないメールでも成功扱い）
      await expect(page.getByText('パスワード再設定用のメールを送信しました。受信トレイをご確認ください。')).toBeVisible({
        timeout: 10000,
      })
    })

    test('メールアドレス未入力で送信するとエラーが表示される', async ({ page }) => {
      await openPasswordResetDialog(page)

      // 未入力のまま送信
      await page.getByRole('button', { name: '送信' }).click()

      // エラーメッセージが表示される
      await expect(page.getByText('メールアドレスは必須です')).toBeVisible()
    })

    test('不正なメールアドレス形式でエラーが表示される', async ({ page }) => {
      await openPasswordResetDialog(page)

      // 不正な形式を入力
      await page.getByLabel('メールアドレス').fill('invalid-email')
      await page.getByRole('button', { name: '送信' }).click()

      // エラーメッセージが表示される
      await expect(page.getByText('正しいメールアドレス形式で入力してください')).toBeVisible()
    })

    test('閉じるボタンでダイアログを閉じられる', async ({ page }) => {
      await openPasswordResetDialog(page)

      // 閉じるボタンをクリック
      await page.getByRole('button', { name: '閉じる' }).click()

      // ダイアログが閉じる
      await expect(page.getByRole('heading', { name: 'パスワードリセット' })).not.toBeVisible()
    })
  })

  // ============================================================
  // パスワードリセットページ
  // ============================================================

  test.describe('リセットページ', () => {
    test('トークンなしでアクセスすると無効なリンクメッセージが表示される', async ({ page }) => {
      await page.goto('/reset-password')

      await expect(page.getByText('無効なリンクです')).toBeVisible()
      await expect(page.getByText('パスワードリセットのリンクが無効です')).toBeVisible()
    })

    test('トークンなしのページからトップページに戻れる', async ({ page }) => {
      await page.goto('/reset-password')

      await expect(page.getByText('無効なリンクです')).toBeVisible()

      // トップページへのリンクをクリック
      await page.getByText('トップページへ').click()

      // トップページに遷移する
      await expect(page).toHaveURL('/')
    })

    test('トークン付きでアクセスするとリセットフォームが表示される', async ({ page }) => {
      await page.goto('/reset-password?token=test-token')

      // リセットフォームが表示される
      await expect(page.getByRole('heading', { name: 'パスワードの再設定' })).toBeVisible()
      await expect(page.getByLabel('新しいパスワード', { exact: true })).toBeVisible()
      await expect(page.getByLabel('新しいパスワード（確認）')).toBeVisible()
      await expect(page.getByRole('button', { name: 'パスワードを再設定' })).toBeVisible()
    })

    test('パスワードが一致しない場合エラーが表示される', async ({ page }) => {
      await page.goto('/reset-password?token=test-token')

      await page.getByLabel('新しいパスワード', { exact: true }).fill('NewPass123')
      await page.getByLabel('新しいパスワード（確認）').fill('DifferentPass456')

      await page.getByRole('button', { name: 'パスワードを再設定' }).click()

      await expect(page.getByText('パスワードが一致しません')).toBeVisible()
    })

    test('パスワードが8文字未満の場合エラーが表示される', async ({ page }) => {
      await page.goto('/reset-password?token=test-token')

      await page.getByLabel('新しいパスワード', { exact: true }).fill('Short1A')
      await page.getByLabel('新しいパスワード（確認）').fill('Short1A')

      await page.getByRole('button', { name: 'パスワードを再設定' }).click()

      await expect(page.getByText('パスワードは8文字以上20文字以内で入力してください')).toBeVisible()
    })

    test('パスワードに大文字が含まれない場合エラーが表示される', async ({ page }) => {
      await page.goto('/reset-password?token=test-token')
      await page.waitForTimeout(1000)

      await page.getByLabel('新しいパスワード', { exact: true }).fill('password1')
      await page.getByLabel('新しいパスワード（確認）').fill('password1')
      await page.getByRole('button', { name: 'パスワードを再設定' }).click()

      await expect(page.getByText(/大文字/)).toBeVisible({ timeout: 5000 })
    })

    test('パスワードに小文字が含まれない場合エラーが表示される', async ({ page }) => {
      await page.goto('/reset-password?token=test-token')
      await page.waitForTimeout(1000)

      await page.getByLabel('新しいパスワード', { exact: true }).fill('PASSWORD1')
      await page.getByLabel('新しいパスワード（確認）').fill('PASSWORD1')
      await page.getByRole('button', { name: 'パスワードを再設定' }).click()

      await expect(page.getByText(/小文字/)).toBeVisible({ timeout: 5000 })
    })

    test('パスワードに数字が含まれない場合エラーが表示される', async ({ page }) => {
      await page.goto('/reset-password?token=test-token')
      await page.waitForTimeout(1000)

      await page.getByLabel('新しいパスワード', { exact: true }).fill('Passwords')
      await page.getByLabel('新しいパスワード（確認）').fill('Passwords')
      await page.getByRole('button', { name: 'パスワードを再設定' }).click()

      await expect(page.getByText(/数字/)).toBeVisible({ timeout: 5000 })
    })

    test('パスワードが20文字を超える場合エラーが表示される', async ({ page }) => {
      await page.goto('/reset-password?token=test-token')
      await page.waitForTimeout(1000)

      const longPassword = 'Abcdefghij1234567890k'
      await page.getByLabel('新しいパスワード', { exact: true }).fill(longPassword)
      await page.getByLabel('新しいパスワード（確認）').fill(longPassword)
      await page.getByRole('button', { name: 'パスワードを再設定' }).click()

      await expect(page.getByText(/20文字/)).toBeVisible({ timeout: 5000 })
    })

    test('パスワードの表示/非表示を切り替えられる', async ({ page }) => {
      await page.goto('/reset-password?token=test-token')

      const passwordInput = page.getByLabel('新しいパスワード', { exact: true })
      await passwordInput.fill('TestPass123')

      // 初期状態では非表示
      await expect(passwordInput).toHaveAttribute('type', 'password')

      // 表示ボタンをクリック
      await page.getByRole('button', { name: 'パスワードを表示' }).first().click()

      // 表示状態になる
      await expect(passwordInput).toHaveAttribute('type', 'text')
    })
  })
})
