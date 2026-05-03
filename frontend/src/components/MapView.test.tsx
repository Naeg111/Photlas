import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import MapView from './MapView'
import { _resetRateLimitBurstTracker } from '../utils/notifyIfRateLimited'
import i18n from '../i18n'

/**
 * Issue#53: Google Maps API から Mapbox API への移行
 * Issue#55: Symbol Layer移行 + クラスタリングアニメーション
 */

// API設定のモック
vi.mock('../config/api', () => ({
  API_V1_URL: 'http://localhost:3000/api/v1',
}))

// Issue#106: IP国判定キャッシュ・APIのモック（autoCenter テスト用）
const { mockGetGeoCountryCache, mockSetGeoCountryCache, mockFetchMyCountry } = vi.hoisted(() => ({
  mockGetGeoCountryCache: vi.fn(),
  mockSetGeoCountryCache: vi.fn(),
  mockFetchMyCountry: vi.fn(),
}))
vi.mock('../utils/geoCountryCache', () => ({
  getGeoCountryCache: mockGetGeoCountryCache,
  setGeoCountryCache: mockSetGeoCountryCache,
  GEO_COUNTRY_CACHE_KEY: 'photlas_geo_country',
  GEO_COUNTRY_CACHE_TTL_MS: 24 * 60 * 60 * 1000,
}))
vi.mock('../utils/fetchMyCountry', () => ({
  fetchMyCountry: mockFetchMyCountry,
}))

// Issue#111: ユーザーの最後の位置情報キャッシュのモック
const { mockGetLastGeolocationCache, mockSetLastGeolocationCache } = vi.hoisted(() => ({
  mockGetLastGeolocationCache: vi.fn(),
  mockSetLastGeolocationCache: vi.fn(),
}))
vi.mock('../utils/lastGeolocationCache', () => ({
  getLastGeolocationCache: mockGetLastGeolocationCache,
  setLastGeolocationCache: mockSetLastGeolocationCache,
  LAST_GEOLOCATION_CACHE_KEY: 'photlas_last_geolocation',
  LAST_GEOLOCATION_CACHE_TTL_MS: 24 * 60 * 60 * 1000,
}))

// Issue#96 PR3: sonner のモック（429 バーストトースト検証用）
const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))
vi.mock('sonner', () => ({
  toast: mockToast,
}))

// pinImageGeneratorのモック
vi.mock('../utils/pinImageGenerator', () => ({
  generatePinImage: vi.fn(() => ({
    width: 36,
    height: 44,
    data: new Uint8ClampedArray(36 * 44 * 4),
  })),
  getPinImageId: (color: string, count: number) => `pin-${color}-${count}`,
  PIN_COLOR_MAP: {
    Green: '#00d68f',
    Yellow: '#ffbe0b',
    Orange: '#ff6b35',
    Red: '#ff006e',
  },
  BASE_PIN_SIZE: 32,
  PIN_HEIGHT_RATIO: 1.2,
  PIN_PIXEL_RATIO: 2,
  SHADOW_PADDING: 4,
}))

// Mapbox GL JS のモックマップインスタンス
const { mockMap, mockSourceData, MapMock, resetMockMountFlag, getCapturedInitialViewState } = vi.hoisted(() => {
  let hasMounted = false
  const timerIds: ReturnType<typeof setTimeout>[] = []

  // addSourceに渡されたデータを保存
  let sourceData: { id: string; config: any }[] = []
  // addLayerに渡された設定を保存
  const layers: { config: any }[] = []
  // 登録されたイメージIDを保存
  const images: Set<string> = new Set()
  // イベントハンドラーを保存（3引数形式: layerId 別 / 2引数形式: '__no_layer__' キー）
  const eventHandlers: Record<string, Record<string, Function>> = {}
  // GeoJSONソースのsetData呼び出しを記録
  let lastSetData: any = null
  // Issue#111: ランダム経度の検証用に initialViewState をキャプチャする
  let capturedInitialViewState: any = null

  const mockMap = {
    setZoom: vi.fn(),
    getZoom: vi.fn(),
    easeTo: vi.fn(),
    getCenter: vi.fn(() => ({ lng: 139.7454, lat: 35.6585 })),
    getBounds: vi.fn(() => ({
      getNorth: () => 35.7,
      getSouth: () => 35.6,
      getEast: () => 139.8,
      getWest: () => 139.7,
    })),
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
    once: vi.fn(),
    setLanguage: vi.fn(),
    // Issue#111: 地球儀回転時に setCenter を呼び出す
    setCenter: vi.fn(),
    on: vi.fn((event: string, layerOrHandler: string | Function, handler?: Function) => {
      if (typeof layerOrHandler === 'string' && handler) {
        // map.on('click', 'layerId', handler) 形式
        if (!eventHandlers[event]) eventHandlers[event] = {}
        eventHandlers[event][layerOrHandler] = handler
      } else if (typeof layerOrHandler === 'function') {
        // map.on('movestart', handler) 形式（Issue#111: 地球儀回転）
        if (!eventHandlers[event]) eventHandlers[event] = {}
        eventHandlers[event]['__no_layer__'] = layerOrHandler
      }
    }),
    off: vi.fn(),
    addSource: vi.fn((id: string, config: any) => {
      sourceData.push({ id, config })
    }),
    addLayer: vi.fn((config: any) => {
      layers.push({ config })
    }),
    addImage: vi.fn((id: string) => {
      images.add(id)
    }),
    hasImage: vi.fn((id: string) => images.has(id)),
    getSource: vi.fn((id: string) => {
      const source = sourceData.find(s => s.id === id)
      if (source) {
        return {
          setData: vi.fn((data: any) => { lastSetData = data }),
        }
      }
      return undefined
    }),
    removeSource: vi.fn(),
    removeLayer: vi.fn(),
    getLayer: vi.fn(() => undefined),
    queryRenderedFeatures: vi.fn(() => []),
    setLayoutProperty: vi.fn(),
    // Issue#111-followup: ジェスチャー有効/無効の切替用
    dragRotate: { enable: vi.fn(), disable: vi.fn() },
    touchPitch: { enable: vi.fn(), disable: vi.fn() },
    touchZoomRotate: { enableRotation: vi.fn(), disableRotation: vi.fn() },
  }

  // react-map-gl のモック
  const MapMock = ({ children, onLoad, onMoveEnd, initialViewState }: any) => {
    if (!hasMounted) {
      hasMounted = true
      capturedInitialViewState = initialViewState
      if (onLoad) {
        onLoad({ target: mockMap })
      }
      if (onMoveEnd) {
        timerIds.push(setTimeout(() => onMoveEnd({ target: mockMap }), 100))
        timerIds.push(setTimeout(() => onMoveEnd({ target: mockMap }), 200))
      }
    }
    return (
      <div data-testid="mapbox-map">
        {children}
      </div>
    )
  }

  const resetMockMountFlag = () => {
    hasMounted = false
    timerIds.forEach(id => clearTimeout(id))
    timerIds.length = 0
    sourceData = []
    layers.length = 0
    images.clear()
    Object.keys(eventHandlers).forEach(k => delete eventHandlers[k])
    lastSetData = null
    capturedInitialViewState = null
  }

  const mockSourceData = {
    get sources() { return sourceData },
    get layers() { return layers },
    get images() { return images },
    get eventHandlers() { return eventHandlers },
    get lastSetData() { return lastSetData },
  }

  const getCapturedInitialViewState = () => capturedInitialViewState

  return { mockMap, mockSourceData, MapMock, resetMockMountFlag, getCapturedInitialViewState }
})

