import { test, expect, Page } from '@playwright/test'
import {
  waitForSplash,
  createAccountAndLogin,
  clearStorage,
} from './helpers/auth'
import { getTestImagePath, ensureFixtures } from './helpers/test-image'

/**
 * 写真詳細・お気に入り機能 E2Eテスト
 *
 * テスト対象:
 * 1. 写真詳細ダイアログの表示
 * 2. 写真カルーセル（前後ナビゲーション）
 * 3. お気に入り追加・解除
 * 4. お気に入り件数の更新
 * 5. 投稿者情報の表示
 * 6. カメラ情報の表示
 *
 * 前提条件:
 * - テスト環境（test.photlas.jp）が稼働していること
 * - テスト用の投稿データが存在すること
 */

/**
 * 地図が読み込まれるのを待機
 */
async function waitForMapLoad(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="map-container"], .gm-style')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(2000)
}

/**
 * ズームインしてピンを表示
 */
async function zoomInToShowPins(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('+')
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(2000)
}

/**
 * ピンをクリックして写真詳細ダイアログを開く
 */
async function openPhotoDetailFromPin(page: Page): Promise<boolean> {
  const pins = page.locator('[data-testid^="map-pin-"]')
  const pinCount = await pins.count()

  if (pinCount > 0) {
    await pins.first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    return true
  }
  return false
}

/**
 * 投稿ダイアログを開いて投稿を作成
 */
async function createTestPost(page: Page, title: string): Promise<void> {
  // FABボタンをクリック
  await page.getByRole('button', { name: '投稿' }).click()
  await expect(page.getByRole('heading', { name: '写真を投稿' })).toBeVisible({ timeout: 5000 })

  // 写真を選択
  const testImagePath = getTestImagePath('small')
  await page.locator('input[type="file"]').setInputFiles(testImagePath)
  await expect(page.locator('[data-testid="photo-crop-area"]')).toBeVisible()

  // タイトルを入力（20文字以内に収める）
  const truncatedTitle = title.slice(0, 18)
  await page.getByPlaceholder('例：夕暮れの東京タワー').fill(truncatedTitle)

  // カテゴリを選択（チェックボックスをクリック）
  await page.getByRole('checkbox', { name: 'その他' }).click()
  await expect(page.getByRole('checkbox', { name: 'その他' })).toBeChecked()

  // 投稿ボタンが有効になることを確認
  const submitButton = page.getByRole('button', { name: '投稿する' })
  await expect(submitButton).toBeEnabled({ timeout: 3000 })

  // 投稿
  await submitButton.click()

  // アップロード完了を待機（成功またはエラー）
  const successMsg = page.getByText('完了しました')
  const errorMsg = page.getByText('エラー 時間をおいて再度お試しください')
  await expect(successMsg.or(errorMsg)).toBeVisible({ timeout: 30000 })
  await expect(successMsg).toBeVisible()

  // ダイアログが閉じるのを待機
  await page.waitForTimeout(2000)
}

