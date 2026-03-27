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
const { mockMap, MapMock, mockSuggest, mockRetrieve, getCapturedOnMoveEnd, resetCapturedOnMoveEnd } = vi.hoisted(() => {
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

  const getCapturedOnMoveEnd = () => _capturedOnMoveEnd
  const resetCapturedOnMoveEnd = () => { _capturedOnMoveEnd = null }

  return { mockMap, MapMock, mockSuggest, mockRetrieve, getCapturedOnMoveEnd, resetCapturedOnMoveEnd }
})

vi.mock('react-map-gl', () => ({
  default: MapMock,
  Map: MapMock,
  Marker: ({ children }: any) => <div>{children}</div>,
}))

// Mapbox Search Box API のモック
vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(() => ({
    suggest: mockSuggest,
    retrieve: mockRetrieve,
  })),
  SessionToken: vi.fn(),
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

      // 検索候補が表示されるのを待ってクリック
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

      // 地図中心を更新
      mockMap.getCenter.mockReturnValue({ lng: 139.7454, lat: 35.6585 })

      // onMoveEnd イベントをシミュレート
      const capturedOnMoveEnd = getCapturedOnMoveEnd()
      expect(capturedOnMoveEnd).not.toBeNull()
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

      // 地図をドラッグした後の中心点をシミュレート
      mockMap.getCenter.mockReturnValue({ lng: 139.7000, lat: 35.6500 })

      const capturedOnMoveEnd = getCapturedOnMoveEnd()
      expect(capturedOnMoveEnd).not.toBeNull()
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

  describe('座標表示', () => {
    it('地図の中心座標が表示される', () => {
      render(
        <InlineMapPicker
          {...defaultProps}
          position={{ lat: 35.6585, lng: 139.7454 }}
        />
      )

      // 座標が4桁の精度で表示される（positionが直接渡されるので同期的に表示）
      expect(screen.getByText(/35\.6585/)).toBeInTheDocument()
      expect(screen.getByText(/139\.7454/)).toBeInTheDocument()
    })

    it('showCoordinates=falseの場合は座標が表示されない', () => {
      render(
        <InlineMapPicker
          {...defaultProps}
          position={{ lat: 35.6585, lng: 139.7454 }}
          showCoordinates={false}
        />
      )

      expect(screen.queryByText(/35\.6585/)).not.toBeInTheDocument()
      expect(screen.queryByText(/139\.7454/)).not.toBeInTheDocument()
    })
  })
})
