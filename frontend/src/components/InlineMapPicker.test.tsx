import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { InlineMapPicker, DEFAULT_CENTER } from './InlineMapPicker'

/**
 * Issue#53: Google Maps API から Mapbox API への移行
 * InlineMapPicker の Mapbox 移行テスト（センタリングのみ方式）
 *
 * 移行後の動作:
 * 1. 場所検索は Mapbox Search Box API を使用
 * 2. 検索候補選択時は地図のセンタリングのみ（flyTo）
 * 3. 最終座標は常に地図中心点（ユーザー確定位置）から取得
 * 4. Geocoder は使用しない
 */

// Mapbox GL JS (react-map-gl) のモック
const { mockMap, MapMock, mockSuggest, mockRetrieve, mockForward, getCapturedOnMoveEnd, resetCapturedOnMoveEnd } = vi.hoisted(() => {
  let _capturedOnMoveEnd: ((e: any) => void) | null = null

  const mockMap = {
    getCenter: vi.fn(() => ({ lng: 139.6503, lat: 35.6762 })),
    flyTo: vi.fn(),
    setLanguage: vi.fn(),
    getZoom: vi.fn(() => 15),
  }

  const MapMock = ({ children, onLoad, onMoveEnd }: any) => {
    if (onLoad) {
      onLoad({ target: mockMap })
    }
    // onMoveEnd を後からシミュレートできるようキャプチャ
    _capturedOnMoveEnd = onMoveEnd
    return (
      <div data-testid="mapbox-map">
        {children}
      </div>
    )
  }

  const mockSuggest = vi.fn()
  const mockRetrieve = vi.fn()
  const mockForward = vi.fn()

  const getCapturedOnMoveEnd = () => _capturedOnMoveEnd
  const resetCapturedOnMoveEnd = () => { _capturedOnMoveEnd = null }

  return { mockMap, MapMock, mockSuggest, mockRetrieve, mockForward, getCapturedOnMoveEnd, resetCapturedOnMoveEnd }
})

vi.mock('react-map-gl', () => ({
  default: MapMock,
  Map: MapMock,
  Marker: ({ children }: any) => <div>{children}</div>,
}))

// Mapbox Search Box API / Geocoding API のモック
vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(() => ({
    suggest: mockSuggest,
    retrieve: mockRetrieve,
  })),
  GeocodingCore: vi.fn(() => ({
    forward: mockForward,
  })),
  SessionToken: vi.fn(),
}))

// Issue#106: IP国判定キャッシュのモック
const { mockGetGeoCountryCacheIMP } = vi.hoisted(() => ({
  mockGetGeoCountryCacheIMP: vi.fn(),
}))
vi.mock('../utils/geoCountryCache', () => ({
  getGeoCountryCache: mockGetGeoCountryCacheIMP,
  setGeoCountryCache: vi.fn(),
  GEO_COUNTRY_CACHE_KEY: 'photlas_geo_country',
  GEO_COUNTRY_CACHE_TTL_MS: 24 * 60 * 60 * 1000,
}))