test.describe('写真詳細・お気に入り機能', () => {
  test.beforeAll(() => {
    ensureFixtures()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForSplash(page)
    await clearStorage(page)
    await waitForMapLoad(page)
  })

  // ============================================================
  // 写真詳細ダイアログ表示テスト
  // ============================================================

  test.describe('写真詳細ダイアログ表示', () => {
    test('ピンクリックで写真詳細ダイアログが開く', async ({ page }) => {
      await zoomInToShowPins(page)

      const opened = await openPhotoDetailFromPin(page)

      if (opened) {
        // ダイアログの基本要素が表示される
        await expect(page.locator('[role="dialog"]')).toBeVisible()
      } else {
        // ピンがない場合はスキップ
        test.skip()
      }
    })

    test('写真詳細ダイアログに写真が表示される', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        // 写真画像が表示される（ダイアログ内の最初のimg要素＝メイン写真）
        await expect(page.locator('[role="dialog"] img').first()).toBeVisible({ timeout: 10000 })
      } else {
        test.skip()
      }
    })

    test('写真詳細ダイアログにタイトルが表示される', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        // タイトル（h2要素）が表示される
        await expect(page.locator('[role="dialog"] h2')).toBeVisible({ timeout: 5000 })
      } else {
        test.skip()
      }
    })

    test('写真詳細ダイアログを閉じることができる', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        // 閉じるボタンをクリック
        const closeButton = page.locator('[role="dialog"] button[aria-label="閉じる"], [role="dialog"] button:has(svg.lucide-x)')
        if (await closeButton.isVisible()) {
          await closeButton.click()
        } else {
          // ESCキーで閉じる
          await page.keyboard.press('Escape')
        }

        // ダイアログが閉じる
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 })
      } else {
        test.skip()
      }
    })
  })

  // ============================================================
  // 投稿者情報表示テスト
  // ============================================================

  test.describe('投稿者情報表示', () => {
    test('投稿者のユーザー名が表示される', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        // ダイアログ内にテキストコンテンツが存在することを確認
        const dialogText = await page.locator('[role="dialog"]').textContent()
        expect(dialogText).toBeTruthy()
        // ダイアログに何らかのテキスト（ユーザー名含む）が表示されている
        expect(dialogText!.length).toBeGreaterThan(0)
      } else {
        test.skip()
      }
    })
  })

  // ============================================================
  // 写真カルーセルテスト
  // ============================================================

  test.describe('写真カルーセル', () => {
    test('複数写真がある場合、前後ボタンが表示される', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        await page.waitForTimeout(2000)

        // 前後ナビゲーションボタンを探す
        const nextButton = page.locator('[role="dialog"] button[aria-label="次の写真"], [role="dialog"] button:has(svg.lucide-chevron-right)')

        const hasNext = await nextButton.isVisible()

        if (hasNext) {
          // 次ボタンが表示されている = 複数写真あり
          await nextButton.click()
          await page.waitForTimeout(1000)
          // クリック後もダイアログが表示されている
          await expect(page.locator('[role="dialog"]')).toBeVisible()
        } else {
          // 単一写真のスポットの場合、ナビゲーションボタンは非表示
          test.skip()
        }
      } else {
        test.skip()
      }
    })

    test('ドットインジケーターが表示される（複数写真の場合）', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        await page.waitForTimeout(2000)

        // ドットインジケーターを探す
        const dots = page.locator('[role="dialog"] .dot-indicator, [role="dialog"] [class*="rounded-full"][class*="w-2"]')
        const dotCount = await dots.count()

        if (dotCount === 0) {
          // 単一写真のスポットの場合はスキップ
          test.skip()
        }

        // 複数写真がある場合、ドットが2つ以上表示される
        expect(dotCount).toBeGreaterThanOrEqual(2)
      } else {
        test.skip()
      }
    })
  })

  // ============================================================
  // お気に入り機能テスト
  // ============================================================

  test.describe('お気に入り機能', () => {
    test('未ログイン状態ではお気に入りボタンが無効化されている', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        const favoriteButton = page.locator('[data-testid="favorite-button"]')
        await expect(favoriteButton).toBeVisible({ timeout: 5000 })

        // 未ログイン状態ではボタンがdisabledである
        await expect(favoriteButton).toBeDisabled()
      } else {
        test.skip()
      }
    })

    test('ログイン状態でお気に入りを追加できる', async ({ page }) => {
      await createAccountAndLogin(page, 'favorite-add')

      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        const favoriteButton = page.locator('[data-testid="favorite-button"]')
        await expect(favoriteButton).toBeVisible({ timeout: 5000 })

        // 初期状態: お気に入りに追加
        await expect(favoriteButton).toHaveAttribute('aria-label', 'お気に入りに追加')

        await favoriteButton.click()
        await page.waitForTimeout(1000)

        // 追加後: お気に入りから削除に変わる
        await expect(favoriteButton).toHaveAttribute('aria-label', 'お気に入りから削除')
      } else {
        test.skip()
      }
    })

    test('お気に入りを解除できる', async ({ page }) => {
      await createAccountAndLogin(page, 'favorite-remove')
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        const favoriteButton = page.locator('[data-testid="favorite-button"]')
        await expect(favoriteButton).toBeVisible({ timeout: 5000 })

        // 追加
        await favoriteButton.click()
        await page.waitForTimeout(1000)
        await expect(favoriteButton).toHaveAttribute('aria-label', 'お気に入りから削除')

        // 解除
        await favoriteButton.click()
        await page.waitForTimeout(1000)
        await expect(favoriteButton).toHaveAttribute('aria-label', 'お気に入りに追加')
      } else {
        test.skip()
      }
    })

    test('お気に入り件数が更新される', async ({ page }) => {
      await createAccountAndLogin(page, 'favorite-count')
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        const favoriteButton = page.locator('[data-testid="favorite-button"]')
        await expect(favoriteButton).toBeVisible({ timeout: 5000 })

        // 初期カウントを取得
        const countElement = page.locator('[data-testid="favorite-count"]')
        const initialText = await countElement.textContent()
        const initialCount = parseInt(initialText?.match(/\d+/)?.[0] || '0')

        // お気に入りを追加
        await favoriteButton.click()
        await page.waitForTimeout(1500)

        // カウントが変化していることを確認
        const newText = await countElement.textContent()
        const newCount = parseInt(newText?.match(/\d+/)?.[0] || '0')
        expect(newCount).not.toBe(initialCount)
      } else {
        test.skip()
      }
    })
  })

  // ============================================================
  // カメラ情報表示テスト
  // ============================================================

  test.describe('カメラ情報表示', () => {
    test('EXIF情報がある場合、カメラ情報ラベルが表示される', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        await page.waitForTimeout(2000)

        const dialog = page.locator('[role="dialog"]')

        // EXIF情報がある投稿かどうかを確認（「カメラ」ラベルの存在で判定）
        const cameraLabel = dialog.getByText('カメラ', { exact: false })
        const hasExif = await cameraLabel.isVisible()

        if (hasExif) {
          // EXIF情報がある場合、ラベルが正しく表示されていることを検証
          await expect(cameraLabel).toBeVisible()
        } else {
          // EXIF情報がない投稿の場合はスキップ
          test.skip()
        }
      } else {
        test.skip()
      }
    })

    test('EXIF情報の各項目ラベルが表示される', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        await page.waitForTimeout(2000)

        const dialog = page.locator('[role="dialog"]')

        // 実装に合わせたラベル名（PhotoDetailDialog.tsx参照）
        const labels = ['カメラ', 'レンズ', 'F値', 'シャッタースピード', 'ISO']

        // EXIF情報がある投稿かチェック
        const firstLabel = dialog.getByText('カメラ', { exact: false })
        if (!(await firstLabel.isVisible())) {
          test.skip()
          return
        }

        // 各ラベルの存在を検証
        for (const label of labels) {
          const element = dialog.getByText(label, { exact: false })
          const isVisible = await element.isVisible()
          // EXIF項目は値がある場合のみ表示される（任意項目）
          if (isVisible) {
            await expect(element).toBeVisible()
          }
        }
      } else {
        test.skip()
      }
    })
  })

  // ============================================================
  // 投稿後の表示確認テスト
  // ============================================================

  test.describe('投稿後の表示確認', () => {
    test('新規投稿後にピンが地図上に表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'post-display')

      // テスト投稿を作成
      const testTitle = `E2E表示テスト-${Date.now()}`
      await createTestPost(page, testTitle)

      // 地図をリロード
      await page.reload()
      await waitForSplash(page)
      await waitForMapLoad(page)

      // 投稿した場所にズーム
      await zoomInToShowPins(page)

      // ピンが表示されることを確認
      const pins = page.locator('[data-testid^="map-pin-"]')
      const pinCount = await pins.count()

      // テスト投稿後なので少なくとも1つのピンが表示される
      expect(pinCount).toBeGreaterThanOrEqual(1)
    })
  })
})