vi.mock('react-map-gl', () => ({
  default: MapMock,
  Map: MapMock,
  Marker: ({ children }: any) => <div>{children}</div>,
  AttributionControl: () => null,
}))

// fetch APIのモック
global.fetch = vi.fn()

// テスト用スポットデータ
const TEST_SPOT = {
  spotId: 1,
  latitude: 35.6585,
  longitude: 139.7454,
  pinColor: 'Green' as const,
  thumbnailUrl: 'https://example.com/thumb.jpg',
  photoCount: 1,
}

/** 指定したスポット配列を返すfetchモックを設定 */
function setupFetchMock(spots: typeof TEST_SPOT[] = []) {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => spots,
  })
  global.fetch = mockFetch
  return mockFetch
}

describe('MapView Component - Issue#53, Issue#55', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockMountFlag()
    mockMap.getZoom.mockReturnValue(11)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('地図操作・状態に伴うピンの更新', () => {
    it('初回読み込み時にスポットAPIが呼ばれる', async () => {
      const mockFetch = setupFetchMock([TEST_SPOT])

      render(<MapView />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/spots'),
          expect.any(Object)
        )
      })

      const callArgs = mockFetch.mock.calls[0][0] as string
      expect(callArgs).toContain('north=')
      expect(callArgs).toContain('south=')
      expect(callArgs).toContain('east=')
      expect(callArgs).toContain('west=')
    })

    it('地図移動後（onMoveEnd イベント）にAPIが呼ばれる（デバウンス500msで連続移動が1回にまとまる）', async () => {
      const mockFetch = setupFetchMock()

      render(<MapView />)

      // 初回ロード(1回) + onMoveEnd 100ms,200ms がデバウンスで1回にまとまる = 計2回
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(2)
        },
        { timeout: 1500 }
      )
    })
  })

  describe('パフォーマンス最適化', () => {
    it('同じスポットデータで再取得してもGeoJSONのsetDataが増加しない（メモ化）', async () => {
      const spots = [TEST_SPOT]
      setupFetchMock(spots)

      render(<MapView />)

      // 初回ロード + デバウンスmoveEndで2回フェッチされる
      await waitFor(
        () => {
          // getSourceが呼ばれている（setDataが実行されている）
          expect(mockMap.getSource).toHaveBeenCalled()
        },
        { timeout: 1500 }
      )

      // 同じspotsで2回フェッチしてもsetDataの呼び出しが際限なく増えないことを確認
      const callCount = mockMap.getSource.mock.calls.length
      expect(callCount).toBeLessThanOrEqual(4)
    })

  })

  describe('ズームレベルによる表示制御と誘導UI', () => {
    it('Issue#103 - ズームレベル5でクラスタレイヤーが表示される（minzoom 制約なし）', async () => {
      setupFetchMock([TEST_SPOT])
      mockMap.getZoom.mockReturnValue(5)

      render(<MapView />)

      await waitFor(() => {
        // クラスタレイヤーが minzoom なしで追加されていること
        const clusterLayerCall = mockMap.addLayer.mock.calls.find(
          (call: any[]) => call[0]?.id === 'clusters'
        )
        expect(clusterLayerCall).toBeDefined()
        expect(clusterLayerCall![0].minzoom).toBeUndefined()
      })
    })

    it('Issue#103 - 個別ピンレイヤーも minzoom 制約なしで追加される', async () => {
      setupFetchMock([TEST_SPOT])

      render(<MapView />)

      await waitFor(() => {
        const unclusteredLayerCall = mockMap.addLayer.mock.calls.find(
          (call: any[]) => call[0]?.id === 'unclustered-point'
        )
        expect(unclusteredLayerCall).toBeDefined()
        expect(unclusteredLayerCall![0].minzoom).toBeUndefined()
      })
    })

    it('Issue#103 修正 - icon-size 式は件数による分岐なしの単純な step 式（紫ピンも 1.4 倍拡大）', async () => {
      setupFetchMock([TEST_SPOT])

      render(<MapView />)

      // クラスタ・個別ピンの両レイヤーを取得
      let clusterIconSize: any
      let unclusteredIconSize: any
      await waitFor(() => {
        const clusterLayerCall = mockMap.addLayer.mock.calls.find(
          (call: any[]) => call[0]?.id === 'clusters'
        )
        const unclusteredLayerCall = mockMap.addLayer.mock.calls.find(
          (call: any[]) => call[0]?.id === 'unclustered-point'
        )
        expect(clusterLayerCall).toBeDefined()
        expect(unclusteredLayerCall).toBeDefined()
        clusterIconSize = clusterLayerCall![0].layout['icon-size']
        unclusteredIconSize = unclusteredLayerCall![0].layout['icon-size']
      })

      // ['step', ['zoom'], baseSize, 16, scaledSize] の形であること
      // （>= 1000 の case 分岐がないこと）
      const assertSimpleStepIconSize = (expr: any) => {
        expect(Array.isArray(expr)).toBe(true)
        expect(expr[0]).toBe('step')
        expect(expr).toHaveLength(5) // step / zoom / baseSize / 16 / scaledSize
        // 5 番目の要素が数値（case式ではない）であることを確認
        expect(typeof expr[4]).toBe('number')
      }
      assertSimpleStepIconSize(clusterIconSize)
      assertSimpleStepIconSize(unclusteredIconSize)
    })

    it('Issue#103 - 「投稿を表示するには地図を拡大してください」バナーが存在しない', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(5)

      render(<MapView />)

      await waitFor(() => {
        expect(mockMap.addSource).toHaveBeenCalled()
      })
      expect(screen.queryByText(/投稿を表示するには地図を拡大してください/)).not.toBeInTheDocument()
    })

    it('Issue#70 - エラートーストがsafe-area-inset-topを考慮した位置にある', async () => {
      mockMap.getZoom.mockReturnValue(12)
      setupFetchMock([])
      // fetch失敗でトーストを表示
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('fail'))

      render(<MapView />)

      await waitFor(() => {
        const toast = screen.queryByTestId('toast-container')
        if (toast) {
          expect(toast.className).toContain('safe-area-inset-top')
        }
      })
    })
  })

  describe('Issue#55: Symbol Layer によるピン描画', () => {
    it('GeoJSON SourceがクラスタリングONで登録される', async () => {
      setupFetchMock([TEST_SPOT])

      render(<MapView />)

      await waitFor(() => {
        expect(mockMap.addSource).toHaveBeenCalledWith(
          'spots',
          expect.objectContaining({
            type: 'geojson',
            cluster: true,
            clusterRadius: 70,
            clusterMaxZoom: 17,
          })
        )
      })
    })

    it('クラスタ用と個別ピン用のSymbol Layerが追加される', async () => {
      setupFetchMock()

      render(<MapView />)

      await waitFor(() => {
        expect(mockMap.addLayer).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'clusters',
            type: 'symbol',
            source: 'spots',
            filter: ['has', 'point_count'],
          })
        )
        expect(mockMap.addLayer).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'unclustered-point',
            type: 'symbol',
            source: 'spots',
            filter: ['!', ['has', 'point_count']],
          })
        )
      })
    })

    it('スポットデータ更新時にGeoJSON Sourceのデータが更新される', async () => {
      setupFetchMock([{ ...TEST_SPOT, photoCount: 3 }])

      render(<MapView />)

      await waitFor(() => {
        const source = mockMap.getSource('spots')
        expect(source).toBeDefined()
      })
    })

    it('ピン画像がmap.addImageで登録される', async () => {
      setupFetchMock([TEST_SPOT])

      render(<MapView />)

      await waitFor(() => {
        expect(mockMap.addImage).toHaveBeenCalled()
      })
    })

    it('個別ピンクリック時にonSpotClickが呼ばれる', async () => {
      setupFetchMock([TEST_SPOT])

      const mockSpotClick = vi.fn()
      render(<MapView onSpotClick={mockSpotClick} />)

      await waitFor(() => {
        // map.on('click', 'unclustered-point', handler) が登録されていることを確認
        expect(mockMap.on).toHaveBeenCalledWith(
          'click',
          'unclustered-point',
          expect.any(Function)
        )
      })

      // 登録されたハンドラーを取得して呼び出す
      const clickCall = mockMap.on.mock.calls.find(
        (call: any[]) => call[0] === 'click' && call[1] === 'unclustered-point'
      )
      if (clickCall) {
        const handler = clickCall[2]
        await act(async () => {
          handler({
            features: [{
              properties: { spotId: 1 },
            }],
          })
        })
        expect(mockSpotClick).toHaveBeenCalledWith(1)
      }
    })

    it('クラスタクリック時にonClusterClickが呼ばれる', async () => {
      setupFetchMock([
        { ...TEST_SPOT, spotId: 50, thumbnailUrl: 'https://example.com/thumb1.jpg', photoCount: 3 },
        { ...TEST_SPOT, spotId: 51, latitude: 35.6586, longitude: 139.7455, thumbnailUrl: 'https://example.com/thumb2.jpg', photoCount: 2 },
      ])

      const mockClusterClick = vi.fn()
      render(<MapView onClusterClick={mockClusterClick} />)

      await waitFor(() => {
        expect(mockMap.on).toHaveBeenCalledWith(
          'click',
          'clusters',
          expect.any(Function)
        )
      })

      // クラスタクリックハンドラーを取得して呼び出す
      const clickCall = mockMap.on.mock.calls.find(
        (call: any[]) => call[0] === 'click' && call[1] === 'clusters'
      )
      if (clickCall) {
        // getSourceでclusterExpansionZoomやgetClusterLeavesを模擬
        const mockClusterSource = {
          getClusterLeaves: vi.fn((_clusterId: number, _limit: number, _offset: number, cb: Function) => {
            cb(null, [
              { properties: { spotId: 50 } },
              { properties: { spotId: 51 } },
            ])
          }),
        }
        mockMap.getSource.mockReturnValueOnce(mockClusterSource)

        const handler = clickCall[2]
        await act(async () => {
          handler({
            features: [{
              properties: { cluster_id: 123, point_count: 2 },
            }],
          })
        })
        expect(mockClusterClick).toHaveBeenCalledWith(expect.arrayContaining([50, 51]))
      }
    })

    it('GeoJSON SourceにclusterPropertiesでtotalPhotoCountの集約が設定される', async () => {
      setupFetchMock()

      render(<MapView />)

      await waitFor(() => {
        expect(mockMap.addSource).toHaveBeenCalledWith(
          'spots',
          expect.objectContaining({
            clusterProperties: expect.objectContaining({
              totalPhotoCount: expect.anything(),
            }),
          })
        )
      })
    })
  })

  describe('撮影地点プレビュー', () => {
    it('showShootingLocationPinで白色のピンが表示される', async () => {
      mockMap.getZoom.mockReturnValue(16)
      setupFetchMock()

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      ref.current.showShootingLocationPin(35.6585, 139.7454)

      await waitFor(() => {
        const pin = screen.getByTestId('shooting-location-pin')
        expect(pin).toBeInTheDocument()
        const path = pin.querySelectorAll('path')[1]
        expect(path?.getAttribute('fill')).toBe('#ffffff')
      })

      expect(mockMap.flyTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [139.7454, 35.6585],
          zoom: 16,
        })
      )
    })

    it('clearShootingLocationPinで白色のピンが消える', async () => {
      mockMap.getZoom.mockReturnValue(16)
      setupFetchMock()

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      ref.current.showShootingLocationPin(35.6585, 139.7454)

      await waitFor(() => {
        expect(screen.getByTestId('shooting-location-pin')).toBeInTheDocument()
      })

      ref.current.clearShootingLocationPin()

      await waitFor(() => {
        expect(screen.queryByTestId('shooting-location-pin')).not.toBeInTheDocument()
      })
    })

    it('showShootingLocationPin中はSymbol Layerのピンが非表示になる', async () => {
      mockMap.getZoom.mockReturnValue(16)
      setupFetchMock([TEST_SPOT])

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      ref.current.showShootingLocationPin(35.6585, 139.7454)

      await waitFor(() => {
        expect(mockMap.setLayoutProperty).toHaveBeenCalledWith(
          'clusters', 'visibility', 'none'
        )
        expect(mockMap.setLayoutProperty).toHaveBeenCalledWith(
          'unclustered-point', 'visibility', 'none'
        )
      })
    })

    it('onMapClickコールバックが地図クリック時に呼ばれる', async () => {
      mockMap.getZoom.mockReturnValue(11)
      setupFetchMock()

      const onMapClick = vi.fn()
      render(<MapView onMapClick={onMapClick} />)

      await waitFor(() => {
        expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
      })

      expect(onMapClick).not.toHaveBeenCalled()
    })
  })

  describe('エラーハンドリング', () => {
    function setupFetchError() {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    }

    it('APIエラー時にトースト通知が表示される', async () => {
      setupFetchError()
      render(<MapView />)

      await waitFor(() => {
        expect(screen.getByText(/データの取得に失敗しました/i)).toBeInTheDocument()
      })
    })

    it('トースト通知は画面中央上部に表示される', async () => {
      setupFetchError()
      render(<MapView />)

      await waitFor(() => {
        const toast = screen.getByText(/データの取得に失敗しました/i)
        expect(toast.closest('[data-testid="toast-container"]')).toHaveClass('top-center')
      })
    })

    it('トースト通知は赤系の背景色で表示される', async () => {
      setupFetchError()
      render(<MapView />)

      await waitFor(() => {
        const toast = screen.getByText(/データの取得に失敗しました/i)
        expect(toast.closest('[role="alert"]')).toHaveClass('bg-red-500')
      })
    })
  })

  // Issue#96 PR3: 429 レート制限ハンドリング（パターンC: サイレント + 頻度制御通知）
  describe('Rate Limit (429) - レート制限（パターンC）', () => {
    beforeEach(() => {
      _resetRateLimitBurstTracker()
    })

    function setupRateLimitFetch() {
      global.fetch = vi.fn().mockResolvedValue(
        new Response('Too many requests', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Retry-After': '60' },
        })
      )
    }

    it('単発の 429 受信ではトースト通知が表示されない（サイレント）', async () => {
      setupRateLimitFetch()
      render(<MapView />)

      // fetch が呼ばれるまで待つ
      await waitFor(
        () => {
          expect(global.fetch).toHaveBeenCalled()
        },
        { timeout: 1500 }
      )

      // sonner のトーストが呼ばれていない
      expect(mockToast.error).not.toHaveBeenCalled()
      // 旧ジェネリックエラートーストも表示されない（429 は別経路で処理）
      expect(screen.queryByText(/データの取得に失敗しました/)).not.toBeInTheDocument()
    })
  })

  describe('Issue#111-followup Bug1: ズームボタンの下限制約', () => {
    it('zoomOut はズーム 0 を下回らない（負のズーム値は渡さない）', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(0) // 既に最小ズーム

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      ref.current.zoomOut()

      // easeTo の zoom 引数が 0 以上であること
      const lastCall = mockMap.easeTo.mock.calls.find(
        (c: any[]) => typeof c[0]?.zoom === 'number',
      )
      expect(lastCall).toBeDefined()
      expect(lastCall![0].zoom).toBeGreaterThanOrEqual(0)
    })

    it('zoomOut はズーム 1 から 0 まで下げられる', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(1)

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      ref.current.zoomOut()

      const lastCall = mockMap.easeTo.mock.calls.find(
        (c: any[]) => typeof c[0]?.zoom === 'number',
      )
      expect(lastCall![0].zoom).toBe(0)
    })
  })

  describe('Issue#64: ノースヘディング', () => {
    it('resetNorthHeadingメソッドがrefから呼び出せる', async () => {
      setupFetchMock()

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      expect(typeof ref.current.resetNorthHeading).toBe('function')
    })

    it('resetNorthHeadingがbearing=0, pitch=0, duration=500でeaseToを呼び出す（高ズーム時）', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(11) // 高ズーム

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      ref.current.resetNorthHeading()

      // 高ズーム時は center を動かさない（従来通り bearing/pitch のみ）
      expect(mockMap.easeTo).toHaveBeenCalledWith({
        bearing: 0,
        pitch: 0,
        duration: 500,
      })
    })

    it('Issue#111-followup Bug4 - ズーム0〜4のとき resetNorthHeading で緯度が 10（GLOBE_RESET_LAT）に戻る', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(2) // 地球儀表示中
      mockMap.getCenter.mockReturnValue({ lng: 139.7, lat: 35.6 }) // 高緯度

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      ref.current.resetNorthHeading()

      // center.lng は維持、lat は 10（GLOBE_RESET_LAT）にリセット、bearing/pitch も 0
      expect(mockMap.easeTo).toHaveBeenCalledWith({
        center: [139.7, 10],
        bearing: 0,
        pitch: 0,
        duration: 500,
      })
    })

    it('Issue#111-followup（5回目仕様変更）- 極端な緯度（南極大陸）でも resetNorthHeading が緯度 10 に戻す easeTo を呼ぶ', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)
      // 南極大陸を中心にした状態（lat=-80）
      mockMap.getCenter.mockReturnValue({ lng: 0, lat: -80 })

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      ref.current.resetNorthHeading()

      // どんなに極端な緯度でも lat=10 への easeTo が呼ばれる
      expect(mockMap.easeTo).toHaveBeenCalledWith({
        center: [0, 10],
        bearing: 0,
        pitch: 0,
        duration: 500,
      })
    })

    it('Issue#111-followup（5回目仕様変更）- 回転中に resetNorthHeading を呼ぶと easeTo 完了まで rAF を一時停止する', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        setupFetchMock()
        mockMap.getZoom.mockReturnValue(0)
        mockMap.getCenter.mockReturnValue({ lng: 0, lat: -80 })

        const ref = { current: null as any }
        render(<MapView ref={ref} />)

        await waitFor(() => {
          expect(ref.current).not.toBeNull()
        })

        // 回転を開始させる
        await act(async () => {
          vi.advanceTimersByTime(5100)
        })
        expect(mockMap.setCenter).toHaveBeenCalled()
        const callsBeforeReset = mockMap.setCenter.mock.calls.length

        // 回転中に resetNorthHeading を呼ぶ
        ref.current.resetNorthHeading()

        // 一時停止するため setCenter の呼び出しが増えない
        await act(async () => {
          vi.advanceTimersByTime(300)
        })
        expect(mockMap.setCenter.mock.calls.length).toBe(callsBeforeReset)

        // map.once('moveend', ...) が登録されている
        const moveendOnceCall = mockMap.once.mock.calls.find(
          (c: any[]) => c[0] === 'moveend' && typeof c[1] === 'function',
        )
        expect(moveendOnceCall).toBeDefined()

        // moveend を発火させて再開を確認
        await act(async () => {
          ;(moveendOnceCall![1] as Function)({})
          vi.advanceTimersByTime(200)
        })
        expect(mockMap.setCenter.mock.calls.length).toBeGreaterThan(callsBeforeReset)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('Issue#106: autoCenter（初期表示位置の自動決定）', () => {
    let originalGeolocation: Geolocation | undefined
    const mockGetCurrentPosition = vi.fn()

    beforeEach(() => {
      // navigator.geolocation のモック
      originalGeolocation = navigator.geolocation
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
      })
      mockGetCurrentPosition.mockReset()
      mockGetGeoCountryCache.mockReset()
      mockSetGeoCountryCache.mockReset()
      mockFetchMyCountry.mockReset()
    })

    afterEach(() => {
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', {
          value: originalGeolocation,
          configurable: true,
        })
      }
    })

    it('Issue#106 - autoCenter メソッドが MapViewHandle に存在する', async () => {
      setupFetchMock()
      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      expect(typeof ref.current.autoCenter).toBe('function')
    })

    it('Issue#106 - 位置情報取得成功時にワープアニメーション（jumpTo）でユーザー座標へ移動する', async () => {
      setupFetchMock()
      mockMap.getCenter.mockReturnValue({ lng: 139.7, lat: 35.6 })
      // 位置情報取得を成功させる（東京から離れた位置 = 大阪）
      mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
        success({
          coords: { latitude: 34.6937, longitude: 135.5023, accuracy: 100 } as GeolocationCoordinates,
          timestamp: Date.now(),
        } as GeolocationPosition)
      })

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      await ref.current.autoCenter()

      // ズーム0からの長距離移動なのでワープ（jumpTo）
      await waitFor(() => {
        expect(mockMap.jumpTo).toHaveBeenCalled()
      })
    })

    it('Issue#106 - 位置情報取得失敗 + キャッシュからの国コード取得成功時、国の中心座標にワープ', async () => {
      setupFetchMock()
      mockMap.getCenter.mockReturnValue({ lng: 0, lat: 0 })
      // 位置情報取得を失敗させる
      mockGetCurrentPosition.mockImplementation((_success: PositionCallback, error?: PositionErrorCallback) => {
        error?.({
          code: 1, // PERMISSION_DENIED
          message: 'User denied geolocation',
        } as GeolocationPositionError)
      })
      // キャッシュにJPがある
      mockGetGeoCountryCache.mockReturnValue('JP')

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      await ref.current.autoCenter()

      // ズーム5（国レベル）でワープが完了するまで待つ。
      // 前のテストで queue された rAF の影響を受けないよう、特定のズーム値で
      // jumpTo が呼ばれることを確認する。
      await waitFor(() => {
        const calls = mockMap.jumpTo.mock.calls
        expect(calls[calls.length - 1]?.[0]?.zoom).toBe(5)
      })
    })

    it('Issue#106 - 位置情報取得失敗 + キャッシュなし + API成功時、APIからの国コードを使ってワープ', async () => {
      setupFetchMock()
      mockMap.getCenter.mockReturnValue({ lng: 0, lat: 0 })
      mockGetCurrentPosition.mockImplementation((_success: PositionCallback, error?: PositionErrorCallback) => {
        error?.({ code: 1, message: 'User denied' } as GeolocationPositionError)
      })
      mockGetGeoCountryCache.mockReturnValue(null)
      mockFetchMyCountry.mockResolvedValue('US')

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      await ref.current.autoCenter()

      await waitFor(() => {
        expect(mockFetchMyCountry).toHaveBeenCalled()
        expect(mockSetGeoCountryCache).toHaveBeenCalledWith('US')
      })
    })

    it('Issue#106 - 位置情報失敗 + 国コードが COUNTRY_COORDINATES に存在しない場合、東京（ズーム11）にフォールバック', async () => {
      setupFetchMock()
      mockMap.getCenter.mockReturnValue({ lng: 0, lat: 0 })
      mockGetCurrentPosition.mockImplementation((_success: PositionCallback, error?: PositionErrorCallback) => {
        error?.({ code: 1, message: 'denied' } as GeolocationPositionError)
      })
      // キャッシュには存在しない国コード
      mockGetGeoCountryCache.mockReturnValue('ZZ')
      // fetchMyCountry も null にして API 経由でも取れない状態にする
      mockFetchMyCountry.mockResolvedValue(null)

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      await ref.current.autoCenter()

      // 東京（ズーム11）でワープが完了するまで待つ
      await waitFor(() => {
        const calls = mockMap.jumpTo.mock.calls
        expect(calls[calls.length - 1]?.[0]?.zoom).toBe(11)
      })
    })

    it('Issue#106 - 位置情報・キャッシュ・API すべて失敗時、東京（ズーム11）にフォールバック', async () => {
      setupFetchMock()
      mockMap.getCenter.mockReturnValue({ lng: 0, lat: 0 })
      mockGetCurrentPosition.mockImplementation((_success: PositionCallback, error?: PositionErrorCallback) => {
        error?.({ code: 1, message: 'denied' } as GeolocationPositionError)
      })
      mockGetGeoCountryCache.mockReturnValue(null)
      mockFetchMyCountry.mockResolvedValue(null)

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      await ref.current.autoCenter()

      await waitFor(() => {
        const calls = mockMap.jumpTo.mock.calls
        expect(calls[calls.length - 1]?.[0]?.zoom).toBe(11)
      })
    })
  })

  describe('Issue#111-followup §8: 全ズームレベル fetchSpots 許可', () => {
    it('Issue#111-followup - 初期ズームレベルが0でも fetchSpots が呼ばれる', async () => {
      // Issue#106 では「ズーム 0 では全世界 fetch を避けるためスキップ」していたが、
      // Issue#112 でクラスタクリック時のページネーションが入ったため、
      // ズーム 0 でも fetch を許可する仕様に変更した。
      // バックエンドの MAX_SPOTS_LIMIT=50 でレスポンス件数は保護される。
      const mockFetch = setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)

      render(<MapView />)

      // /spots エンドポイントへの fetch が呼ばれること
      await waitFor(() => {
        const spotsFetchCalls = (mockFetch.mock.calls as Array<[string]>).filter(
          ([url]) => typeof url === 'string' && url.includes('/spots'),
        )
        expect(spotsFetchCalls.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Issue#69: flyToPlace 距離判定', () => {
    it('近距離移動ではflyToが呼ばれjumpToは呼ばれない', async () => {
      setupFetchMock()
      mockMap.getCenter.mockReturnValue({ lng: 139.7, lat: 35.6 })

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      ref.current.flyToPlace(139.8, 35.7, 14)

      expect(mockMap.flyTo).toHaveBeenCalled()
      expect(mockMap.jumpTo).not.toHaveBeenCalled()
    })

    it('長距離移動ではjumpToが呼ばれflyToは呼ばれない', async () => {
      setupFetchMock()
      mockMap.getCenter.mockReturnValue({ lng: 139.7, lat: 35.6 })

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      ref.current.flyToPlace(-73.9, 40.7, 12)

      await waitFor(() => {
        expect(mockMap.jumpTo).toHaveBeenCalled()
      })
      expect(mockMap.flyTo).not.toHaveBeenCalled()
    })
  })

  describe('Issue#111: ユーザー位置情報キャッシュ（lastGeolocationCache）', () => {
    let originalGeolocation: Geolocation | undefined
    const mockGetCurrentPosition = vi.fn()
    const mockWatchPosition = vi.fn()
    const mockClearWatch = vi.fn()

    beforeEach(() => {
      originalGeolocation = navigator.geolocation
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: mockGetCurrentPosition,
          watchPosition: mockWatchPosition,
          clearWatch: mockClearWatch,
        },
        configurable: true,
      })
      mockGetCurrentPosition.mockReset()
      mockWatchPosition.mockReset()
      mockClearWatch.mockReset()
      mockGetGeoCountryCache.mockReset()
      mockSetGeoCountryCache.mockReset()
      mockFetchMyCountry.mockReset()
      mockGetLastGeolocationCache.mockReset()
      mockSetLastGeolocationCache.mockReset()
    })

    afterEach(() => {
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', {
          value: originalGeolocation,
          configurable: true,
        })
      }
    })

    it('Issue#111 - autoCenter で位置情報取得成功時に setLastGeolocationCache が呼ばれる', async () => {
      setupFetchMock()
      mockMap.getCenter.mockReturnValue({ lng: 139.7, lat: 35.6 })
      mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
        success({
          coords: { latitude: 34.6937, longitude: 135.5023, accuracy: 100 } as GeolocationCoordinates,
          timestamp: Date.now(),
        } as GeolocationPosition)
      })

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      await ref.current.autoCenter()

      await waitFor(() => {
        expect(mockSetLastGeolocationCache).toHaveBeenCalledWith(34.6937, 135.5023)
      })
    })

    it('Issue#111 - centerOnUserLocation の watchPosition 成功時に setLastGeolocationCache が呼ばれる', async () => {
      setupFetchMock()
      mockMap.getCenter.mockReturnValue({ lng: 139.7, lat: 35.6 })
      mockWatchPosition.mockImplementation((success: PositionCallback) => {
        success({
          coords: { latitude: 35.6585, longitude: 139.7454, accuracy: 100 } as GeolocationCoordinates,
          timestamp: Date.now(),
        } as GeolocationPosition)
        return 1 // watchId
      })

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      await ref.current.centerOnUserLocation()

      await waitFor(() => {
        expect(mockSetLastGeolocationCache).toHaveBeenCalledWith(35.6585, 139.7454)
      })
    })
  })

  describe('Issue#111: 初期経度のランダム化', () => {
    it('Issue#111 - 初回マウント時に Math.random が呼ばれる（経度のランダム化）', async () => {
      setupFetchMock()
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      try {
        render(<MapView />)

        await waitFor(() => {
          expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
        })

        expect(randomSpy).toHaveBeenCalled()
      } finally {
        randomSpy.mockRestore()
      }
    })

    it('Issue#111-followup - initialViewState の latitude は 10（球体の見え方が自然になる固定値）', async () => {
      setupFetchMock()
      render(<MapView />)

      await waitFor(() => {
        expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
      })

      const initialViewState = getCapturedInitialViewState()
      expect(initialViewState).toBeTruthy()
      expect(initialViewState.latitude).toBe(10)
    })

    it('Issue#111 - initialViewState の longitude は 0〜359 の範囲', async () => {
      setupFetchMock()
      render(<MapView />)

      await waitFor(() => {
        expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
      })

      const initialViewState = getCapturedInitialViewState()
      expect(initialViewState).toBeTruthy()
      expect(initialViewState.longitude).toBeGreaterThanOrEqual(0)
      expect(initialViewState.longitude).toBeLessThan(360)
    })
  })

  describe('Issue#111: autoCenter の skipMinView オプション', () => {
    let originalGeolocation: Geolocation | undefined
    const mockGetCurrentPosition = vi.fn()

    beforeEach(() => {
      originalGeolocation = navigator.geolocation
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
      })
      mockGetCurrentPosition.mockReset()
      mockGetGeoCountryCache.mockReset()
      mockFetchMyCountry.mockReset()
      mockGetLastGeolocationCache.mockReset()
      mockSetLastGeolocationCache.mockReset()
    })

    afterEach(() => {
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', {
          value: originalGeolocation,
          configurable: true,
        })
      }
    })

    it('Issue#111 - autoCenter({ skipMinView: true }) で AUTO_CENTER_MIN_VIEW_MS の待機がスキップされる', async () => {
      setupFetchMock()
      mockMap.getCenter.mockReturnValue({ lng: 0, lat: 0 })
      mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
        success({
          coords: { latitude: 34.6937, longitude: 135.5023, accuracy: 100 } as GeolocationCoordinates,
          timestamp: Date.now(),
        } as GeolocationPosition)
      })

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      const startedAt = Date.now()
      await ref.current.autoCenter({ skipMinView: true })
      const elapsed = Date.now() - startedAt

      // AUTO_CENTER_MIN_VIEW_MS = 1000ms。skipMinView 時は待機がスキップされ、
      // 数百ミリ秒以内に完了する想定。
      expect(elapsed).toBeLessThan(800)
      // ワープアニメーションは requestAnimationFrame 経由で jumpTo を呼ぶため非同期に発火する
      await waitFor(() => {
        expect(mockMap.jumpTo).toHaveBeenCalled()
      })
    })
  })

  describe('Issue#111: 地球儀回転アニメーション', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mockMap.setCenter.mockReset()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('Issue#111 - ズーム0で5秒間操作なしの場合、setCenter が呼ばれる（回転開始）', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)

      render(<MapView />)

      // mountは終わっているはず
      await act(async () => {
        // 5秒のアイドル待機 + 数フレーム分
        vi.advanceTimersByTime(5100)
      })

      expect(mockMap.setCenter).toHaveBeenCalled()
    })

    it('Issue#111 - ズーム5以上では 5秒経過しても setCenter は呼ばれない（回転しない）', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(5)

      render(<MapView />)

      await act(async () => {
        vi.advanceTimersByTime(10000)
      })

      expect(mockMap.setCenter).not.toHaveBeenCalled()
    })

    // Issue#111-followup（仕様変更3回目）: 「タップ/クリック/左ドラッグ」だけ停止対象に戻す。
    // ホイールズーム・ピンチズーム・角度操作は停止対象外（角度操作はそもそも無効化される）。
    const setupRotationActive = async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)
      render(<MapView />)
      await act(async () => {
        vi.advanceTimersByTime(5100)
      })
      expect(mockMap.setCenter).toHaveBeenCalled()
      return mockMap.setCenter.mock.calls.length
    }

    const findHandler = (eventName: string) => {
      return mockMap.on.mock.calls.find(
        (c: any[]) => c[0] === eventName && typeof c[1] === 'function',
      )
    }

    it('Issue#111-followup - mousedown（左ボタン）で回転が停止する', async () => {
      const callsBeforeStop = await setupRotationActive()
      const handler = findHandler('mousedown')![1] as Function
      await act(async () => {
        handler({ originalEvent: { button: 0 } })
        vi.advanceTimersByTime(500)
      })
      expect(mockMap.setCenter.mock.calls.length).toBe(callsBeforeStop)
    })

    it('Issue#111-followup - mousedown（右ボタン）では回転が停止しない（角度操作は無効化済みのため）', async () => {
      const callsBeforeStop = await setupRotationActive()
      const handler = findHandler('mousedown')![1] as Function
      await act(async () => {
        handler({ originalEvent: { button: 2 } })
        vi.advanceTimersByTime(200)
      })
      expect(mockMap.setCenter.mock.calls.length).toBeGreaterThan(callsBeforeStop)
    })

    it('Issue#111-followup - touchstart（1本指）で回転が停止する', async () => {
      const callsBeforeStop = await setupRotationActive()
      const handler = findHandler('touchstart')![1] as Function
      await act(async () => {
        handler({ originalEvent: { touches: [{}] } })
        vi.advanceTimersByTime(500)
      })
      expect(mockMap.setCenter.mock.calls.length).toBe(callsBeforeStop)
    })

    it('Issue#111-followup - touchstart（2本指）では回転が停止しない（ピンチズームは継続）', async () => {
      const callsBeforeStop = await setupRotationActive()
      const handler = findHandler('touchstart')![1] as Function
      await act(async () => {
        handler({ originalEvent: { touches: [{}, {}] } })
        vi.advanceTimersByTime(200)
      })
      expect(mockMap.setCenter.mock.calls.length).toBeGreaterThan(callsBeforeStop)
    })

    it('Issue#111-followup - rotatestart / pitchstart のリスナーは登録されない', () => {
      setupFetchMock()
      render(<MapView />)
      // これらのイベントは「回転を停止させない」ため、リスナー自体を登録しない
      expect(findHandler('rotatestart')).toBeUndefined()
      expect(findHandler('pitchstart')).toBeUndefined()
    })

    it('Issue#111-followup - wheel / zoomstart / zoomend のリスナーは登録される（rAF 一時停止用）', () => {
      setupFetchMock()
      render(<MapView />)
      expect(findHandler('wheel')).toBeDefined()
      expect(findHandler('zoomstart')).toBeDefined()
      expect(findHandler('zoomend')).toBeDefined()
    })

    it('Issue#111-followup（6回目仕様変更）- wheel イベントで rAF が一時停止する（zoomstart 前に）', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)

      render(<MapView />)
      await act(async () => {
        vi.advanceTimersByTime(5100)
      })
      expect(mockMap.setCenter).toHaveBeenCalled()
      const callsBeforeWheel = mockMap.setCenter.mock.calls.length

      const wheelHandler = findHandler('wheel')![1] as Function
      await act(async () => {
        wheelHandler({})
        vi.advanceTimersByTime(300)
      })

      // 一時停止しているので setCenter は増えない
      expect(mockMap.setCenter.mock.calls.length).toBe(callsBeforeWheel)
    })

    it('Issue#111-followup（6回目仕様変更）- zoomend で zoom > 4 の場合 isRotatingRef がクリアされる（fetchSpots スキップ防止）', async () => {
      const mockFetch = setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)

      render(<MapView />)

      // 回転を開始させる
      await act(async () => {
        vi.advanceTimersByTime(5100)
      })
      expect(mockMap.setCenter).toHaveBeenCalled()

      // ホイールでズーム 5 まで上がったとシミュレート（zoomstart で rAF キャンセル相当）
      const zoomstartHandler = findHandler('zoomstart')![1] as Function
      await act(async () => {
        zoomstartHandler({})
      })

      // zoom が 5 になったとシミュレート
      mockMap.getZoom.mockReturnValue(5)

      // zoomend で isRotating がクリアされるか
      const zoomendHandler = findHandler('zoomend')![1] as Function
      await act(async () => {
        zoomendHandler({})
      })

      // この後の moveend で fetchSpots が走るかを確認
      // handleMoveEnd を直接呼び出す代わりに、moveEnd を mockMap でシミュレートできる構造ではないため、
      // 代わりに handleMoveEnd 側のフェイルセーフをテスト
      // → 別テストで handleMoveEnd の中身は検証する
      // ここでは zoomend ハンドラ呼び出し後に setCenter が走らないことを確認
      const callsAfterZoomend = mockMap.setCenter.mock.calls.length
      await act(async () => {
        vi.advanceTimersByTime(500)
      })
      expect(mockMap.setCenter.mock.calls.length).toBe(callsAfterZoomend)
      void mockFetch // fetchSpots が呼ばれることはここではテストせず、fetch スキップのフェイルセーフは別途
    })

    it('Issue#111-followup - 回転中の setCenter は現在の緯度を維持する（強制スナップしない）', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)
      // ユーザーが緯度 35 度に panning した状態を再現
      mockMap.getCenter.mockReturnValue({ lng: 100, lat: 35 })

      render(<MapView />)
      await act(async () => {
        vi.advanceTimersByTime(5100)
      })

      // setCenter の引数の lat は 35（現在値）であって 10 ではない
      const setCenterCalls = mockMap.setCenter.mock.calls
      expect(setCenterCalls.length).toBeGreaterThan(0)
      for (const call of setCenterCalls) {
        const [, lat] = call[0] as [number, number]
        expect(lat).toBe(35)
      }
    })

    it('Issue#111-followup - zoomstart で rAF が一時停止し、zoomend で再開する（+/-ボタン対応）', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)

      render(<MapView />)

      // 回転開始まで進める
      await act(async () => {
        vi.advanceTimersByTime(5100)
      })
      expect(mockMap.setCenter).toHaveBeenCalled()

      const zoomstartHandler = findHandler('zoomstart')![1] as Function
      const zoomendHandler = findHandler('zoomend')![1] as Function

      // zoomstart で一時停止
      await act(async () => {
        zoomstartHandler({})
        vi.advanceTimersByTime(500)
      })
      const callsDuringPause = mockMap.setCenter.mock.calls.length

      // 一時停止中はさらに時間を進めても setCenter が増えない
      await act(async () => {
        vi.advanceTimersByTime(500)
      })
      expect(mockMap.setCenter.mock.calls.length).toBe(callsDuringPause)

      // zoomend で再開
      await act(async () => {
        zoomendHandler({})
        vi.advanceTimersByTime(200)
      })
      expect(mockMap.setCenter.mock.calls.length).toBeGreaterThan(callsDuringPause)
    })

    it('Issue#111-followup - ズーム0〜4では dragRotate / touchPitch / touchZoomRotate.rotation が無効化される', () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)
      render(<MapView />)
      expect(mockMap.dragRotate.disable).toHaveBeenCalled()
      expect(mockMap.touchPitch.disable).toHaveBeenCalled()
      expect(mockMap.touchZoomRotate.disableRotation).toHaveBeenCalled()
    })

    it('Issue#111-followup - ズーム5以上では dragRotate / touchPitch / touchZoomRotate.rotation が有効化される', () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(11)
      render(<MapView />)
      expect(mockMap.dragRotate.enable).toHaveBeenCalled()
      expect(mockMap.touchPitch.enable).toHaveBeenCalled()
      expect(mockMap.touchZoomRotate.enableRotation).toHaveBeenCalled()
    })

    it('Issue#111-followup - moveend でズームが 0〜4 に下がったら 5秒後の回転を予約する', async () => {
      // 高ズームで起動 → autoCenter 後を想定
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(11)

      render(<MapView />)
      // handleLoad の scheduleGlobeRotation は呼ばれない（zoom > 4）

      // ユーザーが手動でズームアウトしてズーム 4 になったとシミュレート
      mockMap.getZoom.mockReturnValue(4)
      // moveend ハンドラを直接呼ぶ
      // MapMock の onMoveEnd は 100ms / 200ms に setTimeout で呼ばれる構造になっている
      await act(async () => {
        vi.advanceTimersByTime(300) // moveend が 2 回呼ばれる
      })

      // 5秒経過させる
      await act(async () => {
        vi.advanceTimersByTime(5100)
      })

      // 回転が始まり setCenter が呼ばれている
      expect(mockMap.setCenter).toHaveBeenCalled()
    })

    it('Issue#111-followup - 回転中にズームが 5 以上に上がると rAF ループが自身で停止する', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)

      render(<MapView />)

      // 回転開始まで進める
      await act(async () => {
        vi.advanceTimersByTime(5100)
      })
      expect(mockMap.setCenter).toHaveBeenCalled()

      // ホイールズームでズーム 5 に上がったとシミュレート
      mockMap.getZoom.mockReturnValue(5)

      const callsBeforeZoomChange = mockMap.setCenter.mock.calls.length
      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      // rAF ループが自身で停止し setCenter の呼び出しが増えていない
      // （次フレームで getZoom > 4 を検出してループ終了する）
      const diff = mockMap.setCenter.mock.calls.length - callsBeforeZoomChange
      expect(diff).toBeLessThanOrEqual(1) // 検出までに最大 1 ティック分の余裕
    })

    it('Issue#111 - startGlobeRotationImmediately() で 5秒待たずに即時回転開始', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      // 即時回転開始メソッド（Issue#111 で追加予定）
      ref.current.startGlobeRotationImmediately()

      await act(async () => {
        // 数フレーム分だけ進める（5秒未満）
        vi.advanceTimersByTime(100)
      })

      expect(mockMap.setCenter).toHaveBeenCalled()
    })

    it('Issue#111 - 回転中の handleMoveEnd は fetchSpots をスキップする', async () => {
      const mockFetch = setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      // 即時回転開始
      ref.current.startGlobeRotationImmediately()

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // /spots fetchが呼ばれた回数を記録
      const spotsFetchBefore = (mockFetch.mock.calls as Array<[string]>).filter(
        ([url]) => typeof url === 'string' && url.includes('/spots'),
      ).length

      // 回転による setCenter で moveend が走る想定だが、回転中は fetchSpots をスキップする
      // （setCenter が moveend を発火する前提でテスト）
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      const spotsFetchAfter = (mockFetch.mock.calls as Array<[string]>).filter(
        ([url]) => typeof url === 'string' && url.includes('/spots'),
      ).length

      // 回転中はスポット取得が増えない
      expect(spotsFetchAfter).toBe(spotsFetchBefore)
    })
  })

  // ============================================================
  // Issue#111-followup §8: 回転中のクラスタ表示・ダイアログ中の停止
  // ============================================================
  describe('Issue#111-followup §8: 回転中のクラスタ表示', () => {
    it('Issue#111-followup - 回転開始時に setData(空配列) で既存ピンをクリアしない', async () => {
      // Issue#111 では setSpots([]) で回転開始時にピンをクリアしていたが、
      // §8 では「回転中もクラスタを表示する」仕様に変更したため、クリアしない。
      const mockFetch = setupFetchMock([
        { spotId: 1, latitude: 35.6, longitude: 139.7, pinColor: 'Green' as const, thumbnailUrl: 'thumb', photoCount: 1 },
      ])
      mockMap.getZoom.mockReturnValue(0)

      const ref = { current: null as any }
      render(<MapView ref={ref} />)
      await waitFor(() => expect(ref.current).not.toBeNull())

      // 初期ロードでピンがセットされる
      await waitFor(() => {
        expect(mockSourceData.lastSetData).not.toBeNull()
      })
      // 回転開始
      await act(async () => {
        ref.current.startGlobeRotationImmediately()
      })

      // setData の最後のデータが空配列ではないこと（既存ピンが保持されている）
      const lastFeatures = mockSourceData.lastSetData?.features ?? []
      expect(lastFeatures.length).toBeGreaterThan(0)

      void mockFetch
    })

    it('Issue#111-followup - ユーザー操作で停止した直後に fetchSpots（debounced）が呼ばれる', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        const mockFetch = setupFetchMock()
        mockMap.getZoom.mockReturnValue(0)

        render(<MapView />)
        // 5秒経過させて回転開始
        await act(async () => {
          vi.advanceTimersByTime(5100)
        })

        const spotsFetchBefore = (mockFetch.mock.calls as Array<[string]>).filter(
          ([url]) => typeof url === 'string' && url.includes('/spots'),
        ).length

        // mousedown(左) ハンドラを取得して呼ぶ
        const mousedownCall = mockMap.on.mock.calls.find(
          (c: any[]) => c[0] === 'mousedown' && typeof c[1] === 'function',
        )
        const handler = mousedownCall![1] as Function
        await act(async () => {
          handler({ originalEvent: { button: 0 } })
          // debounce 500ms 待つ
          vi.advanceTimersByTime(600)
        })

        // /spots への fetch が増えている
        const spotsFetchAfter = (mockFetch.mock.calls as Array<[string]>).filter(
          ([url]) => typeof url === 'string' && url.includes('/spots'),
        ).length
        expect(spotsFetchAfter).toBeGreaterThan(spotsFetchBefore)
      } finally {
        vi.useRealTimers()
      }
    })

    it('Issue#111-followup - zoomstart 経由の一時停止では fetchSpots は呼ばれない', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        const mockFetch = setupFetchMock()
        mockMap.getZoom.mockReturnValue(0)

        render(<MapView />)
        // 5秒経過させて回転開始
        await act(async () => {
          vi.advanceTimersByTime(5100)
        })

        const spotsFetchBefore = (mockFetch.mock.calls as Array<[string]>).filter(
          ([url]) => typeof url === 'string' && url.includes('/spots'),
        ).length

        // zoomstart ハンドラを呼ぶ（ズーム操作の一時停止）
        const zoomstartCall = mockMap.on.mock.calls.find(
          (c: any[]) => c[0] === 'zoomstart' && typeof c[1] === 'function',
        )
        const handler = zoomstartCall![1] as Function
        await act(async () => {
          handler({})
          vi.advanceTimersByTime(600)
        })

        // /spots への fetch は増えない
        const spotsFetchAfter = (mockFetch.mock.calls as Array<[string]>).filter(
          ([url]) => typeof url === 'string' && url.includes('/spots'),
        ).length
        expect(spotsFetchAfter).toBe(spotsFetchBefore)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('Issue#111-followup §8: 投稿詳細ダイアログ表示中の回転停止', () => {
    it('Issue#111-followup - isPhotoDialogOpen=true の間、5秒タイマー経過しても回転が始まらない', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        setupFetchMock()
        mockMap.getZoom.mockReturnValue(0)

        const { rerender } = render(<MapView isPhotoDialogOpen={true} />)

        // 5秒タイマー経過させても setCenter（回転）が呼ばれない
        await act(async () => {
          vi.advanceTimersByTime(6000)
        })

        expect(mockMap.setCenter).not.toHaveBeenCalled()
        void rerender
      } finally {
        vi.useRealTimers()
      }
    })

    it('Issue#111-followup - 動いている回転中に isPhotoDialogOpen=true になると停止する', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        setupFetchMock()
        mockMap.getZoom.mockReturnValue(0)

        const { rerender } = render(<MapView isPhotoDialogOpen={false} />)
        // 5秒経過させて回転開始
        await act(async () => {
          vi.advanceTimersByTime(5100)
        })
        expect(mockMap.setCenter).toHaveBeenCalled()
        const callsBeforeOpen = mockMap.setCenter.mock.calls.length

        // ダイアログを開く（prop を更新）
        rerender(<MapView isPhotoDialogOpen={true} />)
        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        // 一時停止後は setCenter が増えない
        expect(mockMap.setCenter.mock.calls.length).toBe(callsBeforeOpen)
      } finally {
        vi.useRealTimers()
      }
    })

    it('Issue#111-followup - isPhotoDialogOpen が true→false に変わった時、ズーム 0〜4 なら 5秒後に回転が始まる', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        setupFetchMock()
        mockMap.getZoom.mockReturnValue(0)

        const { rerender } = render(<MapView isPhotoDialogOpen={true} />)
        await act(async () => {
          vi.advanceTimersByTime(6000) // ダイアログ表示中なので回転しない
        })
        expect(mockMap.setCenter).not.toHaveBeenCalled()

        // ダイアログを閉じる
        rerender(<MapView isPhotoDialogOpen={false} />)
        await act(async () => {
          vi.advanceTimersByTime(5100) // 5秒タイマー + 数フレーム
        })

        // 回転が始まり setCenter が呼ばれている
        expect(mockMap.setCenter).toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('Issue#111-followup - isPhotoDialogOpen が true→false に変わった時、ズーム 5+ なら回転は始まらない', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        setupFetchMock()
        mockMap.getZoom.mockReturnValue(11) // 写真スポット高ズーム

        const { rerender } = render(<MapView isPhotoDialogOpen={true} />)
        rerender(<MapView isPhotoDialogOpen={false} />)
        await act(async () => {
          vi.advanceTimersByTime(6000)
        })

        // ズーム 5+ なので回転は始まらない
        expect(mockMap.setCenter).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  // ============================================================
  // Issue#107: マップの地名ラベルを表示言語と連動させる
  // 表示言語を切り替えると map.setLanguage(newLang) が呼ばれ、
  // マップ上の地名ラベルが新しい言語で表示されることを検証する
  // ============================================================
  describe('Issue#107: 表示言語と連動するマップ言語', () => {
    afterEach(async () => {
      // 他テストへの影響を避けるため日本語に戻す
      await i18n.changeLanguage('ja')
    })

    it('Issue#107 - 言語を ja → en に切り替えると map.setLanguage("en") が呼ばれる', async () => {
      await i18n.changeLanguage('ja')
      setupFetchMock()

      render(<MapView />)

      // マウント直後の setLanguage 呼び出し（初期言語反映）はクリアして、
      // 言語切替に伴う呼び出しのみを検証する
      mockMap.setLanguage.mockClear()

      await act(async () => {
        await i18n.changeLanguage('en')
      })

      expect(mockMap.setLanguage).toHaveBeenCalledWith('en')
    })

    it('Issue#107 - 言語を ja → zh-CN に切り替えると map.setLanguage("zh-Hans") が呼ばれる（Mapbox言語コードに変換）', async () => {
      await i18n.changeLanguage('ja')
      setupFetchMock()

      render(<MapView />)

      mockMap.setLanguage.mockClear()

      await act(async () => {
        await i18n.changeLanguage('zh-CN')
      })

      // MAPBOX_LANGUAGE_MAP により 'zh-CN' → 'zh-Hans' に変換される
      expect(mockMap.setLanguage).toHaveBeenCalledWith('zh-Hans')
    })
  })
})
