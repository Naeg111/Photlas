import { test, expect } from '@playwright/test'
import {
  waitForSplash,
  createAccountAndLogin,
  clearStorage,
  TEST_PASSWORD,
  generateUniqueEmail,
  openLoginDialog,
  performLogin,
} from './helpers/auth'

/**
 * アカウント設定 E2Eテスト
 *
 * テスト対象:
 * 1. アカウント設定ダイアログの表示
 * 2. メールアドレス変更
 * 3. パスワード変更
 * 4. パスワード変更バリデーション
 * 5. アカウント削除
 *
 * 前提条件:
 * - テスト環境が稼働していること
 */

test.describe('アカウント設定', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForSplash(page)
    await clearStorage(page)
  })

  test('アカウント設定ダイアログが開く', async ({ page }) => {
    await createAccountAndLogin(page, 'settings-open')

    // メニュー → アカウント設定
    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByText('アカウント設定').click()

    // ダイアログが表示される
    await expect(page.getByRole('heading', { name: 'アカウント設定' })).toBeVisible({ timeout: 5000 })

    // 各セクションが表示される
    await expect(page.getByText('メールアドレスの変更')).toBeVisible()
    await expect(page.getByText('パスワードの変更')).toBeVisible()
    await expect(page.getByText('アカウント削除')).toBeVisible()
  })

  test('メールアドレスを変更できる', async ({ page }) => {
    const email = await createAccountAndLogin(page, 'settings-email')
    const newEmail = generateUniqueEmail('settings-new-email')

    // メニュー → アカウント設定
    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByText('アカウント設定').click()
    await expect(page.getByRole('heading', { name: 'アカウント設定' })).toBeVisible({ timeout: 5000 })

    // 新しいメールアドレスとパスワードを入力
    await page.getByLabel('新しいメールアドレス').fill(newEmail)
    await page.locator('#email-password').fill(TEST_PASSWORD)

    // 変更ボタンをクリック
    await page.getByRole('button', { name: 'メールアドレスを変更' }).click()

    // 成功トーストを確認
    await expect(page.getByText('メールアドレスを変更しました')).toBeVisible({ timeout: 10000 })
  })

  test('パスワードを変更できる', async ({ page }) => {
    await createAccountAndLogin(page, 'settings-pw')
    const newPassword = 'NewPass456'

    // メニュー → アカウント設定
    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByText('アカウント設定').click()
    await expect(page.getByRole('heading', { name: 'アカウント設定' })).toBeVisible({ timeout: 5000 })

    // 新しいパスワードと確認を入力
    await page.getByLabel('新しいパスワード', { exact: true }).fill(newPassword)
    await page.getByLabel('新しいパスワード（確認）').fill(newPassword)

    // 変更ボタンをクリック
    await page.getByRole('button', { name: 'パスワードを変更' }).click()

    // 成功トーストを確認
    await expect(page.getByText('パスワードを変更しました')).toBeVisible({ timeout: 10000 })
  })

  test('パスワード変更: 不一致の場合エラーが表示される', async ({ page }) => {
    await createAccountAndLogin(page, 'settings-pw-err')

    // メニュー → アカウント設定
    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByText('アカウント設定').click()
    await expect(page.getByRole('heading', { name: 'アカウント設定' })).toBeVisible({ timeout: 5000 })

    // 不一致のパスワードを入力
    await page.getByLabel('新しいパスワード', { exact: true }).fill('NewPass456')
    await page.getByLabel('新しいパスワード（確認）').fill('DifferentPass789')

    // 変更ボタンをクリック
    await page.getByRole('button', { name: 'パスワードを変更' }).click()

    // エラーメッセージを確認
    await expect(page.getByText('新しいパスワードが一致しません')).toBeVisible({ timeout: 5000 })
  })

  test('アカウントを削除できる', async ({ page }) => {
    await createAccountAndLogin(page, 'settings-delete')

    // メニュー → アカウント設定
    await page.getByRole('button', { name: 'メニュー' }).click()
    await page.getByText('アカウント設定').click()
    await expect(page.getByRole('heading', { name: 'アカウント設定' })).toBeVisible({ timeout: 5000 })

    // アカウント削除ボタンをクリック
    await page.getByRole('button', { name: 'アカウントを削除' }).click()

    // 確認ダイアログが表示される
    await expect(page.getByText('本当に削除しますか？')).toBeVisible({ timeout: 5000 })

    // パスワードを入力
    await page.getByLabel('パスワードを入力して確認').fill(TEST_PASSWORD)

    // 確認ボタンをクリック
    await page.getByRole('button', { name: '削除する' }).click()

    // 成功トーストを確認
    await expect(page.getByText('アカウントを削除しました')).toBeVisible({ timeout: 10000 })

    // ホーム画面に遷移し、未認証状態になる
    await page.getByRole('button', { name: 'メニュー' }).click()
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()
  })
})