describe('InlineMapPicker - Issue#53: Mapbox移行', () => {
  const defaultProps = {
    position: null as { lat: number; lng: number } | null,
    onPositionChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    resetCapturedOnMoveEnd()
    // GeocodingCoreのデフォルトモック（空結果）
    mockForward.mockResolvedValue({ features: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('地図表示', () => {
    it('Mapbox GL JS の地図コンポーネントが表示される', () => {
      render(<InlineMapPicker {...defaultProps} />)

      expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
    })

    it('初期位置が指定されている場合、その位置で地図が表示される', () => {
      render(
        <InlineMapPicker
          {...defaultProps}
          position={{ lat: 35.6585, lng: 139.7454 }}
        />
      )

      expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
    })

    it('position未指定時のデフォルト位置が東京駅である', () => {
      expect(DEFAULT_CENTER.lat).toBeCloseTo(35.6812, 3)
      expect(DEFAULT_CENTER.lng).toBeCloseTo(139.7671, 3)
    })
  })

  describe('場所検索（Mapbox Search Box API）', () => {
    it('検索入力でMapbox Search Box APIのsuggestが呼ばれる', async () => {
      mockSuggest.mockResolvedValue({
        suggestions: [
          {
            name: '東京タワー',
            full_address: '東京都港区芝公園4丁目2-8',
            mapbox_id: 'test-mapbox-id-1',
          },
        ],
      })

      render(<InlineMapPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/場所を検索/)
      fireEvent.change(searchInput, { target: { value: '東京タワー' } })

      // デバウンス待ち（300ms）- async版でPromise microtaskもフラッシュ
      await vi.advanceTimersByTimeAsync(300)

      expect(mockSuggest).toHaveBeenCalled()
    })

    it('検索がグローバル対応されている（country制限なし）', async () => {
      mockSuggest.mockResolvedValue({ suggestions: [] })

      render(<InlineMapPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/場所を検索/)
      fireEvent.change(searchInput, { target: { value: '東京' } })

      await vi.advanceTimersByTimeAsync(300)

      expect(mockSuggest).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({
          country: expect.anything(),
        })
      )
    })

    it('検索候補選択時は地図のセンタリングのみ行われる（flyTo）', async () => {
      mockSuggest.mockResolvedValue({
        suggestions: [
          {
            name: '東京タワー',
            full_address: '東京都港区芝公園4丁目2-8',
            mapbox_id: 'test-mapbox-id-1',
          },
        ],
      })

      mockRetrieve.mockResolvedValue({
        features: [
          {
            geometry: {
              coordinates: [139.7454, 35.6585],
            },
          },
        ],
      })

      render(<InlineMapPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/場所を検索/)
      fireEvent.change(searchInput, { target: { value: '東京タワー' } })

      // デバウンス待ち + Promise flush
      await vi.advanceTimersByTimeAsync(300)

      expect(mockSuggest).toHaveBeenCalled()

      // React再レンダリングのためリアルタイマーに切り替え
      vi.useRealTimers()

      // 検索候補が表示されるのを待ってpointerDownで選択
      const suggestion = await screen.findByText('東京タワー')
      fireEvent.click(suggestion)

      // flyToが呼ばれることを確認（センタリング）
      await waitFor(() => {
        expect(mockMap.flyTo).toHaveBeenCalledWith(
          expect.objectContaining({
            center: [139.7454, 35.6585],
          })
        )
      })

      // この時点ではonPositionChangeは呼ばれない（地図移動完了を待つ）
      expect(defaultProps.onPositionChange).not.toHaveBeenCalled()
    })
  })

  describe('センタリングのみ方式（座標取得）', () => {
    it('地図移動完了後に中心座標がonPositionChangeに伝播される', () => {
      const onPositionChange = vi.fn()
      render(
        <InlineMapPicker
          {...defaultProps}
          onPositionChange={onPositionChange}
        />
      )

      const capturedOnMoveEnd = getCapturedOnMoveEnd()
      expect(capturedOnMoveEnd).not.toBeNull()

      // 初回moveEnd（初期レンダリング）をスキップ
      capturedOnMoveEnd!({ target: mockMap })

      // 地図中心を更新
      mockMap.getCenter.mockReturnValue({ lng: 139.7454, lat: 35.6585 })

      // 2回目のonMoveEndで座標が伝播される
      capturedOnMoveEnd!({ target: mockMap })

      expect(onPositionChange).toHaveBeenCalledWith({
        lat: 35.6585,
        lng: 139.7454,
      })
    })

    it('座標はGeocoding APIではなく地図中心点から取得される', () => {
      const onPositionChange = vi.fn()
      render(
        <InlineMapPicker
          {...defaultProps}
          onPositionChange={onPositionChange}
        />
      )

      const capturedOnMoveEnd = getCapturedOnMoveEnd()
      expect(capturedOnMoveEnd).not.toBeNull()

      // 初回moveEndをスキップ
      capturedOnMoveEnd!({ target: mockMap })

      // 地図をドラッグした後の中心点をシミュレート
      mockMap.getCenter.mockReturnValue({ lng: 139.7000, lat: 35.6500 })

      capturedOnMoveEnd!({ target: mockMap })

      // map.getCenter() の値がそのまま渡される
      expect(onPositionChange).toHaveBeenCalledWith({
        lat: 35.6500,
        lng: 139.7000,
      })
    })
  })

  describe('現在地ボタン', () => {
    it('現在地ボタンが表示される', () => {
      render(<InlineMapPicker {...defaultProps} />)

      const locationButton = screen.getByRole('button', { name: /現在地/ })
      expect(locationButton).toBeInTheDocument()
    })
  })

  // ============================================================
  // Issue#76: ピン色のカスタマイズ
  // ============================================================

  describe('Issue#76: ピン色のカスタマイズ', () => {
    it('pinColor未指定時はデフォルトの赤色ピンが表示される', () => {
      render(<InlineMapPicker {...defaultProps} />)

      const pin = screen.getByTestId('center-pin')
      const svg = pin.querySelector('svg')
      expect(svg).toHaveStyle({ color: '#ef4444' })
    })

    it('pinColorを指定するとピンの色が変わる', () => {
      render(<InlineMapPicker {...defaultProps} pinColor="#3B82F6" />)

      const pin = screen.getByTestId('center-pin')
      const svg = pin.querySelector('svg')
      expect(svg).toHaveStyle({ color: '#3B82F6' })
    })
  })

  // ============================================================
  // Issue#76: 追加マーカー
  // ============================================================

  describe('Issue#76: 追加マーカー', () => {
    it('markers propで追加マーカーが表示される', () => {
      const markers = [
        { lat: 35.6585, lng: 139.7454, color: '#EF4444' },
      ]
      render(<InlineMapPicker {...defaultProps} markers={markers} />)

      expect(screen.getByTestId('additional-marker-0')).toBeInTheDocument()
    })

    it('markers未指定時は追加マーカーが表示されない', () => {
      render(<InlineMapPicker {...defaultProps} />)

      expect(screen.queryByTestId('additional-marker-0')).not.toBeInTheDocument()
    })
  })

  describe('座標表示の廃止', () => {
    it('positionを指定しても座標テキストが表示されない', () => {
      render(
        <InlineMapPicker
          {...defaultProps}
          position={{ lat: 35.6585, lng: 139.7454 }}
        />
      )

      expect(screen.queryByText(/緯度/)).not.toBeInTheDocument()
      expect(screen.queryByText(/経度/)).not.toBeInTheDocument()
    })
  })

  // ============================================================
  // 検索エリアのz-index
  // 検索候補ドロップダウンが中央ピンの上に表示されるようにする
  // ============================================================

  describe('検索エリアのz-index', () => {
    it('検索エリアが中央ピンより高いz-indexを持つ', () => {
      render(<InlineMapPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/場所を検索/)
      // searchInput → relative div → searchArea div
      const searchArea = searchInput.parentElement!.parentElement! as HTMLElement
      const centerPin = screen.getByTestId('center-pin') as HTMLElement

      expect(Number(searchArea.style.zIndex)).toBeGreaterThan(Number(centerPin.style.zIndex || 0))
    })
  })

  // ============================================================
  // Mapbox帰属表示
  // ネイティブのMapboxコントロールはオーバーレイの背面に隠れるため
  // オーバーレイ内にカスタムのロゴ・帰属表示を配置する
  // ============================================================

  // ============================================================
  // オーバーレイのGPU合成レイヤー
  // iPhone 15 Pro MaxなどでWebGLキャンバスの背面にオーバーレイが
  // 描画される問題を防止するため、translateZ(0)でGPU合成レイヤーを生成する
  // ============================================================

  describe('オーバーレイのGPU合成レイヤー', () => {
    it('オーバーレイにtranslateZ(0)が設定されている', () => {
      render(<InlineMapPicker {...defaultProps} />)

      const centerPin = screen.getByTestId('center-pin')
      const overlay = centerPin.parentElement!

      expect(overlay.style.transform).toContain('translateZ(0)')
    })
  })

  describe('Mapbox帰属表示', () => {
    it('Mapboxロゴがmapbox.comへのリンクとして表示される', () => {
      render(<InlineMapPicker {...defaultProps} />)

      const logoLink = screen.getByLabelText('Mapbox ホームページ')
      expect(logoLink.tagName).toBe('A')
      expect(logoLink).toHaveAttribute('href', 'https://www.mapbox.com/')
      expect(logoLink).toHaveAttribute('target', '_blank')
      expect(logoLink).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('帰属情報ボタンを押すとMapboxとOpenStreetMapの帰属リンクが表示される', () => {
      render(<InlineMapPicker {...defaultProps} />)

      const infoButton = screen.getByRole('button', { name: '帰属情報' })
      fireEvent.click(infoButton)

      const mapboxLink = screen.getByRole('link', { name: '© Mapbox' })
      expect(mapboxLink).toHaveAttribute('href', 'https://www.mapbox.com/about/maps')

      const osmLink = screen.getByRole('link', { name: '© OpenStreetMap' })
      expect(osmLink).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright/')
    })

    it('帰属情報ボタンを再度押すと帰属リンクが非表示になる', () => {
      render(<InlineMapPicker {...defaultProps} />)

      const infoButton = screen.getByRole('button', { name: '帰属情報' })

      // 開く
      fireEvent.click(infoButton)
      expect(screen.getByRole('link', { name: '© Mapbox' })).toBeInTheDocument()

      // 閉じる
      fireEvent.click(infoButton)
      expect(screen.queryByRole('link', { name: '© Mapbox' })).not.toBeInTheDocument()
    })
  })

  // ============================================================
  // SearchBoxCoreとGeocodingCoreのAPI併用
  // POI（駅・店舗）と行政区分（都道府県・市区町村）を網羅的に検索する
  // ============================================================

  describe('API併用検索（SearchBox + Geocoding）', () => {
    it('SearchBoxCoreとGeocodingCoreの両方の結果が候補に表示される', async () => {
      mockSuggest.mockResolvedValue({
        suggestions: [
          { name: '渋谷駅', full_address: '東京都渋谷区', mapbox_id: 'sb-1' },
        ],
      })
      mockForward.mockResolvedValue({
        features: [
          {
            properties: { name: '渋谷区', place_formatted: '東京都, 日本', mapbox_id: 'geo-1', feature_type: 'district' },
            geometry: { coordinates: [139.6989, 35.6580] },
          },
        ],
      })

      render(<InlineMapPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/場所を検索/)
      fireEvent.change(searchInput, { target: { value: '渋谷' } })

      await vi.advanceTimersByTimeAsync(300)

      vi.useRealTimers()

      // 両方の結果が表示される
      await waitFor(() => {
        expect(screen.getByText('渋谷区')).toBeInTheDocument()
        expect(screen.getByText('渋谷駅')).toBeInTheDocument()
      })
    })

    it('Geocoding由来の結果を選択するとretrieveなしで座標が取得される', async () => {
      mockSuggest.mockResolvedValue({ suggestions: [] })
      mockForward.mockResolvedValue({
        features: [
          {
            properties: { name: '渋谷区', place_formatted: '東京都, 日本', mapbox_id: 'geo-1', feature_type: 'district' },
            geometry: { coordinates: [139.6989, 35.6580] },
          },
        ],
      })

      render(<InlineMapPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/場所を検索/)
      fireEvent.change(searchInput, { target: { value: '渋谷区' } })

      await vi.advanceTimersByTimeAsync(300)

      vi.useRealTimers()

      const suggestion = await screen.findByText('渋谷区')
      fireEvent.click(suggestion)

      // retrieveは呼ばれず、直接flyToで移動する
      await waitFor(() => {
        expect(mockRetrieve).not.toHaveBeenCalled()
        expect(mockMap.flyTo).toHaveBeenCalledWith(
          expect.objectContaining({
            center: [139.6989, 35.6580],
          })
        )
      })
    })
  })

  describe('Issue#106: 初期表示位置のフォールバック', () => {
    let originalGeolocation: Geolocation | undefined
    let originalPermissions: Permissions | undefined

    beforeEach(() => {
      mockGetGeoCountryCacheIMP.mockReset()
      originalGeolocation = navigator.geolocation
      originalPermissions = navigator.permissions
    })

    afterEach(() => {
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', {
          value: originalGeolocation,
          configurable: true,
        })
      }
      if (originalPermissions) {
        Object.defineProperty(navigator, 'permissions', {
          value: originalPermissions,
          configurable: true,
        })
      }
    })

    it('Issue#106 - position プロパティがない場合、IP国判定キャッシュの座標を使用する', () => {
      // permissions.query が denied を返す（ブラウザ位置情報を使わない）
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: vi.fn().mockResolvedValue({ state: 'denied' }),
        },
        configurable: true,
      })
      mockGetGeoCountryCacheIMP.mockReturnValue('JP')

      render(<InlineMapPicker {...defaultProps} position={null} />)

      // マップがレンダリングされ、useMemo 内で getGeoCountryCache（モック）が同期的に呼ばれる
      expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
      expect(mockGetGeoCountryCacheIMP).toHaveBeenCalled()
    })

    it('Issue#106 - position プロパティ・キャッシュ・許可すべてなしの場合、東京駅にフォールバック', async () => {
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: vi.fn().mockResolvedValue({ state: 'denied' }),
        },
        configurable: true,
      })
      mockGetGeoCountryCacheIMP.mockReturnValue(null)

      render(<InlineMapPicker {...defaultProps} position={null} />)

      // 東京駅をデフォルトとして使用
      expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
      expect(DEFAULT_CENTER.lat).toBeCloseTo(35.6812, 3)
      expect(DEFAULT_CENTER.lng).toBeCloseTo(139.7671, 3)
    })

    it('Issue#106 - permissions.query が例外を投げてもクラッシュせず動作する（Safari 15以前対策）', async () => {
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: vi.fn().mockRejectedValue(new Error('Not supported')),
        },
        configurable: true,
      })
      mockGetGeoCountryCacheIMP.mockReturnValue(null)

      // 例外が伝播しないこと
      expect(() => {
        render(<InlineMapPicker {...defaultProps} position={null} />)
      }).not.toThrow()

      expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
    })
  })
})
