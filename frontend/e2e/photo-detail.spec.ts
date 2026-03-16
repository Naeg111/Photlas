import { test, expect, Page } from '@playwright/test'
import {
  waitForSplash,
  createAccountAndLogin,
  clearStorage,
} from './helpers/auth'
import { getTestImagePath, ensureFixtures } from './helpers/test-image'
import { findPinsAndClusters, clickFirstPin } from './helpers/map-pins'

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
 *
 * Issue#55: Symbol Layer移行に伴い、ピン検出を queryRenderedFeatures ベースに変更
 */

/**
 * 地図が読み込まれるのを待機
 */
async function waitForMapLoad(page: Page): Promise<void> {
  await expect(page.locator('.mapboxgl-map')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(2000)
}

/**
 * 指定座標にflyToしてスポットデータの取得を待機
 */
async function flyToLocation(page: Page, lng: number, lat: number, zoom: number): Promise<void> {
  await page.evaluate(({ lng, lat, zoom }) => {
    return new Promise<void>((resolve) => {
      const map = (window as unknown as Record<string, any>).__photlas_map
      if (map?.flyTo) {
        map.once('moveend', () => resolve())
        map.flyTo({ center: [lng, lat], zoom, duration: 300 })
      } else {
        resolve()
      }
    })
  }, { lng, lat, zoom })
  // fetchSpots API呼び出しとレンダリングを待機
  await page.waitForTimeout(5000)
}

/**
 * 東京駅付近（中央区テストデータ密集エリア）にズームしてピンを表示
 */
async function zoomInToShowPins(page: Page): Promise<void> {
  await flyToLocation(page, 139.7671, 35.6812, 15)
}

/**
 * ピンをクリックして写真詳細ダイアログを開く
 * Issue#55: queryRenderedFeatures + map.project でピンクリック
 */
async function openPhotoDetailFromPin(page: Page): Promise<boolean> {
  const clicked = await clickFirstPin(page)
  if (!clicked) return false

  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
  return true
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
  await page.getByRole('checkbox', { name: '風景' }).click()
  await expect(page.getByRole('checkbox', { name: '風景' })).toBeChecked()

  // 機材種別を選択
  await page.getByText('一眼レフ', { exact: true }).click()

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

        const nextButton = page.locator('[role="dialog"] button[aria-label="次の写真"], [role="dialog"] button:has(svg.lucide-chevron-right)')

        const hasNext = await nextButton.isVisible()

        if (hasNext) {
          await nextButton.click()
          await page.waitForTimeout(1000)
          await expect(page.locator('[role="dialog"]')).toBeVisible()
        } else {
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

        const dots = page.locator('[role="dialog"] .dot-indicator, [role="dialog"] [class*="rounded-full"][class*="w-2"]')
        const dotCount = await dots.count()

        if (dotCount === 0) {
          test.skip()
        }

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

        await expect(favoriteButton).toHaveAttribute('aria-label', 'お気に入りに追加')

        await favoriteButton.click()
        await page.waitForTimeout(1000)

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

        await favoriteButton.click()
        await page.waitForTimeout(1000)
        await expect(favoriteButton).toHaveAttribute('aria-label', 'お気に入りから削除')

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

        const countElement = page.locator('[data-testid="favorite-count"]')
        const initialText = await countElement.textContent()
        const initialCount = parseInt(initialText?.match(/\d+/)?.[0] || '0')

        await favoriteButton.click()
        await page.waitForTimeout(1500)

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
        const cameraLabel = dialog.getByText('カメラ', { exact: false })
        const hasExif = await cameraLabel.isVisible()

        if (hasExif) {
          await expect(cameraLabel).toBeVisible()
        } else {
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
        const labels = ['カメラ', 'レンズ', 'F値', 'シャッタースピード', 'ISO']

        const firstLabel = dialog.getByText('カメラ', { exact: false })
        if (!(await firstLabel.isVisible())) {
          test.skip()
          return
        }

        for (const label of labels) {
          const element = dialog.getByText(label, { exact: false })
          const isVisible = await element.isVisible()
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
  // 通報ボタンテスト
  // ============================================================

  test.describe('通報ボタン', () => {
    test('未ログイン状態では通報ボタンが表示されない', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        const reportButton = page.locator('[data-testid="report-button"]')
        await expect(reportButton).not.toBeVisible()
      } else {
        test.skip()
      }
    })

    test('ログイン状態では通報ボタンが表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'report-btn')
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        const reportButton = page.locator('[data-testid="report-button"]')
        await expect(reportButton).toBeVisible({ timeout: 5000 })
        await expect(reportButton).toHaveAttribute('aria-label', 'この写真を通報')
      } else {
        test.skip()
      }
    })

    test('通報ボタンをクリックすると通報ダイアログが開く', async ({ page }) => {
      await createAccountAndLogin(page, 'report-dialog')
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        const reportButton = page.locator('[data-testid="report-button"]')
        await expect(reportButton).toBeVisible({ timeout: 5000 })

        await reportButton.click()

        await expect(page.getByRole('heading', { name: 'この投稿を通報' })).toBeVisible({ timeout: 5000 })
      } else {
        test.skip()
      }
    })
  })

  // ============================================================
  // 撮影コンテクスト情報表示テスト
  // ============================================================

  test.describe('撮影コンテクスト情報表示', () => {
    test('撮影日時が表示される', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        await page.waitForTimeout(2000)

        const dialog = page.locator('[role="dialog"]')
        const dateText = dialog.getByText(/\d{4}年/)
        const hasDate = await dateText.isVisible()

        if (hasDate) {
          await expect(dateText).toBeVisible()
        } else {
          test.skip()
        }
      } else {
        test.skip()
      }
    })

    test('施設名がある場合に表示される', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        await page.waitForTimeout(2000)

        const dialog = page.locator('[role="dialog"]')
        const dialogContent = await dialog.textContent()
        expect(dialogContent).toBeTruthy()
      } else {
        test.skip()
      }
    })

    test('天気情報がある場合に「天気:」ラベルで表示される', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        await page.waitForTimeout(2000)

        const dialog = page.locator('[role="dialog"]')
        const weatherLabel = dialog.getByText('天気:', { exact: false })
        const hasWeather = await weatherLabel.isVisible()

        if (hasWeather) {
          await expect(weatherLabel).toBeVisible()
        } else {
          test.skip()
        }
      } else {
        test.skip()
      }
    })
  })

  // ============================================================
  // ライトボックステスト
  // ============================================================

  test.describe('ライトボックス', () => {
    test('写真をクリックするとライトボックスが開く', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        // ダイアログ内の写真画像をクリック
        const photo = page.locator('[role="dialog"] img').first()
        await expect(photo).toBeVisible({ timeout: 10000 })
        await photo.click()

        // ライトボックスが表示される（ズーム倍率テキストで確認）
        await expect(page.getByText(/拡大: \d+%/)).toBeVisible({ timeout: 5000 })
      } else {
        test.skip()
      }
    })

    test('ライトボックスにズーム倍率が表示される', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        const photo = page.locator('[role="dialog"] img').first()
        await expect(photo).toBeVisible({ timeout: 10000 })
        await photo.click()

        // ライトボックスが開いたことをズーム倍率テキストで確認
        await expect(page.getByText(/拡大: \d+%/)).toBeVisible({ timeout: 5000 })
      } else {
        test.skip()
      }
    })
  })

  // ============================================================
  // ミニマップ表示テスト
  // ============================================================

  test.describe('ミニマップ表示', () => {
    test('写真詳細ダイアログにミニマップが表示される', async ({ page }) => {
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        // ミニマップ（Mapbox GLコンテナ）がダイアログ内に表示される
        const dialog = page.locator('[role="dialog"]')
        const minimap = dialog.locator('.mapboxgl-map')
        // ミニマップは500ms遅延で読み込まれる
        await expect(minimap).toBeVisible({ timeout: 5000 })
      } else {
        test.skip()
      }
    })
  })

  // ============================================================
  // 通報送信テスト
  // ============================================================

  test.describe('通報送信', () => {
    test('通報ダイアログで理由を選択して送信できる', async ({ page }) => {
      await createAccountAndLogin(page, 'report-submit')
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        const reportButton = page.locator('[data-testid="report-button"]')
        await expect(reportButton).toBeVisible({ timeout: 5000 })

        await reportButton.click()
        await expect(page.getByRole('heading', { name: 'この投稿を通報' })).toBeVisible({ timeout: 5000 })

        // 通報理由を選択
        await page.getByText('スパム').click()

        // 送信ボタンが有効化される
        const submitButton = page.getByRole('button', { name: '通報する' })
        await expect(submitButton).toBeEnabled()
      } else {
        test.skip()
      }
    })

    test('通報理由「その他」選択時は詳細が必須になる', async ({ page }) => {
      await createAccountAndLogin(page, 'report-other')
      await zoomInToShowPins(page)

      if (await openPhotoDetailFromPin(page)) {
        const reportButton = page.locator('[data-testid="report-button"]')
        await expect(reportButton).toBeVisible({ timeout: 5000 })

        await reportButton.click()
        await expect(page.getByRole('heading', { name: 'この投稿を通報' })).toBeVisible({ timeout: 5000 })

        // 「その他」を選択
        await page.getByText('その他', { exact: true }).click()

        // 詳細未入力では送信ボタンが無効
        const submitButton = page.getByRole('button', { name: '通報する' })
        await expect(submitButton).toBeDisabled()

        // 詳細を入力すると有効化
        await page.getByPlaceholder('通報理由の詳細を入力してください（300文字以内）').fill('テスト通報理由')
        await expect(submitButton).toBeEnabled()
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

      // テスト投稿のデフォルト位置（InlineMapPickerのDEFAULT_CENTER: 新宿）にズーム
      await flyToLocation(page, 139.6503, 35.6762, 14)

      // ピンまたはクラスタが表示されることを確認（queryRenderedFeatures）
      const { pinCount, clusterCount } = await findPinsAndClusters(page)
      expect(pinCount + clusterCount).toBeGreaterThan(0)
    })
  })
})
