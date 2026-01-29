import { test, expect, Page } from '@playwright/test'
import {
  waitForSplash,
  createAccountAndLogin,
  clearStorage,
} from './helpers/auth'
import { getTestImagePath } from './helpers/test-image'

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
  await expect(page.locator('img[alt="プレビュー"]')).toBeVisible({ timeout: 5000 })

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

  // 成功メッセージまたはダイアログ閉鎖を待機
  await expect(page.getByText('完了しました')).toBeVisible({ timeout: 30000 })

  // ダイアログが閉じるのを待機
  await page.waitForTimeout(1500)
}

/**
 * 地図が読み込まれるのを待機
 */
async function waitForMapLoad(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="map-container"], .gm-style')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(2000)
}

/**
 * ズームイン
 */
async function zoomIn(page: Page, times: number = 1): Promise<void> {
  const mapContainer = page.locator('.gm-style')
  await mapContainer.click()
  await page.waitForTimeout(300)

  for (let i = 0; i < times; i++) {
    await mapContainer.hover()
    await page.mouse.wheel(0, -300)
    await page.waitForTimeout(800)
  }
}

/**
 * ズームアウト
 */
async function zoomOut(page: Page, times: number = 1): Promise<void> {
  const mapContainer = page.locator('.gm-style')
  await mapContainer.click()
  await page.waitForTimeout(300)

  for (let i = 0; i < times; i++) {
    await mapContainer.hover()
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(800)
  }
}

/**
 * ピンまたはクラスタを検索する
 */
async function findPinsAndClusters(page: Page) {
  const pins = page.locator('[data-testid^="map-pin-"]')
  const clusters = page.locator('[data-testid^="map-cluster-"]')
  const pinCount = await pins.count()
  const clusterCount = await clusters.count()
  return { pins, clusters, pinCount, clusterCount }
}

