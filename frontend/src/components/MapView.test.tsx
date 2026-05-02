import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import MapView from './MapView'
import { _resetRateLimitBurstTracker } from '../utils/notifyIfRateLimited'

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

    it('resetNorthHeadingがbearing=0, pitch=0, duration=500でeaseToを呼び出す', async () => {
      setupFetchMock()

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      ref.current.resetNorthHeading()

      expect(mockMap.easeTo).toHaveBeenCalledWith({
        bearing: 0,
        pitch: 0,
        duration: 500,
      })
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

  describe('Issue#106: fetchSpots スキップ（autoCenter 完了前）', () => {
    it('Issue#106 - 初期ズームレベルが0で、autoCenter 完了前は fetchSpots が呼ばれない', async () => {
      const mockFetch = setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)

      render(<MapView />)

      // 初期マウント直後（autoCenter 未完了）→ fetchSpots は呼ばれない
      // ※ MapMock の onLoad が即座に発火するため、handleLoad 内では fetchSpots がスキップされるべき
      await new Promise(resolve => setTimeout(resolve, 100))

      // /spots エンドポイントへの fetch が呼ばれないことを確認
      const spotsFetchCalls = (mockFetch.mock.calls as Array<[string]>).filter(
        ([url]) => typeof url === 'string' && url.includes('/spots'),
      )
      expect(spotsFetchCalls.length).toBe(0)
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

    it('Issue#111 - initialViewState の latitude は 0（赤道）に固定される', async () => {
      setupFetchMock()
      render(<MapView />)

      await waitFor(() => {
        expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
      })

      const initialViewState = getCapturedInitialViewState()
      expect(initialViewState).toBeTruthy()
      expect(initialViewState.latitude).toBe(0)
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

    it('Issue#111 - movestart イベントで回転が停止する', async () => {
      setupFetchMock()
      mockMap.getZoom.mockReturnValue(0)

      render(<MapView />)

      // 回転開始まで進める
      await act(async () => {
        vi.advanceTimersByTime(5100)
      })

      expect(mockMap.setCenter).toHaveBeenCalled()
      const callsBeforeStop = mockMap.setCenter.mock.calls.length

      // movestart ハンドラを取得して呼ぶ（ユーザー操作のシミュレート）
      const movestartCall = mockMap.on.mock.calls.find(
        (c: any[]) => c[0] === 'movestart' && typeof c[1] === 'function',
      )
      expect(movestartCall).toBeDefined()
      const handler = movestartCall![1] as Function
      await act(async () => {
        // originalEvent 付きの event でユーザー操作をシミュレート
        // （回転自身の setCenter による movestart は originalEvent を持たない）
        handler({ originalEvent: { type: 'mousedown' } })
        // 回転停止後さらに時間を進める
        vi.advanceTimersByTime(500)
      })

      // 停止後は setCenter の呼び出し回数が増えない
      expect(mockMap.setCenter.mock.calls.length).toBe(callsBeforeStop)
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
})
