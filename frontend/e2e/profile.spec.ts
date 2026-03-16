import { test, expect, Page } from '@playwright/test'
import {
  waitForSplash,
  createAccountAndLogin,
  clearStorage,
} from './helpers/auth'

/**
 * プロフィール管理・表示 E2Eテスト
 *
 * テスト対象:
 * 1. プロフィールダイアログの表示
 * 2. ユーザー名の変更
 * 3. 投稿タブ・お気に入りタブの表示
 * 4. SNSリンクの編集
 * 5. プロフィール画像の操作
 *
 * 前提条件:
 * - テスト環境が稼働していること
 */

/**
 * プロフィールダイアログを開く
 */
async function openProfileDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'メニュー' }).click()
  await page.getByText('マイページ').click()
  await expect(page.getByRole('heading', { name: 'プロフィール' })).toBeVisible({ timeout: 5000 })
}

test.describe('プロフィール管理・表示', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForSplash(page)
    await clearStorage(page)
  })

  // ============================================================
  // プロフィールダイアログの基本表示
  // ============================================================

  test.describe('プロフィールダイアログの基本表示', () => {
    test('ログイン後にマイページからプロフィールダイアログが開く', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-open')

      await openProfileDialog(page)

      // ダイアログの基本要素が表示される
      await expect(page.getByRole('heading', { name: 'プロフィール' })).toBeVisible()
    })

    test('アカウント名が表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-name')

      await openProfileDialog(page)

      // ユーザー名が表示される
      await expect(page.getByText('アカウント名')).toBeVisible()
    })

    test('投稿タブとお気に入りタブが表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-tabs')

      await openProfileDialog(page)

      // タブが表示される
      await expect(page.getByRole('tab', { name: '投稿' })).toBeVisible()
      await expect(page.getByRole('tab', { name: 'お気に入り' })).toBeVisible()
    })

    test('投稿タブがデフォルトで選択されている', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-default-tab')

      await openProfileDialog(page)

      // 投稿タブが選択状態
      const postsTab = page.getByRole('tab', { name: '投稿' })
      await expect(postsTab).toHaveAttribute('aria-selected', 'true')
    })

    test('投稿がない場合「まだ投稿がありません」が表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-no-posts')

      await openProfileDialog(page)

      // 空メッセージが表示される
      await expect(page.getByText('まだ投稿がありません')).toBeVisible({ timeout: 5000 })
    })
  })

  // ============================================================
  // ユーザー名変更
  // ============================================================

  test.describe('ユーザー名変更', () => {
    test('ユーザー名の変更ボタンが表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-edit-name')

      await openProfileDialog(page)

      // ユーザー名の「変更」ボタンが表示される
      await expect(page.getByRole('button', { name: '変更' })).toBeVisible({ timeout: 5000 })
    })
  })

  // ============================================================
  // タブ切り替え
  // ============================================================

  test.describe('タブ切り替え', () => {
    test('お気に入りタブをクリックするとお気に入り一覧が表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-fav-tab')

      await openProfileDialog(page)

      // お気に入りタブをクリック
      await page.getByRole('tab', { name: 'お気に入り' }).click()

      // お気に入りタブが選択状態になる
      const favTab = page.getByRole('tab', { name: 'お気に入り' })
      await expect(favTab).toHaveAttribute('aria-selected', 'true')
    })

    test('お気に入りがない場合「お気に入りはまだありません」が表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-no-favs')

      await openProfileDialog(page)

      // お気に入りタブをクリック
      await page.getByRole('tab', { name: 'お気に入り' }).click()

      // タブ切り替え後のデータ取得を待機
      await page.waitForTimeout(1000)

      // 空メッセージが表示される（ローディング完了を待つため長めのタイムアウト）
      await expect(page.getByText('お気に入りはまだありません')).toBeVisible({ timeout: 10000 })
    })
  })

  // ============================================================
  // SNSリンク編集
  // ============================================================

  test.describe('SNSリンク編集', () => {
    test('SNSリンク編集ボタンが表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-sns-btn')

      await openProfileDialog(page)

      // 編集ボタンが表示される
      await expect(page.getByTestId('edit-sns-links-button')).toBeVisible()
    })

    test('SNSリンク編集ボタンをクリックすると編集フォームが表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-sns-form')

      await openProfileDialog(page)

      // 編集ボタンをクリック
      await page.getByTestId('edit-sns-links-button').click()

      // リンク追加ボタンが表示される
      await expect(page.getByTestId('add-sns-link-button')).toBeVisible()
    })

    test('SNSリンクを追加できる', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-sns-add')

      await openProfileDialog(page)

      // 編集モードに入る
      await page.getByTestId('edit-sns-links-button').click()

      // リンクを追加
      await page.getByTestId('add-sns-link-button').click()

      // URL入力欄が表示される
      await expect(page.getByTestId('sns-url-input-0')).toBeVisible()
    })
  })

  // ============================================================
  // プロフィール画像
  // ============================================================

  test.describe('プロフィール画像', () => {
    test('デフォルトアバターアイコンが表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'profile-avatar')

      await openProfileDialog(page)

      // デフォルトアバターが表示される
      await expect(page.getByTestId('default-avatar-icon')).toBeVisible()
    })
  })
})
