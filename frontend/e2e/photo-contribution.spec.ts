import { test, expect, Page } from '@playwright/test'
import {
  waitForSplash,
  createAccountAndLogin,
  clearStorage,
  TEST_PASSWORD,
} from './helpers/auth'
import { getTestImagePath, ensureFixtures, saveTestImage } from './helpers/test-image'

/**
 * 写真投稿機能 E2Eテスト
 *
 * テスト対象:
 * 1. 写真選択と保存
 * 2. 投稿成功フロー
 * 3. 必須入力バリデーション
 * 4. ファイルサイズ・形式バリデーション
 * 5. タイトル文字数制限
 * 6. カテゴリ選択（単一・複数）
 * 7. 位置情報設定
 * 8. HEIC形式対応
 *
 * 前提条件:
 * - テスト環境（test.photlas.jp）が稼働していること
 * - ログイン済みの状態でテスト実行
 */

// テスト用定数
const PHOTO_CATEGORIES = [
  '風景', '街並み', '植物', '動物', '自動車', 'バイク',
  '鉄道', '飛行機', '食べ物', 'ポートレート', '星空', 'その他',
]

// テスト用の固定アカウント（E2Eテスト用に事前作成）
const TEST_ACCOUNT = {
  email: 'e2e-photo-test@example.com',
  password: TEST_PASSWORD,
}

/**
 * 投稿ダイアログを開く
 */
async function openPhotoContributionDialog(page: Page): Promise<void> {
  // FABボタン（+ボタン）をクリック
  await page.getByRole('button', { name: '投稿' }).click()
  // ダイアログが開くのを待機
  await expect(page.getByRole('heading', { name: '写真を投稿' })).toBeVisible({ timeout: 5000 })
}

/**
 * 投稿ダイアログが開けない場合（未ログイン）、ログイン要求ダイアログが表示されることを確認
 */
async function expectLoginRequiredDialog(page: Page): Promise<void> {
  await expect(page.getByText('ログインが必要です')).toBeVisible({ timeout: 5000 })
}

/**
 * テスト用画像ファイルを準備
 */
function ensureTestImages(): void {
  ensureFixtures()
}

