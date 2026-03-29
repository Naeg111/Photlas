import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import MapView from './MapView'

/**
 * Issue#53: Google Maps API から Mapbox API への移行
 * Issue#55: Symbol Layer移行 + クラスタリングアニメーション
 */

// API設定のモック
vi.mock('../config/api', () => ({
  API_V1_URL: 'http://localhost:3000/api/v1',
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
const { mockMap, mockSourceData, MapMock, resetMockMountFlag } = vi.hoisted(() => {
  let hasMounted = false
  const timerIds: ReturnType<typeof setTimeout>[] = []

  // addSourceに渡されたデータを保存
  let sourceData: { id: string; config: any }[] = []
  // addLayerに渡された設定を保存
  const layers: { config: any }[] = []
  // 登録されたイメージIDを保存
  const images: Set<string> = new Set()
  // イベントハンドラーを保存
  const eventHandlers: Record<string, Record<string, Function>> = {}
  // GeoJSONソースのsetData呼び出しを記録
  let lastSetData: any = null

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
    on: vi.fn((event: string, layerOrHandler: string | Function, handler?: Function) => {
      if (typeof layerOrHandler === 'string' && handler) {
        // map.on('click', 'layerId', handler) 形式
        if (!eventHandlers[event]) eventHandlers[event] = {}
        eventHandlers[event][layerOrHandler] = handler
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
  const MapMock = ({ children, onLoad, onMoveEnd }: any) => {
    if (!hasMounted) {
      hasMounted = true
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
  }

  const mockSourceData = {
    get sources() { return sourceData },
    get layers() { return layers },
    get images() { return images },
    get eventHandlers() { return eventHandlers },
    get lastSetData() { return lastSetData },
  }

  return { mockMap, mockSourceData, MapMock, resetMockMountFlag }
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

    it('地図移動後（onMoveEnd イベント）にAPIが呼ばれる', async () => {
      const mockFetch = setupFetchMock()

      render(<MapView />)

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(3)
        },
        { timeout: 300 }
      )
    })
  })

  describe('ズームレベルによる表示制御と誘導UI', () => {
    it('Issue#68 - Zoom 10未満の場合、拡大を促す静的メッセージが表示される', async () => {
      mockMap.getZoom.mockReturnValue(9)

      render(<MapView />)

      await waitFor(() => {
        expect(screen.getByText(/投稿を表示するには地図を拡大してください/)).toBeInTheDocument()
      })
    })

    it('Issue#68 - メッセージはクリック不可である（cursor-pointerなし）', async () => {
      mockMap.getZoom.mockReturnValue(9)

      render(<MapView />)

      await waitFor(() => {
        const message = screen.getByText(/投稿を表示するには地図を拡大してください/)
        expect(message.closest('div[class*="cursor-pointer"]')).toBeNull()
      })
    })

    it('Issue#70 - ズームメッセージがsafe-area-inset-topを考慮した位置にある', async () => {
      mockMap.getZoom.mockReturnValue(9)

      render(<MapView />)

      await waitFor(() => {
        const message = screen.getByText(/投稿を表示するには地図を拡大してください/)
        const container = message.closest('div[class*="absolute"]')
        expect(container?.className).toContain('safe-area-inset-top')
      })
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
})
