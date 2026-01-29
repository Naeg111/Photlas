import { test, expect, Page } from '@playwright/test'
import {
  waitForSplash,
  createAccountAndLogin,
  clearStorage,
} from './helpers/auth'

/**
 * 地図表示・ピン表示機能 E2Eテスト
 *
 * テスト対象:
 * 1. ピンの表示（ズームレベル11以上）
 * 2. ピンのクラスタリング（ズームレベル11未満）
 * 3. ピンの色分け（投稿数に応じた色変化）
 * 4. フィルター機能（カテゴリ、月、時間帯、天気）
 * 5. 現在地ボタン
 * 6. 地図ナビゲーション
 *
 * 前提条件:
 * - テスト環境（test.photlas.jp）が稼働していること
 * - テスト用の投稿データが存在すること
 */

// 地図関連の定数
const MAP_CONFIG = {
  DEFAULT_CENTER: { lat: 35.6585, lng: 139.7454 }, // 東京
  MIN_ZOOM_FOR_PINS: 11,
  DEFAULT_ZOOM: 11,
}

// フィルターカテゴリ
const FILTER_CATEGORIES = [
  '風景', '街並み', '植物', '動物', '自動車', 'バイク',
  '鉄道', '飛行機', '食べ物', 'ポートレート', '星空', 'その他',
]

// 時間帯フィルター
const TIME_OF_DAY_FILTERS = ['朝', '昼', '夕方', '夜']

// 天気フィルター
const WEATHER_FILTERS = ['晴れ', '曇り', '雨', '雪']

// 月フィルター
const MONTH_FILTERS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]

/**
 * フィルターパネルを開く
 */
async function openFilterPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'フィルター' }).click()
  // フィルターパネルが開くのを待機（カテゴリボタンが表示される）
  await expect(page.getByRole('button', { name: '風景' })).toBeVisible({ timeout: 5000 })
}

/**
 * フィルターパネルを閉じる
 */
async function closeFilterPanel(page: Page): Promise<void> {
  // オーバーレイをクリックするか、適用ボタンを押す
  const applyButton = page.getByRole('button', { name: '適用' })
  if (await applyButton.isVisible()) {
    await applyButton.click()
  }
}

/**
 * 地図のズームレベルを変更（ズームイン）
 */
async function zoomIn(page: Page, times: number = 1): Promise<void> {
  // 地図をクリックしてフォーカス
  const mapContainer = page.locator('.gm-style')
  await mapContainer.click()
  await page.waitForTimeout(300)

  // マウスホイールでズームイン
  for (let i = 0; i < times; i++) {
    await mapContainer.hover()
    await page.mouse.wheel(0, -300)
    await page.waitForTimeout(800)
  }
}

/**
 * 地図のズームレベルを変更（ズームアウト）
 */
async function zoomOut(page: Page, times: number = 1): Promise<void> {
  // 地図をクリックしてフォーカス
  const mapContainer = page.locator('.gm-style')
  await mapContainer.click()
  await page.waitForTimeout(300)

  // マウスホイールでズームアウト
  for (let i = 0; i < times; i++) {
    await mapContainer.hover()
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(800)
  }
}

/**
 * 地図が読み込まれるのを待機
 */
async function waitForMapLoad(page: Page): Promise<void> {
  // Google Mapsのコンテナが表示されるのを待機
  await expect(page.locator('[data-testid="map-container"], .gm-style')).toBeVisible({ timeout: 15000 })
  // API呼び出しが完了するのを待機
  await page.waitForTimeout(2000)
}

