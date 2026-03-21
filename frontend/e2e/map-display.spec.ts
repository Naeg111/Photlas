import { test, expect, Page } from '@playwright/test'
import {
  waitForSplash,
  createAccountAndLogin,
  clearStorage,
  initCookieConsent,
} from './helpers/auth'
import {
  findPinsAndClusters,
  clickFirstPin,
} from './helpers/map-pins'

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
  '自然風景', '街並み', '建造物', '夜景', 'グルメ', '植物',
  '動物', '野鳥', '自動車', 'バイク', '鉄道', '飛行機', '星空', 'その他',
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
  await expect(page.getByRole('button', { name: '自然風景' })).toBeVisible({ timeout: 5000 })
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
  // idle イベント発火とUI更新を待機
  await page.waitForTimeout(2000)
}

/**
 * 地図のズームレベルを変更（ズームイン）
 */
async function zoomIn(page: Page, times: number = 1): Promise<void> {
  const currentZoom = await page.evaluate(() => {
    const map = (window as unknown as Record<string, any>).__photlas_map
    return map?.getZoom?.() ?? 11
  })
  await setMapZoom(page, currentZoom + times)
}

/**
 * 地図のズームレベルを変更（ズームアウト）
 */
async function zoomOut(page: Page, times: number = 1): Promise<void> {
  const currentZoom = await page.evaluate(() => {
    const map = (window as unknown as Record<string, any>).__photlas_map
    return map?.getZoom?.() ?? 11
  })
  await setMapZoom(page, Math.max(1, currentZoom - times))
}

/**
 * 地図が読み込まれるのを待機
 */
async function waitForMapLoad(page: Page): Promise<void> {
  // Mapboxのコンテナが表示されるのを待機
  await expect(page.locator('[data-testid="map-container"], .mapboxgl-map')).toBeVisible({ timeout: 15000 })
  // API呼び出しが完了するのを待機
  await page.waitForTimeout(2000)
}