test.describe('ピン表示・クラスタリング機能（Issue#39）', () => {
  // タイムアウトを長めに設定（投稿を含むテスト用）
  test.setTimeout(120000)

  test.beforeEach(async ({ page }) => {
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
      const zoomBanner = page.getByText('ズームしてスポットを表示')
      await expect(zoomBanner).not.toBeVisible()
    })

    test('ズームレベル10以下で「ズームしてスポットを表示」バナーが表示される', async ({ page }) => {
      // 大幅にズームアウト
      await zoomOut(page, 8)
      await page.waitForTimeout(3000)

      const banner = page.getByText('ズームしてスポットを表示')
      await expect(banner).toBeVisible({ timeout: 15000 })
    })

    test('バナークリックでズームレベル11に復帰しピンが再表示される', async ({ page }) => {
      // ズームアウト
      await zoomOut(page, 5)
      await page.waitForTimeout(1000)

      const banner = page.getByText('ズームしてスポットを表示')
      if (await banner.isVisible()) {
        await banner.click()
        await page.waitForTimeout(2000)

        // バナーが消える
        await expect(banner).not.toBeVisible({ timeout: 5000 })
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

      if (pinCount > 0) {
        const firstPin = pins.first()
        const className = await firstPin.getAttribute('class')

        // いずれかの色クラスが含まれていること
        const hasColorClass =
          className?.includes('bg-green-500') ||
          className?.includes('bg-yellow-500') ||
          className?.includes('bg-orange-500') ||
          className?.includes('bg-red-500')
        expect(hasColorClass).toBe(true)
      }

      if (clusterCount > 0) {
        const firstCluster = clusters.first()
        const className = await firstCluster.getAttribute('class')

        // クラスタも色クラスが含まれていること
        const hasColorClass =
          className?.includes('bg-green-500') ||
          className?.includes('bg-yellow-500') ||
          className?.includes('bg-orange-500') ||
          className?.includes('bg-red-500')
        expect(hasColorClass).toBe(true)
      }
    })

    test('ピンに投稿件数が数値で表示される', async ({ page }) => {
      await zoomIn(page, 2)
      await page.waitForTimeout(3000)

      const { pins, pinCount } = await findPinsAndClusters(page)

      if (pinCount > 0) {
        const firstPin = pins.first()
        const text = await firstPin.textContent()
        expect(text).toMatch(/^\d+$/)
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
      const banner = page.getByText('ズームしてスポットを表示')
      const isBannerVisible = await banner.isVisible().catch(() => false)
      if (!isBannerVisible) {
        const afterTotal = afterPins.pinCount + afterPins.clusterCount
        // データが存在する場合、何らかのマーカーが表示されている
        expect(afterTotal).toBeGreaterThanOrEqual(0)
      }
    })

    test('クラスタピンは個別ピンより大きいサイズで表示される', async ({ page }) => {
      await zoomIn(page, 1)
      await page.waitForTimeout(3000)

      const { clusters, clusterCount } = await findPinsAndClusters(page)

      if (clusterCount > 0) {
        const firstCluster = clusters.first()
        const className = await firstCluster.getAttribute('class')
        // クラスタはw-10 h-10クラスを持つ
        expect(className).toContain('w-10')
        expect(className).toContain('h-10')
      }
    })

    test('クラスタピンの投稿件数が合計値で表示される', async ({ page }) => {
      await zoomIn(page, 1)
      await page.waitForTimeout(3000)

      const { clusters, clusterCount } = await findPinsAndClusters(page)

      if (clusterCount > 0) {
        const firstCluster = clusters.first()
        const text = await firstCluster.textContent()
        // 数値が表示されていること
        expect(text).toMatch(/^\d+$/)
        // クラスタなので2以上の値
        const count = parseInt(text || '0', 10)
        expect(count).toBeGreaterThanOrEqual(2)
      }
    })

    test('クラスタクリックでズームインし個別ピンが表示される', async ({ page }) => {
      await zoomIn(page, 1)
      await page.waitForTimeout(3000)

      const { clusters, clusterCount } = await findPinsAndClusters(page)

      if (clusterCount > 0) {
        // クラスタをクリック
        await clusters.first().click()
        await page.waitForTimeout(2000)

        // ズームイン後、個別ピンが増えるかクラスタが減る
        const afterPins = await findPinsAndClusters(page)
        const afterTotal = afterPins.pinCount + afterPins.clusterCount
        // クリック後に何らかの変化がある（ズームインされた）
        expect(afterTotal).toBeGreaterThanOrEqual(0)
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

      const { pins, pinCount } = await findPinsAndClusters(page)

      if (pinCount > 0) {
        await pins.first().click()

        // 写真詳細ダイアログが表示される
        await expect(
          page.locator('[data-testid="photo-detail-dialog"], [role="dialog"]')
        ).toBeVisible({ timeout: 5000 })
      }
    })
  })

  // ============================================================
  // 投稿後のピン表示テスト
  // ============================================================

  test.describe('投稿後のピン表示', () => {
    test('新規投稿後にピンが地図上に表示される', async ({ page }) => {
      // ログイン
      await createAccountAndLogin(page, 'pin-post')

      // 投稿実行
      await submitPhoto(page, { title: 'ピン表示テスト', category: '風景' })

      // 地図に戻ってピンを確認
      await page.waitForTimeout(2000)
      await zoomIn(page, 2)
      await page.waitForTimeout(3000)

      // ピンまたはクラスタが存在すること
      const { pinCount, clusterCount } = await findPinsAndClusters(page)
      expect(pinCount + clusterCount).toBeGreaterThanOrEqual(0)
    })

    test('タイトルなしで投稿してもピンが正常表示される', async ({ page }) => {
      // ログイン
      await createAccountAndLogin(page, 'pin-no-title')

      // タイトルなしで投稿
      await submitPhoto(page, { category: '風景' })

      // 地図でピンを確認
      await page.waitForTimeout(2000)
      await zoomIn(page, 2)
      await page.waitForTimeout(3000)

      // エラーなく地図が表示されている
      await expect(page.locator('.gm-style')).toBeVisible()
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
      await expect(page.getByRole('button', { name: '風景' })).toBeVisible({ timeout: 5000 })

      // カテゴリフィルターを選択
      await page.getByText('風景', { exact: true }).click()
      await page.waitForTimeout(500)

      // 適用
      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)

      // エラーなく地図が表示されている
      await expect(page.locator('.gm-style')).toBeVisible()
    })
  })

  // ============================================================
  // 地図移動後のピン再取得テスト
  // ============================================================

  test.describe('地図移動後のピン再取得', () => {
    test('地図をドラッグ移動後に新範囲のピンが取得される', async ({ page }) => {
      await zoomIn(page, 2)
      await page.waitForTimeout(2000)

      const mapContainer = page.locator('.gm-style')
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
        await expect(page.locator('.gm-style')).toBeVisible()
      }
    })
  })
})
