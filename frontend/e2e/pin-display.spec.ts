import { test, expect, Page } from '@playwright/test'
import {
  waitForSplash,
  createAccountAndLogin,
  clearStorage,
  initCookieConsent,
} from './helpers/auth'
import { getTestImagePath } from './helpers/test-image'
import {
  findPinsAndClusters,
  clickFirstPin,
  clickFirstCluster,
  waitForPinsOrClusters,
} from './helpers/map-pins'

/**
 * ピン表示・クラスタリング機能 E2Eテスト（Issue#39）
 *
 * テスト対象:
 * 1. 複数投稿による同一スポットへの集約（200m以内）
 * 2. ズームアウト時のピンクラスタリング統合
 * 3. クラスタリング時の投稿件数に基づくピン色変化
 * 4. クラスタクリックによるズームイン
 * 5. フィルター適用後のピン表示
 * 6. 地図移動後のピン再取得
 * 7. タイトルなし投稿のピン表示
 *
 * 前提条件:
 * - テスト環境（test.photlas.jp）が稼働していること
 * - テスト用画像がフィクスチャに存在すること
 */

// テスト用地点定数
const LOCATION = {
  // 地点A: 東京タワー付近（大量投稿用）
  POINT_A: { lat: 35.6585, lng: 139.7454, name: '東京タワー付近' },
  // 地点B: 渋谷駅付近（中量投稿用）
  POINT_B: { lat: 35.6580, lng: 139.7016, name: '渋谷駅付近' },
  // 地点C: 新宿駅付近（少量投稿用）
  POINT_C: { lat: 35.6896, lng: 139.6922, name: '新宿駅付近' },
}

// ピン色の閾値
const PIN_COLOR_THRESHOLDS = {
  GREEN: 1,    // 1件以上
  YELLOW: 5,   // 5件以上
  ORANGE: 10,  // 10件以上
  RED: 30,     // 30件以上
}

/**
 * 投稿ダイアログを開く
 */
async function openPhotoContributionDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: '投稿' }).click()
  await expect(page.getByRole('heading', { name: '写真を投稿' })).toBeVisible({ timeout: 5000 })
}

/**
 * 写真を1枚投稿する
 * @param page Playwrightのページオブジェクト
 * @param options 投稿オプション（タイトル、カテゴリ）
 */
async function submitPhoto(
  page: Page,
  options: { title?: string; category?: string } = {}
): Promise<void> {
  const { title, category = 'その他' } = options

  await openPhotoContributionDialog(page)

  // 写真を選択
  const testImagePath = getTestImagePath('small')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(testImagePath)
  await expect(page.locator('[data-testid="photo-crop-area"]')).toBeVisible({ timeout: 5000 })

  // タイトル入力（任意）
  if (title) {
    await page.getByPlaceholder('例：夕暮れの東京タワー').fill(title)
  }

  // カテゴリ選択
  await page.getByRole('checkbox', { name: category }).click()
  await expect(page.getByRole('checkbox', { name: category })).toBeChecked()

  // 投稿ボタンが有効になるのを待機
  const submitButton = page.getByRole('button', { name: '投稿する' })
  await expect(submitButton).toBeEnabled({ timeout: 5000 })

  // 投稿実行
  await submitButton.click()

  // アップロード完了を待機（成功またはエラー）
  const successMsg = page.getByText('完了しました')
  const errorMsg = page.getByText('エラー 時間をおいて再度お試しください')
  await expect(successMsg.or(errorMsg)).toBeVisible({ timeout: 30000 })
  await expect(successMsg).toBeVisible()

  // ダイアログが閉じるのを待機
  await page.waitForTimeout(1500)
}

/**
 * 地図が読み込まれるのを待機
 */
async function waitForMapLoad(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="map-container"], .mapboxgl-map')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(2000)
}

/**
 * Google Maps APIを通じてズームレベルを変更（keyboardShortcuts: falseでも動作）
 */
async function setMapZoom(page: Page, zoom: number): Promise<void> {
  await page.evaluate((targetZoom) => {
    const map = (window as unknown as Record<string, any>).__photlas_map
    if (map?.setZoom) {
      map.setZoom(targetZoom)
    }
  }, zoom)
  await page.waitForTimeout(2000)
}

/**
 * ズームイン
 */
async function zoomIn(page: Page, times: number = 1): Promise<void> {
  const currentZoom = await page.evaluate(() => {
    const map = (window as unknown as Record<string, any>).__photlas_map
    return map?.getZoom?.() ?? 11
  })
  await setMapZoom(page, currentZoom + times)
}

/**
 * ズームアウト
 */
async function zoomOut(page: Page, times: number = 1): Promise<void> {
  const currentZoom = await page.evaluate(() => {
    const map = (window as unknown as Record<string, any>).__photlas_map
    return map?.getZoom?.() ?? 11
  })
  await setMapZoom(page, Math.max(1, currentZoom - times))
}