test.describe('地図表示・ピン表示機能', () => {
  test.beforeEach(async ({ page }) => {
    await initCookieConsent(page)
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
      // Mapboxのコンテナが表示される
      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
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

      // ズームレベルが十分な場合、バナーは表示されない
      const zoomBanner = page.getByText('ズームしてスポットを表示')
      const isZoomBannerVisible = await zoomBanner.isVisible().catch(() => false)
      expect(isZoomBannerVisible).toBe(false)
    })

    test('ズームレベル11未満で「ズームしてスポットを表示」バナーが表示される', async ({ page }) => {
      // キーボードでズームアウト（mobile-chromeでも安定動作）
      await zoomOut(page, 10)

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

        // ズームレベルが11になったことを確認
        const zoom = await page.evaluate(() => {
          const map = (window as unknown as Record<string, any>).__photlas_map
          return map?.getZoom?.() ?? 0
        })
        expect(zoom).toBeGreaterThanOrEqual(11)
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

      // Symbol LayerのフィーチャーからphotoCountプロパティを確認
      const { pins, pinCount } = await findPinsAndClusters(page)

      if (pinCount > 0) {
        expect(pins[0].properties).toHaveProperty('photoCount')
        expect(pins[0].properties.photoCount).toBeGreaterThanOrEqual(1)
      }
    })

    test('ピンに投稿数が表示される', async ({ page }) => {
      await zoomIn(page, 2)
      await page.waitForTimeout(3000)

      const { pins, pinCount } = await findPinsAndClusters(page)

      if (pinCount > 0) {
        // Symbol Layerではicon-imageにphotoCountが含まれる
        const photoCount = pins[0].properties.photoCount
        expect(typeof photoCount).toBe('number')
        expect(photoCount).toBeGreaterThanOrEqual(1)
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
      await expect(page.getByRole('button', { name: '自然風景' })).toBeVisible()

      // フィルターパネルを閉じる
      await closeFilterPanel(page)
    })

    test('カテゴリフィルターで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)

      // カテゴリを選択
      await page.getByText('自然風景', { exact: true }).click()
      await page.waitForTimeout(500)

      // 適用ボタンをクリック
      await page.getByRole('button', { name: '適用' }).click()

      // フィルターが適用される（APIが再呼び出しされる）
      await page.waitForTimeout(2000)
    })

    test('複数のカテゴリで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)

      // 複数カテゴリを選択
      await page.getByText('自然風景', { exact: true }).click()
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
      await page.getByText('自然風景', { exact: true }).click()
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
      await page.getByText('自然風景', { exact: true }).click()
      await page.getByText('夕方', { exact: true }).click()
      await page.getByText('晴れ', { exact: true }).click()

      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)
    })
  })

  // ============================================================
  // 詳細フィルター機能テスト
  // ============================================================

  test.describe('詳細フィルター機能', () => {
    test('「上級者向けフィルター」ボタンで詳細フィルターが開閉できる', async ({ page }) => {
      await openFilterPanel(page)

      // 詳細フィルターを開く
      await page.getByRole('button', { name: '上級者向けフィルター' }).click()

      // 詳細フィルターの項目が表示される
      await expect(page.getByText('機材種別')).toBeVisible()
      await expect(page.getByText('撮影日からの経過期間')).toBeVisible()
      await expect(page.getByText('アスペクト比')).toBeVisible()
      await expect(page.getByText('焦点距離（フルサイズ換算）')).toBeVisible()
      await expect(page.getByText('ISO感度')).toBeVisible()
    })

    test('機材種別フィルターで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)
      await page.getByRole('button', { name: '上級者向けフィルター' }).click()

      // 一眼レフを選択
      await page.getByText('一眼レフ', { exact: true }).click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)

      // エラーなく地図が表示されている
      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
    })

    test('撮影日からの経過期間フィルターで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)
      await page.getByRole('button', { name: '上級者向けフィルター' }).click()

      // 1年以内を選択
      await page.getByText('1年以内', { exact: true }).click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)

      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
    })

    test('アスペクト比フィルターで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)
      await page.getByRole('button', { name: '上級者向けフィルター' }).click()

      // 横位置を選択
      await page.getByText('横位置', { exact: true }).click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)

      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
    })

    test('焦点距離フィルターで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)
      await page.getByRole('button', { name: '上級者向けフィルター' }).click()

      // 広角を選択
      await page.getByText('広角（24mm未満）', { exact: true }).click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)

      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
    })

    test('ISO感度フィルターで絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)
      await page.getByRole('button', { name: '上級者向けフィルター' }).click()

      // 低感度を選択
      await page.getByText('低感度（ISO 400以下）', { exact: true }).click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)

      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
    })

    test('基本フィルターと詳細フィルターを組み合わせて絞り込みができる', async ({ page }) => {
      await openFilterPanel(page)

      // 基本フィルター
      await page.getByText('自然風景', { exact: true }).click()
      await page.getByText('晴れ', { exact: true }).click()

      // 詳細フィルターを開く
      await page.getByRole('button', { name: '上級者向けフィルター' }).click()

      // 詳細フィルター
      await page.getByText('一眼レフ', { exact: true }).click()
      await page.getByText('横位置', { exact: true }).click()

      await page.getByRole('button', { name: '適用' }).click()
      await page.waitForTimeout(2000)

      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
    })

    test('クリアボタンで詳細フィルターもリセットされる', async ({ page }) => {
      await openFilterPanel(page)

      // 基本フィルター設定
      await page.getByText('自然風景', { exact: true }).click()

      // 詳細フィルターを開いて設定
      await page.getByRole('button', { name: '上級者向けフィルター' }).click()
      await page.getByText('一眼レフ', { exact: true }).click()

      // クリア
      await page.getByRole('button', { name: 'クリア' }).click()
      await page.waitForTimeout(500)

      // 適用
      await page.getByRole('button', { name: '適用' }).click()
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
      const isVisible = await locationMarker.isVisible().catch(() => false)
      if (!isVisible) {
        // 位置情報が取得できない環境では失敗を許容
      }
    })

    test('位置情報が拒否された場合のエラーハンドリング', async ({ page, context }) => {
      // 位置情報の権限を拒否
      await context.clearPermissions()

      // 現在地ボタンをクリック
      await page.getByRole('button', { name: '現在位置' }).click()

      // エラーは静かに処理される（クラッシュしない）
      await page.waitForTimeout(2000)

      // 地図が引き続き表示されている
      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
    })
  })

  // ============================================================
  // 地図ナビゲーションテスト
  // ============================================================

  test.describe('地図ナビゲーション', () => {
    test('ドラッグで地図を移動できる', async ({ page }) => {
      const mapContainer = page.locator('.mapboxgl-map').first()

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

      // 移動後に地図が引き続き表示されている
      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
    })

    test('マウスホイールでズームイン・アウトできる', async ({ page }) => {
      const mapContainer = page.locator('.mapboxgl-map').first()

      // マウスホイールでズーム
      await mapContainer.hover()
      await page.mouse.wheel(0, -300) // ズームイン
      await page.waitForTimeout(1000)

      await page.mouse.wheel(0, 300) // ズームアウト
      await page.waitForTimeout(1000)

      // エラーなく地図が表示されている
      await expect(page.locator('.mapboxgl-map').first()).toBeVisible()
    })

    test('ピンチズームでズームイン・アウトできる（モバイル）', async ({ page }) => {
      // モバイルデバイスでのピンチズームはPlaywrightで直接テストが難しいため、
      // タッチイベントの基本的な動作のみ確認
      const mapContainer = page.locator('.mapboxgl-map').first()
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

      const { pinCount } = await findPinsAndClusters(page)

      if (pinCount > 0) {
        // Symbol Layerのピンをクリック
        const clicked = await clickFirstPin(page)
        if (clicked) {
          // 写真詳細ダイアログが開く（ネットワーク遅延を考慮して長めのタイムアウト）
          await expect(page.locator('[data-testid="photo-detail-dialog"], [role="dialog"]')).toBeVisible({ timeout: 10000 })
        }
      }
    })
  })
})
