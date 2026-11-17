import { test, expect, Page } from '@playwright/test'
import {
  waitForSplash,
  createAccountAndLogin,
  clearStorage,
  initCookieConsent,
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
  '自然風景', '街並み', '建造物', '夜景', 'グルメ', '植物',
  '動物', '野鳥', '自動車', 'バイク', '鉄道', '飛行機', '星空', 'その他',
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

/** 位置情報のない写真を選んだときのピンの既定の位置（東京駅。PhotoContributionDialog と同じ） */
const DEFAULT_PIN_POSITION = { lat: 35.6812, lng: 139.7671 }
/** 地図をドラッグする距離（px） */
const MAP_DRAG_PX = 150
/** ドラッグで位置がずれたとみなす最小の量（度）。ズーム 15 で 150px は経度 0.003 度ほど（慣性でさらに動くこともある） */
const MIN_DRAG_SHIFT_DEG = 0.001
/** 地図の移動（アニメーション）が終わるまで待つ時間 */
const MAP_SETTLE_MS = 2000

/**
 * 写真の投稿で呼ばれる API を偽の応答に置き換え、投稿（POST /api/v1/photos）の中身を記録する。
 * S3 へのアップロードと AI 解析は、ローカルでは AWS につながらず、位置のテストの対象でもないため。
 */
async function mockPhotoPostingApis(page: Page): Promise<Array<{ latitude: number; longitude: number }>> {
  const createPhotoRequests: Array<{ latitude: number; longitude: number }> = []
  await page.route('**/api/v1/photos/analyze', (route) => route.fulfill({ status: 503, body: '' }))
  await page.route('**/api/v1/photos/upload-url', (route) =>
    route.fulfill({
      json: { uploadUrl: 'http://localhost:5173/e2e-mock-s3/photo.jpg', objectKey: 'uploads/e2e/photo.jpg' },
    })
  )
  await page.route('**/e2e-mock-s3/**', (route) => route.fulfill({ status: 200, body: '' }))
  await page.route('**/api/v1/photos', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    createPhotoRequests.push(route.request().postDataJSON())
    await route.fulfill({
      status: 201,
      json: {
        photo: {
          photo_id: 999999,
          image_url: '',
          shot_at: '2026-01-01T00:00:00',
          weather: null,
          is_favorited: false,
          favorite_count: 0,
        },
        spot: { spot_id: 999999, latitude: 0, longitude: 0 },
      },
    })
  })
  return createPhotoRequests
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
    await initCookieConsent(page)
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

    test('投稿ダイアログに14種類のジャンルが表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'photo-categories')
      await openPhotoContributionDialog(page)

      // 全ジャンルがチェックボックスとして表示されていることを確認
      for (const category of PHOTO_CATEGORIES) {
        await expect(page.getByRole('checkbox', { name: category })).toBeVisible()
      }
      expect(PHOTO_CATEGORIES).toHaveLength(14)
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
      await expect(page.locator('[data-testid="photo-crop-area"]')).toBeVisible({ timeout: 5000 })
    })

    test('選択した写真を削除できる', async ({ page }) => {
      await createAccountAndLogin(page, 'photo-delete')
      await openPhotoContributionDialog(page)

      // ファイル選択
      const testImagePath = getTestImagePath('small')
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(testImagePath)

      // プレビューが表示される
      await expect(page.locator('[data-testid="photo-crop-area"]')).toBeVisible()

      // 削除ボタンをクリック
      await page.getByRole('button', { name: '削除' }).click()

      // プレビューが消える
      await expect(page.locator('[data-testid="photo-crop-area"]')).not.toBeVisible()
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
        await page.getByRole('checkbox', { name: '自然風景' }).click()

        // 投稿ボタンがdisabledであることを確認
        const submitButton = page.getByRole('button', { name: '投稿する' })
        await expect(submitButton).toBeDisabled()
      })

      test('タイトルが未入力でも投稿ボタンが有効になる（タイトルは任意項目）', async ({ page }) => {
        await createAccountAndLogin(page, 'validation-title')
        await openPhotoContributionDialog(page)

        // 写真・カテゴリ・機材種別を選択（タイトルは入力しない）
        const testImagePath = getTestImagePath('small')
        await page.locator('input[type="file"]').setInputFiles(testImagePath)
        await expect(page.locator('[data-testid="photo-crop-area"]')).toBeVisible()
        // カテゴリのチェックボックスをクリック
        await page.getByRole('checkbox', { name: '自然風景' }).click()
        await expect(page.getByRole('checkbox', { name: '自然風景' })).toBeChecked()
        // 機材種別を選択
        await page.getByText('一眼レフ', { exact: true }).click()

        // タイトルは任意項目のため、投稿ボタンが有効であることを確認
        const submitButton = page.getByRole('button', { name: '投稿する' })
        await expect(submitButton).toBeEnabled({ timeout: 3000 })
      })

      test('カテゴリが未選択の場合は投稿できない', async ({ page }) => {
        await createAccountAndLogin(page, 'validation-category')
        await openPhotoContributionDialog(page)

        // 写真とタイトルを入力
        const testImagePath = getTestImagePath('small')
        await page.locator('input[type="file"]').setInputFiles(testImagePath)
        await expect(page.locator('[data-testid="photo-crop-area"]')).toBeVisible()
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

        // ダイアログハンドラーを先に設定（evaluate内のalertでデッドロックを防止）
        let dialogMessage = ''
        page.on('dialog', async (dialog) => {
          dialogMessage = dialog.message()
          await dialog.accept()
        })

        await page.evaluate(() => {
          const smallBlob = new Blob(['x'], { type: 'image/jpeg' })
          const largeFile = new File([smallBlob], 'large.jpg', { type: 'image/jpeg' })
          Object.defineProperty(largeFile, 'size', { value: 51 * 1024 * 1024 })
          const dataTransfer = new DataTransfer()
          dataTransfer.items.add(largeFile)
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
          fileInput.files = dataTransfer.files
          fileInput.dispatchEvent(new Event('change', { bubbles: true }))
        })

        await page.waitForTimeout(1000)
        expect(dialogMessage).toContain('50MB')

        // プレビューが表示されないことを確認
        await expect(page.locator('[data-testid="photo-crop-area"]')).not.toBeVisible()
      })

      test('非対応形式（GIF）のファイルは選択できない', async ({ page }) => {
        await createAccountAndLogin(page, 'validation-format')
        await openPhotoContributionDialog(page)

        let dialogMessage = ''
        page.on('dialog', async (dialog) => {
          dialogMessage = dialog.message()
          await dialog.accept()
        })

        await page.evaluate(() => {
          const gifFile = new File(
            [new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
            'test.gif',
            { type: 'image/gif' }
          )
          const dataTransfer = new DataTransfer()
          dataTransfer.items.add(gifFile)
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
          fileInput.files = dataTransfer.files
          fileInput.dispatchEvent(new Event('change', { bubbles: true }))
        })

        await page.waitForTimeout(1000)
        expect(dialogMessage).toContain('JPEG、PNG、HEIC')

        // プレビューが表示されないことを確認
        await expect(page.locator('[data-testid="photo-crop-area"]')).not.toBeVisible()
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
      const categoryCheckbox = page.getByRole('checkbox', { name: '自然風景' })
      await categoryCheckbox.click()

      // チェックされていることを確認
      await expect(categoryCheckbox).toBeChecked()
    })

    test('複数カテゴリを選択できる', async ({ page }) => {
      await createAccountAndLogin(page, 'category-multiple')
      await openPhotoContributionDialog(page)

      // 複数のカテゴリを選択
      await page.getByRole('checkbox', { name: '自然風景' }).click()
      await page.getByRole('checkbox', { name: '街並み' }).click()
      await page.getByRole('checkbox', { name: '星空' }).click()

      // 3つとも選択されている
      await expect(page.getByRole('checkbox', { name: '自然風景' })).toBeChecked()
      await expect(page.getByRole('checkbox', { name: '街並み' })).toBeChecked()
      await expect(page.getByRole('checkbox', { name: '星空' })).toBeChecked()
    })

    test('選択したカテゴリを解除できる', async ({ page }) => {
      await createAccountAndLogin(page, 'category-deselect')
      await openPhotoContributionDialog(page)

      const categoryCheckbox = page.getByRole('checkbox', { name: '自然風景' })

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
      await expect(page.locator('[data-testid="photo-crop-area"]')).toBeVisible()

      // InlineMapPickerが表示されていることで位置設定済みを確認
      await expect(page.getByText('地図をドラッグして撮影場所にピンを合わせてください')).toBeVisible({ timeout: 5000 })
    })

    test('地図をドラッグすると、投稿する位置が変わる', async ({ page }) => {
      const createPhotoRequests = await mockPhotoPostingApis(page)

      await createAccountAndLogin(page, 'location-change')
      await openPhotoContributionDialog(page)

      // 位置情報（EXIF の GPS）のない写真を選ぶと、ピンは既定の位置（東京駅）に置かれる
      await page.locator('input[type="file"]').setInputFiles(getTestImagePath('small'))
      await expect(page.getByText('マップをドラッグして撮影場所にピンを合わせてください')).toBeVisible({ timeout: 5000 })
      const mapPicker = page.getByTestId('inline-map-picker')
      await expect(mapPicker.locator('canvas.mapboxgl-canvas')).toBeVisible({ timeout: 10000 })
      // 既定の位置への移動（アニメーション）が終わるのを待ってから、地図全体が見える位置までスクロールする
      await page.waitForTimeout(MAP_SETTLE_MS)
      await mapPicker.scrollIntoViewIfNeeded()

      // 地図を左へドラッグする。中心に固定されたピンの位置は、東（経度が大きい方）へずれる
      const box = await mapPicker.boundingBox()
      if (!box) throw new Error('地図の位置を取得できません')
      const startX = box.x + box.width / 2
      const startY = box.y + box.height / 2
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.mouse.move(startX - MAP_DRAG_PX, startY, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(MAP_SETTLE_MS)

      // 必須項目を選んで投稿する
      await page.getByText('自然風景', { exact: true }).click()
      await page.getByText('スマートフォン', { exact: true }).click()
      const submitButton = page.getByRole('button', { name: '投稿する' })
      await expect(submitButton).toBeEnabled({ timeout: 3000 })
      await submitButton.click()

      // 投稿の API に、ドラッグした後の位置が送られる
      await expect.poll(() => createPhotoRequests.length, { timeout: 15000 }).toBe(1)
      const { latitude, longitude } = createPhotoRequests[0]
      expect(longitude).toBeGreaterThan(DEFAULT_PIN_POSITION.lng + MIN_DRAG_SHIFT_DEG)
      expect(Math.abs(latitude - DEFAULT_PIN_POSITION.lat)).toBeLessThan(MIN_DRAG_SHIFT_DEG)
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
      await expect(page.locator('[data-testid="photo-crop-area"]')).toBeVisible()

      // 2. タイトルを入力（20文字以内）
      const uniqueTitle = `E2Eテスト-${Date.now().toString().slice(-8)}`
      await page.getByPlaceholder('例：夕暮れの東京タワー').fill(uniqueTitle)

      // 3. カテゴリを選択（チェックボックスをクリック）
      await page.getByRole('checkbox', { name: '自然風景' }).click()
      await expect(page.getByRole('checkbox', { name: '自然風景' })).toBeChecked()

      // 4. 機材種別を選択
      await page.getByText('一眼レフ', { exact: true }).click()

      // 5. 投稿ボタンが有効になっていることを確認してクリック
      const submitButton = page.getByRole('button', { name: '投稿する' })
      await expect(submitButton).toBeEnabled({ timeout: 3000 })
      await submitButton.click()

      // 6. アップロード成功を待機
      await expect(page.getByText('完了しました')).toBeVisible({ timeout: 30000 })

      // 7. ダイアログが最終的に閉じることを確認
      const dialogHeading = page.getByRole('heading', { name: '写真を投稿' })
      await expect(dialogHeading).not.toBeVisible({ timeout: 10000 })
    })

    test('投稿後にダイアログのフォームがリセットされる', async ({ page }) => {
      await createAccountAndLogin(page, 'post-reset')
      await openPhotoContributionDialog(page)

      // 投稿を実行
      const testImagePath = getTestImagePath('small')
      await page.locator('input[type="file"]').setInputFiles(testImagePath)
      await expect(page.locator('[data-testid="photo-crop-area"]')).toBeVisible()
      await page.getByPlaceholder('例：夕暮れの東京タワー').fill('リセットテスト')
      // カテゴリをチェックボックスで選択
      await page.getByRole('checkbox', { name: '自然風景' }).click()
      await expect(page.getByRole('checkbox', { name: '自然風景' })).toBeChecked()
      // 機材種別を選択
      await page.getByText('一眼レフ', { exact: true }).click()

      // 投稿ボタンが有効になっていることを確認
      await expect(page.getByRole('button', { name: '投稿する' })).toBeEnabled({ timeout: 3000 })
      await page.getByRole('button', { name: '投稿する' }).click()

      // アップロード完了を待機
      const successMsg = page.getByText('完了しました')
      await expect(successMsg).toBeVisible({ timeout: 30000 })

      // ダイアログが閉じるのを待機
      await page.waitForTimeout(2000)

      // 再度ダイアログを開く
      await openPhotoContributionDialog(page)

      // フォームがリセットされている
      await expect(page.locator('[data-testid="photo-crop-area"]')).not.toBeVisible()
      const titleInput = page.getByPlaceholder('例：夕暮れの東京タワー')
      await expect(titleInput).toHaveValue('')
    })
  })

  // ============================================================
  // 機材種別選択テスト
  // ============================================================

  test.describe('機材種別選択', () => {
    test('6種類の機材種別が表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'device-type-list')
      await openPhotoContributionDialog(page)

      // 「その他」はカテゴリにも存在するため、重複しない5種類で確認し、
      // 「その他」は機材種別セクション内で確認する
      const uniqueDeviceTypes = ['一眼レフ', 'ミラーレス', 'コンパクトデジカメ', 'スマートフォン', 'フィルム']
      for (const type of uniqueDeviceTypes) {
        await expect(page.getByText(type, { exact: true })).toBeVisible()
      }
      // 機材種別の「その他」: カテゴリのチェックボックスではないほうを確認
      const deviceOther = page.getByText('その他', { exact: true }).nth(1)
      await expect(deviceOther).toBeVisible()
    })

    test('機材種別を選択できる', async ({ page }) => {
      await createAccountAndLogin(page, 'device-type-select')
      await openPhotoContributionDialog(page)

      // 一眼レフを選択
      const slrOption = page.getByText('一眼レフ', { exact: true })
      await slrOption.click()

      // 選択状態のスタイルが適用される（border-primaryクラス）
      const container = slrOption.locator('..')
      await expect(container).toHaveClass(/border-primary/)
    })

    test('機材種別が未選択の場合は投稿できない', async ({ page }) => {
      await createAccountAndLogin(page, 'device-type-required')
      await openPhotoContributionDialog(page)

      // 写真・カテゴリを選択（機材種別は選択しない）
      const testImagePath = getTestImagePath('small')
      await page.locator('input[type="file"]').setInputFiles(testImagePath)
      await expect(page.locator('[data-testid="photo-crop-area"]')).toBeVisible()
      await page.getByRole('checkbox', { name: '自然風景' }).click()

      // 投稿ボタンがdisabledであることを確認
      const submitButton = page.getByRole('button', { name: '投稿する' })
      await expect(submitButton).toBeDisabled()
    })
  })

  // ============================================================
  // 天気選択テスト
  // ============================================================

  test.describe('天気選択', () => {
    test('4種類の天気が表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'weather-list')
      await openPhotoContributionDialog(page)

      const weatherOptions = ['晴れ', '曇り', '雨', '雪']
      for (const weather of weatherOptions) {
        await expect(page.getByText(weather, { exact: true })).toBeVisible()
      }
    })

    test('天気を選択・解除できる（トグル動作）', async ({ page }) => {
      await createAccountAndLogin(page, 'weather-toggle')
      await openPhotoContributionDialog(page)

      // 晴れを選択
      const sunnyOption = page.getByText('晴れ', { exact: true })
      await sunnyOption.click()

      // 選択状態のスタイルが適用される
      const container = sunnyOption.locator('..')
      await expect(container).toHaveClass(/border-primary/)

      // 同じ天気をクリックして解除
      await sunnyOption.click()

      // 選択解除される
      await expect(container).not.toHaveClass(/border-primary/)
    })
  })

  // ============================================================
  // 施設名・店名入力テスト
  // ============================================================

  test.describe('施設名・店名入力', () => {
    test('施設名の入力欄と文字数カウンターが表示される', async ({ page }) => {
      await createAccountAndLogin(page, 'place-name-display')
      await openPhotoContributionDialog(page)

      // 施設名入力欄が表示される
      const placeNameInput = page.getByPlaceholder('例：東京タワー、スターバックス渋谷店')
      await expect(placeNameInput).toBeVisible()

      // 文字数カウンターが表示される
      await expect(page.getByText('0/100文字')).toBeVisible()
    })

    test('施設名を入力すると文字数カウンターが更新される', async ({ page }) => {
      await createAccountAndLogin(page, 'place-name-counter')
      await openPhotoContributionDialog(page)

      const placeNameInput = page.getByPlaceholder('例：東京タワー、スターバックス渋谷店')
      await placeNameInput.fill('東京タワー')

      // カウンターが更新される
      await expect(page.getByText('5/100文字')).toBeVisible()
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