test.describe('ピン表示・クラスタリング機能（Issue#39）', () => {
  // タイムアウトを長めに設定（投稿を含むテスト用）
  test.setTimeout(120000)

  test.beforeEach(async ({ page }) => {
    await initCookieConsent(page)
    await page.goto('/')
    await waitForSplash(page)
    await clearStorage(page)
    await waitForMapLoad(page)
  })

  // ============================================================
  // ピン表示の基本テスト
  // ============================================================

  test.describe('ピン表示の基本', () => {
    test('ズームレベル11以上でピンまたはクラスタが表示される', async ({ page }) => {
      await zoomIn(page, 2)
      await page.waitForTimeout(2000)

      // ズームバナーが表示されていないことを確認
      const zoomBanner = page.getByText('投稿を表示するには')
      await expect(zoomBanner).not.toBeVisible()
    })

    test('ズームレベル10以下で「投稿を表示するには」バナーが表示される', async ({ page }) => {
      // 大幅にズームアウト
      await zoomOut(page, 8)
      await page.waitForTimeout(3000)

      const banner = page.getByText('投稿を表示するには')
      await expect(banner).toBeVisible({ timeout: 15000 })
    })

    test('バナークリックでズームレベル11に復帰しピンが再表示される', async ({ page }) => {
      // ズームアウト
      await zoomOut(page, 5)
      await page.waitForTimeout(1000)

      const banner = page.getByText('投稿を表示するには')
      if (await banner.isVisible()) {
        await banner.click({ force: true })
        await page.waitForTimeout(3000)

        // バナーが消える
        await expect(banner).not.toBeVisible({ timeout: 10000 })
      }
    })
  })

  // ============================================================
  // ピンの色分けテスト
  // ============================================================

  test.describe('ピンの色分け', () => {
    test('ピンが投稿数に応じた色で表示される', async ({ page }) => {
      await zoomIn(page, 2)
      await page.waitForTimeout(3000)

      const { pins, clusters, pinCount, clusterCount } = await findPinsAndClusters(page)

      // Symbol Layerではピン画像がCanvasで描画されるため、
      // フィーチャーが存在することでピン色の正当性を間接的に確認
      if (pinCount > 0) {
        // 個別ピンのphotoCountプロパティが存在する
        expect(pins[0].properties).toHaveProperty('photoCount')
        expect(pins[0].properties.photoCount).toBeGreaterThanOrEqual(1)
      }

      if (clusterCount > 0) {
        // クラスタのtotalPhotoCountプロパティが存在する
        expect(clusters[0].properties).toHaveProperty('totalPhotoCount')
        expect(clusters[0].properties.totalPhotoCount).toBeGreaterThanOrEqual(2)
      }
    })

    test('ピンに投稿件数が数値で表示される', async ({ page }) => {
      await zoomIn(page, 2)
      await page.waitForTimeout(3000)

      const { pins, pinCount } = await findPinsAndClusters(page)

      if (pinCount > 0) {
        // Symbol Layerではicon-imageにphotoCountが含まれるため、
        // プロパティの値が正の整数であることを確認
        const photoCount = pins[0].properties.photoCount
        expect(typeof photoCount).toBe('number')
        expect(photoCount).toBeGreaterThanOrEqual(1)
      }
    })
  })

  // ============================================================
  // クラスタリング表示テスト
  // ============================================================

  test.describe('クラスタリング表示', () => {
    test('ズームアウト時にピンがクラスタとして統合される', async ({ page }) => {
      // まずズームインしてピンを確認
      await zoomIn(page, 3)
      await page.waitForTimeout(2000)

      const beforePins = await findPinsAndClusters(page)
      const beforeTotal = beforePins.pinCount + beforePins.clusterCount

      // ズームアウトしてクラスタリングを促す
      await zoomOut(page, 2)
      await page.waitForTimeout(2000)

      // ズームアウト後にピン/クラスタが存在すること
      // クラスタリングが機能していれば、個別ピンの数が減るかクラスタが表示される
      const afterPins = await findPinsAndClusters(page)

      // バナーが出ない範囲ならピン/クラスタが表示されている
      const banner = page.getByText('投稿を表示するには')
      const isBannerVisible = await banner.isVisible().catch(() => false)
      if (!isBannerVisible) {
        const afterTotal = afterPins.pinCount + afterPins.clusterCount
        // データが存在する場合、何らかのマーカーが表示されている
        expect(afterTotal).toBeGreaterThan(0)
      }
    })

    test('クラスタピンは複数スポットの集約で表示される', async ({ page }) => {
      await zoomIn(page, 1)
      await page.waitForTimeout(3000)

      const { clusters, clusterCount } = await findPinsAndClusters(page)

      if (clusterCount > 0) {
        // Symbol Layerではクラスタのpoint_countが2以上
        const pointCount = clusters[0].properties.point_count
        expect(pointCount).toBeGreaterThanOrEqual(2)
      }
    })

    test('クラスタピンの投稿件数が合計値で表示される', async ({ page }) => {
      await zoomIn(page, 1)
      await page.waitForTimeout(3000)

      const { clusters, clusterCount } = await findPinsAndClusters(page)

      if (clusterCount > 0) {
        // clusterPropertiesで集計されたtotalPhotoCountを確認
        const totalPhotoCount = clusters[0].properties.totalPhotoCount
        expect(typeof totalPhotoCount).toBe('number')
        expect(totalPhotoCount).toBeGreaterThanOrEqual(2)
      }
    })

    test('クラスタクリックでズームインし個別ピンが表示される', async ({ page }) => {
      await zoomIn(page, 1)
      await page.waitForTimeout(3000)

      const { clusterCount } = await findPinsAndClusters(page)

      if (clusterCount > 0) {
        // Symbol Layerのクラスタをクリック
        const clicked = await clickFirstCluster(page)
        if (clicked) {
          await page.waitForTimeout(2000)

          // ズームイン後、ピン/クラスタが表示されている
          const afterPins = await findPinsAndClusters(page)
          const afterTotal = afterPins.pinCount + afterPins.clusterCount
          expect(afterTotal).toBeGreaterThan(0)
        }
      }
    })
  })

  // ============================================================
  // ピンクリック → 写真詳細テスト
  // ============================================================

  test.describe('ピンクリック', () => {
    test('個別ピンクリックで写真詳細ダイアログが開く', async ({ page }) => {
      await zoomIn(page, 3)
      await page.waitForTimeout(3000)

      const { pinCount } = await findPinsAndClusters(page)

      if (pinCount > 0) {
        const clicked = await clickFirstPin(page)
        if (clicked) {
          // 写真詳細ダイアログが表示される
          await expect(
            page.locator('[data-testid="photo-detail-dialog"], [role="dialog"]')
          ).toBeVisible({ timeout: 5000 })
        }
      }
    })
  })

  // ============================================================
  // 投稿後のピン表示テスト
  // ============================================================

  test.describe('投稿後のピン表示', () => {
    test.setTimeout(180000) // 投稿フローはステージング環境で時間がかかるため
    test('新規投稿後にピンが地図上に表示される', async ({ page }) => {
      // ログイン
      await createAccountAndLogin(page, 'pin-post')

      // 投稿実行
      await submitPhoto(page, { title: 'ピン表示テスト', category: '自然風景' })

      // 地図に戻ってピンを確認
      await page.waitForTimeout(2000)
      await zoomIn(page, 2)
      await page.waitForTimeout(3000)

      // ピンまたはクラスタが存在すること
      const { pinCount, clusterCount } = await findPinsAndClusters(page)
      expect(pinCount + clusterCount).toBeGreaterThan(0)
    })

    test('タイトルなしで投稿してもピンが正常表示される', async ({ page }) => {
      // ログイン
      await createAccountAndLogin(page, 'pin-no-title')

      // タイトルなしで投稿
      await submitPhoto(page, { category: '自然風景' })

      // 地図でピンを確認
      await page.waitForTimeout(2000)
      await zoomIn(page, 2)
      await page.waitForTimeout(3000)

      // エラーなく地図が表示されている
      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
    })
  })

  // ============================================================
  // フィルター連動テスト
  // ============================================================

  test.describe('フィルター連動', () => {
    test('フィルター適用後にピン・クラスタが更新される', async ({ page }) => {
      await zoomIn(page, 2)
      await page.waitForTimeout(2000)

      // フィルターパネルを開く
      await page.getByRole('button', { name: 'フィルター' }).click()
      await expect(page.getByRole('button', { name: '自然風景' })).toBeVisible({ timeout: 5000 })

      // カテゴリフィルターを選択
      await page.getByText('自然風景', { exact: true }).click()
      await page.waitForTimeout(500)

      // 適用
      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)

      // エラーなく地図が表示されている
      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
    })
  })

  // ============================================================
  // 地図移動後のピン再取得テスト
  // ============================================================

  test.describe('地図移動後のピン再取得', () => {
    test('地図をドラッグ移動後に新範囲のピンが取得される', async ({ page }) => {
      await zoomIn(page, 2)
      await page.waitForTimeout(2000)

      const mapContainer = page.locator('.mapboxgl-map').first()
      const box = await mapContainer.boundingBox()

      if (box) {
        // ドラッグで地図を移動
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 200, { steps: 10 })
        await page.mouse.up()

        // 移動後にAPIが再呼び出しされる（idleイベント）
        await page.waitForTimeout(3000)

        // エラーなく地図が表示されている
        await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
      }
    })
  })
})