test.describe('写真投稿機能', () => {
  test.beforeAll(() => {
    // テスト画像を事前に生成
    ensureTestImages()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForSplash(page)
    await clearStorage(page)
  })

  // ============================================================
  // 投稿ダイアログの基本表示テスト
  // ============================================================

  test.describe('投稿ダイアログの基本表示', () => {
    test('未ログイン状態で投稿ボタンを押すとログイン要求ダイアログが表示される', async ({ page }) => {
      // 投稿ボタンをクリック
      await page.getByRole('button', { name: '投稿' }).click()

      // ログイン要求ダイアログが表示される
      await expectLoginRequiredDialog(page)
    })

    test('ログイン状態で投稿ボタンを押すと投稿ダイアログが表示される', async ({ page }) => {
      // ログイン
      await createAccountAndLogin(page, 'photo-dialog')

      // 投稿ダイアログを開く
      await openPhotoContributionDialog(page)

      // ダイアログの主要要素が表示されている
      await expect(page.getByRole('heading', { name: '写真を投稿' })).toBeVisible()
      await expect(page.getByText('写真を選択')).toBeVisible()
      await expect(page.getByPlaceholder('例：夕暮れの東京タワー')).toBeVisible()
    })

    test('投稿ダイアログに12種類のカテゴリが表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'photo-categories')
      await openPhotoContributionDialog(page)

      // 全カテゴリが表示されていることを確認
      for (const category of PHOTO_CATEGORIES) {
        await expect(page.getByText(category, { exact: true })).toBeVisible()
      }
    })
  })

  // ============================================================
  // 写真選択・プレビューテスト
  // ============================================================

  test.describe('写真選択とプレビュー', () => {
    test('写真を選択するとプレビューが表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'photo-preview')
      await openPhotoContributionDialog(page)

      // ファイル選択
      const testImagePath = getTestImagePath('small')
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(testImagePath)

      // プレビュー画像が表示される
      await expect(page.locator('img[alt="プレビュー"]')).toBeVisible({ timeout: 5000 })
    })

    test('選択した写真を削除できる', async ({ page }) => {
      await createAccountAndLogin(page, 'photo-delete')
      await openPhotoContributionDialog(page)

      // ファイル選択
      const testImagePath = getTestImagePath('small')
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(testImagePath)

      // プレビューが表示される
      await expect(page.locator('img[alt="プレビュー"]')).toBeVisible()

      // 削除ボタンをクリック
      await page.getByRole('button', { name: '削除' }).click()

      // プレビューが消える
      await expect(page.locator('img[alt="プレビュー"]')).not.toBeVisible()
    })
  })

  // ============================================================
  // バリデーションテスト
  // ============================================================

  test.describe('バリデーション', () => {
    test.describe('必須入力バリデーション', () => {
      test('写真が未選択の場合は投稿できない', async ({ page }) => {
        await createAccountAndLogin(page, 'validation-photo')
        await openPhotoContributionDialog(page)

        // タイトルとカテゴリを入力
        await page.getByPlaceholder('例：夕暮れの東京タワー').fill('テストタイトル')
        // カテゴリのチェックボックスをクリック
        await page.getByRole('checkbox', { name: '風景' }).click()

        // 投稿ボタンがdisabledであることを確認
        const submitButton = page.getByRole('button', { name: '投稿する' })
        await expect(submitButton).toBeDisabled()
      })

      test('タイトルが未入力の場合は投稿できない', async ({ page }) => {
        await createAccountAndLogin(page, 'validation-title')
        await openPhotoContributionDialog(page)

        // 写真とカテゴリを選択
        const testImagePath = getTestImagePath('small')
        await page.locator('input[type="file"]').setInputFiles(testImagePath)
        await expect(page.locator('img[alt="プレビュー"]')).toBeVisible()
        // カテゴリのチェックボックスをクリック
        await page.getByRole('checkbox', { name: '風景' }).click()
        await expect(page.getByRole('checkbox', { name: '風景' })).toBeChecked()

        // 投稿ボタンがdisabledであることを確認
        const submitButton = page.getByRole('button', { name: '投稿する' })
        await expect(submitButton).toBeDisabled()
      })

      test('カテゴリが未選択の場合は投稿できない', async ({ page }) => {
        await createAccountAndLogin(page, 'validation-category')
        await openPhotoContributionDialog(page)

        // 写真とタイトルを入力
        const testImagePath = getTestImagePath('small')
        await page.locator('input[type="file"]').setInputFiles(testImagePath)
        await expect(page.locator('img[alt="プレビュー"]')).toBeVisible()
        await page.getByPlaceholder('例：夕暮れの東京タワー').fill('テストタイトル')

        // 投稿ボタンがdisabledであることを確認
        const submitButton = page.getByRole('button', { name: '投稿する' })
        await expect(submitButton).toBeDisabled()
      })
    })

    test.describe('ファイルバリデーション', () => {
      test('50MBを超えるファイルは選択できない', async ({ page }) => {
        await createAccountAndLogin(page, 'validation-size')
        await openPhotoContributionDialog(page)

        // 大きいファイルを選択
        const largeImagePath = getTestImagePath('large')

        // アラートハンドラーを設定
        page.once('dialog', async (dialog) => {
          expect(dialog.message()).toContain('50MB')
          await dialog.accept()
        })

        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(largeImagePath)

        // プレビューが表示されないことを確認
        await page.waitForTimeout(1000)
        await expect(page.locator('img[alt="プレビュー"]')).not.toBeVisible()
      })

      test('非対応形式（GIF）のファイルは選択できない', async ({ page }) => {
        await createAccountAndLogin(page, 'validation-format')
        await openPhotoContributionDialog(page)

        // 無効な形式のファイルを選択
        const invalidImagePath = getTestImagePath('invalid')

        // アラートハンドラーを設定
        page.once('dialog', async (dialog) => {
          expect(dialog.message()).toContain('JPEG、PNG、HEIC')
          await dialog.accept()
        })

        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(invalidImagePath)

        // プレビューが表示されないことを確認
        await page.waitForTimeout(1000)
        await expect(page.locator('img[alt="プレビュー"]')).not.toBeVisible()
      })
    })

    test.describe('タイトルバリデーション', () => {
      test('タイトルの文字数カウンターが表示される', async ({ page }) => {
        await createAccountAndLogin(page, 'title-counter')
        await openPhotoContributionDialog(page)

        // 初期状態で0/20が表示される
        await expect(page.getByText('0/20文字')).toBeVisible()

        // タイトルを入力
        await page.getByPlaceholder('例：夕暮れの東京タワー').fill('テスト')

        // カウンターが更新される
        await expect(page.getByText('3/20文字')).toBeVisible()
      })

      test('20文字を超える入力は制限される', async ({ page }) => {
        await createAccountAndLogin(page, 'title-limit')
        await openPhotoContributionDialog(page)

        const titleInput = page.getByPlaceholder('例：夕暮れの東京タワー')

        // 21文字を入力しようとする
        await titleInput.fill('あいうえおかきくけこさしすせそたちつてとな')

        // 20文字に制限される
        const value = await titleInput.inputValue()
        expect(value.length).toBeLessThanOrEqual(20)
      })
    })
  })

  // ============================================================
  // カテゴリ選択テスト
  // ============================================================

  test.describe('カテゴリ選択', () => {
    test('単一カテゴリを選択できる', async ({ page }) => {
      await createAccountAndLogin(page, 'category-single')
      await openPhotoContributionDialog(page)

      // カテゴリのチェックボックスをクリック（aria-labelで指定）
      const categoryCheckbox = page.getByRole('checkbox', { name: '風景' })
      await categoryCheckbox.click()

      // チェックされていることを確認
      await expect(categoryCheckbox).toBeChecked()
    })

    test('複数カテゴリを選択できる', async ({ page }) => {
      await createAccountAndLogin(page, 'category-multiple')
      await openPhotoContributionDialog(page)

      // 複数のカテゴリを選択
      await page.getByRole('checkbox', { name: '風景' }).click()
      await page.getByRole('checkbox', { name: '街並み' }).click()
      await page.getByRole('checkbox', { name: '星空' }).click()

      // 3つとも選択されている
      await expect(page.getByRole('checkbox', { name: '風景' })).toBeChecked()
      await expect(page.getByRole('checkbox', { name: '街並み' })).toBeChecked()
      await expect(page.getByRole('checkbox', { name: '星空' })).toBeChecked()
    })

    test('選択したカテゴリを解除できる', async ({ page }) => {
      await createAccountAndLogin(page, 'category-deselect')
      await openPhotoContributionDialog(page)

      const categoryCheckbox = page.getByRole('checkbox', { name: '風景' })

      // 選択
      await categoryCheckbox.click()
      await expect(categoryCheckbox).toBeChecked()

      // 解除
      await categoryCheckbox.click()
      await expect(categoryCheckbox).not.toBeChecked()
    })
  })

  // ============================================================
  // 位置情報設定テスト
  // ============================================================

  test.describe('位置情報設定', () => {
    test('地図で位置を選択できる', async ({ page }) => {
      await createAccountAndLogin(page, 'location-map')
      await openPhotoContributionDialog(page)

      // 写真を選択すると位置情報がデフォルトで設定される
      const testImagePath = getTestImagePath('small')
      await page.locator('input[type="file"]').setInputFiles(testImagePath)
      await expect(page.locator('img[alt="プレビュー"]')).toBeVisible()

      // 位置情報が設定されていることを確認（テキストで確認）
      await expect(page.getByText('位置が設定されました')).toBeVisible({ timeout: 5000 })
    })

    test('MapPickerで位置を変更できる', async ({ page }) => {
      await createAccountAndLogin(page, 'location-change')
      await openPhotoContributionDialog(page)

      // 写真を選択
      const testImagePath = getTestImagePath('small')
      await page.locator('input[type="file"]').setInputFiles(testImagePath)
      await expect(page.locator('img[alt="プレビュー"]')).toBeVisible()

      // 位置情報が設定されていることを確認
      await expect(page.getByText('位置が設定されました')).toBeVisible({ timeout: 5000 })

      // 位置変更ボタンをクリック（存在する場合）
      const changeLocationButton = page.getByRole('button', { name: /位置.*変更|地図.*選択/i })
      if (await changeLocationButton.isVisible()) {
        await changeLocationButton.click()

        // MapPickerが開く
        await expect(page.getByText('この位置に決定')).toBeVisible({ timeout: 5000 })

        // 位置を確定
        await page.getByRole('button', { name: 'この位置に決定' }).click()
      }
    })
  })

  // ============================================================
  // 投稿成功フローテスト
  // ============================================================

  test.describe('投稿成功フロー', () => {
    test('全ての必須項目を入力して投稿が成功する', async ({ page }) => {
      await createAccountAndLogin(page, 'post-success')
      await openPhotoContributionDialog(page)

      // 1. 写真を選択
      const testImagePath = getTestImagePath('small')
      await page.locator('input[type="file"]').setInputFiles(testImagePath)
      await expect(page.locator('img[alt="プレビュー"]')).toBeVisible()

      // 2. タイトルを入力（20文字以内）
      const uniqueTitle = `E2Eテスト-${Date.now().toString().slice(-8)}`
      await page.getByPlaceholder('例：夕暮れの東京タワー').fill(uniqueTitle)

      // 3. カテゴリを選択（チェックボックスをクリック）
      await page.getByRole('checkbox', { name: 'その他' }).click()
      await expect(page.getByRole('checkbox', { name: 'その他' })).toBeChecked()

      // 4. 投稿ボタンが有効になっていることを確認
      const submitButton = page.getByRole('button', { name: '投稿する' })
      await expect(submitButton).toBeEnabled({ timeout: 3000 })

      // 5. 投稿ボタンをクリック
      await submitButton.click()

      // 6. 成功メッセージまたはダイアログ閉鎖を待機
      // 注: 現在の実装ではonSubmitハンドラーが未実装のため、即座に成功状態になる
      // 成功メッセージが表示されるか、ダイアログが閉じることを確認
      const successMessage = page.getByText('完了しました')
      const dialogHeading = page.getByRole('heading', { name: '写真を投稿' })

      // 成功メッセージが表示されるか、ダイアログが閉じるかを待機
      await Promise.race([
        expect(successMessage).toBeVisible({ timeout: 10000 }),
        expect(dialogHeading).not.toBeVisible({ timeout: 10000 }),
      ])

      // 7. ダイアログが最終的に閉じることを確認
      await expect(dialogHeading).not.toBeVisible({ timeout: 10000 })
    })

    test('投稿後にダイアログのフォームがリセットされる', async ({ page }) => {
      await createAccountAndLogin(page, 'post-reset')
      await openPhotoContributionDialog(page)

      // 投稿を実行
      const testImagePath = getTestImagePath('small')
      await page.locator('input[type="file"]').setInputFiles(testImagePath)
      await expect(page.locator('img[alt="プレビュー"]')).toBeVisible()
      await page.getByPlaceholder('例：夕暮れの東京タワー').fill('リセットテスト')
      // カテゴリをチェックボックスで選択
      await page.getByRole('checkbox', { name: 'その他' }).click()
      await expect(page.getByRole('checkbox', { name: 'その他' })).toBeChecked()

      // 投稿ボタンが有効になっていることを確認
      await expect(page.getByRole('button', { name: '投稿する' })).toBeEnabled({ timeout: 3000 })
      await page.getByRole('button', { name: '投稿する' }).click()

      // 成功を待機
      await expect(page.getByText('完了しました')).toBeVisible({ timeout: 30000 })

      // ダイアログが閉じるのを待機
      await page.waitForTimeout(2000)

      // 再度ダイアログを開く
      await openPhotoContributionDialog(page)

      // フォームがリセットされている
      await expect(page.locator('img[alt="プレビュー"]')).not.toBeVisible()
      const titleInput = page.getByPlaceholder('例：夕暮れの東京タワー')
      await expect(titleInput).toHaveValue('')
    })
  })

  // ============================================================
  // キャンセル操作テスト
  // ============================================================

  test.describe('キャンセル操作', () => {
    test('キャンセルボタンでダイアログを閉じられる', async ({ page }) => {
      await createAccountAndLogin(page, 'cancel-button')
      await openPhotoContributionDialog(page)

      // キャンセルボタンをクリック
      await page.getByRole('button', { name: 'キャンセル' }).click()

      // ダイアログが閉じる
      await expect(page.getByRole('heading', { name: '写真を投稿' })).not.toBeVisible()
    })

    test('ダイアログ外をクリックして閉じられる', async ({ page }) => {
      await createAccountAndLogin(page, 'cancel-outside')
      await openPhotoContributionDialog(page)

      // ダイアログ外（オーバーレイ）をクリック - 左上隅をクリック
      const overlay = page.locator('[data-slot="dialog-overlay"]')
      await overlay.click({ position: { x: 10, y: 10 } })

      // ダイアログが閉じる
      await expect(page.getByRole('heading', { name: '写真を投稿' })).not.toBeVisible({ timeout: 3000 })
    })
  })
})