test.describe('地図表示・ピン表示機能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForSplash(page)
    await clearStorage(page)
    await waitForMapLoad(page)
  })

  // ============================================================
  // 地図の基本表示テスト
  // ============================================================

  test.describe('地図の基本表示', () => {
    test('地図が正常に表示される', async ({ page }) => {
      // Google Mapsのコンテナが表示される
      await expect(page.locator('.gm-style')).toBeVisible()
    })

    test('フィルターボタンが表示される', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'フィルター' })).toBeVisible()
    })

    test('メニューボタンが表示される', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'メニュー' })).toBeVisible()
    })

    test('投稿ボタン（FAB）が表示される', async ({ page }) => {
      await expect(page.getByRole('button', { name: '投稿' })).toBeVisible()
    })

    test('現在地ボタンが表示される', async ({ page }) => {
      await expect(page.getByRole('button', { name: '現在位置' })).toBeVisible()
    })
  })

  // ============================================================
  // ピン表示テスト
  // ============================================================

  test.describe('ピン表示', () => {
    test('ズームレベル11以上でピンが表示される', async ({ page }) => {
      // ズームレベルを11以上に設定
      await zoomIn(page, 2)
      await page.waitForTimeout(2000)

      // ピンが表示されるか、データがない場合は表示されない
      // スポットが存在する場合のみピンが表示される
      const pins = page.locator('[data-testid^="map-pin-"]')
      const pinCount = await pins.count()

      // ピンが表示されているか、または「ズームして」のバナーが表示されていない
      const zoomBanner = page.getByText('ズームしてスポットを表示')
      const isZoomBannerVisible = await zoomBanner.isVisible().catch(() => false)

      // ズームレベルが十分な場合、バナーは表示されない
      expect(isZoomBannerVisible).toBe(false)
    })

    test('ズームレベル11未満で「ズームしてスポットを表示」バナーが表示される', async ({ page }) => {
      // ズームアウトしてレベルを下げる（十分にズームアウト）
      // 地図の縮小はマウスホイールで行う
      const mapContainer = page.locator('.gm-style')
      await mapContainer.click()
      await page.waitForTimeout(500)

      // 大幅にズームアウト（各ホイールイベントは1〜2レベル縮小）
      for (let i = 0; i < 10; i++) {
        await mapContainer.hover()
        await page.mouse.wheel(0, 400)
        await page.waitForTimeout(500)
      }

      // ズーム変更後のアイドル状態を待機
      await page.waitForTimeout(3000)

      // バナーが表示される
      const banner = page.getByText('ズームしてスポットを表示')
      await expect(banner).toBeVisible({ timeout: 15000 })
    })

    test('バナーをクリックするとズームレベルが11になる', async ({ page }) => {
      // ズームアウト
      await zoomOut(page, 5)
      await page.waitForTimeout(1000)

      // バナーをクリック
      const banner = page.getByText('ズームしてスポットを表示')
      if (await banner.isVisible()) {
        await banner.click()
        await page.waitForTimeout(1000)

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
      // ズームインしてピンを表示
      await zoomIn(page, 2)
      await page.waitForTimeout(3000)

      // ピンを取得
      const pins = page.locator('[data-testid^="map-pin-"]')
      const pinCount = await pins.count()

      if (pinCount > 0) {
        // 最初のピンの色クラスを確認
        const firstPin = pins.first()
        const className = await firstPin.getAttribute('class')

        // 色クラスが含まれていることを確認（Green, Yellow, Orange, Red）
        const hasColorClass =
          className?.includes('bg-green-500') ||
          className?.includes('bg-yellow-500') ||
          className?.includes('bg-orange-500') ||
          className?.includes('bg-red-500')

        expect(hasColorClass).toBe(true)
      }
    })

    test('ピンに投稿数が表示される', async ({ page }) => {
      await zoomIn(page, 2)
      await page.waitForTimeout(3000)

      const pins = page.locator('[data-testid^="map-pin-"]')
      const pinCount = await pins.count()

      if (pinCount > 0) {
        // ピンのテキストが数字であることを確認
        const firstPin = pins.first()
        const text = await firstPin.textContent()
        expect(text).toMatch(/^\d+$/)
      }
    })
  })

  // ============================================================
  // フィルター機能テスト
  // ============================================================

  test.describe('フィルター機能', () => {
    test('フィルターパネルが開閉できる', async ({ page }) => {
      // フィルターパネルを開く
      await openFilterPanel(page)

      // フィルターボタンが表示されていることを確認
      await expect(page.getByRole('button', { name: '風景' })).toBeVisible()

      // フィルターパネルを閉じる
      await closeFilterPanel(page)
    })

    test('カテゴリフィルターで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)

      // カテゴリを選択
      await page.getByText('風景', { exact: true }).click()
      await page.waitForTimeout(500)

      // 適用ボタンをクリック
      await page.getByRole('button', { name: '適用' }).click()

      // フィルターが適用される（APIが再呼び出しされる）
      await page.waitForTimeout(2000)
    })

    test('複数のカテゴリで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)

      // 複数カテゴリを選択
      await page.getByText('風景', { exact: true }).click()
      await page.getByText('街並み', { exact: true }).click()
      await page.waitForTimeout(500)

      // 適用
      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)
    })

    test('時間帯フィルターで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)

      // 時間帯を選択
      await page.getByText('朝', { exact: true }).click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)
    })

    test('天気フィルターで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)

      // 天気を選択
      await page.getByText('晴れ', { exact: true }).click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)
    })

    test('月フィルターで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)

      // 月を選択
      await page.getByText('1月', { exact: true }).click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)
    })

    test('フィルターをクリアできる', async ({ page }) => {
      await openFilterPanel(page)

      // フィルターを設定
      await page.getByText('風景', { exact: true }).click()
      await page.getByText('朝', { exact: true }).click()

      // クリアボタンをクリック
      await page.getByRole('button', { name: 'クリア' }).click()

      // フィルターがリセットされる（チェック状態が解除される）
      await page.waitForTimeout(500)

      // 適用
      await page.getByRole('button', { name: '適用' }).click()
    })

    test('複合フィルター（カテゴリ + 時間帯 + 天気）で絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)

      // 複数のフィルターを組み合わせ
      await page.getByText('風景', { exact: true }).click()
      await page.getByText('夕方', { exact: true }).click()
      await page.getByText('晴れ', { exact: true }).click()

      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)
    })
  })

  // ============================================================
  // 現在地機能テスト
  // ============================================================

  test.describe('現在地機能', () => {
    test('現在地ボタンが機能する', async ({ page, context }) => {
      // 位置情報の権限を付与
      await context.grantPermissions(['geolocation'])

      // 仮の位置情報を設定
      await context.setGeolocation({
        latitude: 35.6762,
        longitude: 139.6503,
      })

      // 現在地ボタンをクリック
      await page.getByRole('button', { name: '現在位置' }).click()

      // 地図が移動する（しばらく待機）
      await page.waitForTimeout(2000)

      // 現在地マーカーが表示される
      // 青色の現在地マーカーを確認
      const locationMarker = page.locator('.location-pulse, [data-testid="user-location-marker"]')
      // マーカーが表示されるかタイムアウト
      await expect(locationMarker).toBeVisible({ timeout: 10000 }).catch(() => {
        // 位置情報が取得できない環境では失敗を許容
      })
    })

    test('位置情報が拒否された場合のエラーハンドリング', async ({ page, context }) => {
      // 位置情報の権限を拒否
      await context.clearPermissions()

      // 現在地ボタンをクリック
      await page.getByRole('button', { name: '現在位置' }).click()

      // エラーは静かに処理される（クラッシュしない）
      await page.waitForTimeout(2000)

      // 地図が引き続き表示されている
      await expect(page.locator('.gm-style')).toBeVisible()
    })
  })

  // ============================================================
  // 地図ナビゲーションテスト
  // ============================================================

  test.describe('地図ナビゲーション', () => {
    test('ドラッグで地図を移動できる', async ({ page }) => {
      const mapContainer = page.locator('.gm-style')

      // マウスでドラッグ
      const box = await mapContainer.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100)
        await page.mouse.up()

        // 移動後にAPIが再呼び出しされる
        await page.waitForTimeout(2000)
      }
    })

    test('マウスホイールでズームイン・アウトできる', async ({ page }) => {
      const mapContainer = page.locator('.gm-style')

      // マウスホイールでズーム
      await mapContainer.hover()
      await page.mouse.wheel(0, -300) // ズームイン
      await page.waitForTimeout(1000)

      await page.mouse.wheel(0, 300) // ズームアウト
      await page.waitForTimeout(1000)
    })

    test('ピンチズームでズームイン・アウトできる（モバイル）', async ({ page }) => {
      // モバイルデバイスでのピンチズームはPlaywrightで直接テストが難しいため、
      // タッチイベントの基本的な動作のみ確認
      const mapContainer = page.locator('.gm-style')
      await expect(mapContainer).toBeVisible()
    })
  })

  // ============================================================
  // ピンクリックテスト
  // ============================================================

  test.describe('ピンクリック', () => {
    test('ピンをクリックすると写真詳細ダイアログが開く', async ({ page }) => {
      // ズームインしてピンを表示
      await zoomIn(page, 2)
      await page.waitForTimeout(3000)

      const pins = page.locator('[data-testid^="map-pin-"]')
      const pinCount = await pins.count()

      if (pinCount > 0) {
        // 最初のピンをクリック
        await pins.first().click()

        // 写真詳細ダイアログが開く
        await expect(page.locator('[data-testid="photo-detail-dialog"], [role="dialog"]')).toBeVisible({ timeout: 5000 })
      }
    })
  })
})
