import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { InlineMapPicker } from './InlineMapPicker'

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
const mockMap = {
  getCenter: vi.fn(() => ({ lng: 139.6503, lat: 35.6762 })),
  flyTo: vi.fn(),
  getZoom: vi.fn(() => 15),
}

let capturedOnMoveEnd: ((e: any) => void) | null = null

const MapMock = ({ children, onLoad, onMoveEnd }: any) => {
  if (onLoad) {
    onLoad({ target: mockMap })
  }
  // onMoveEnd を後からシミュレートできるようキャプチャ
  capturedOnMoveEnd = onMoveEnd
  return (
    <div data-testid="mapbox-map">
      {children}
    </div>
  )
}

vi.mock('react-map-gl', () => ({
  default: MapMock,
  Map: MapMock,
  Marker: ({ children }: any) => <div>{children}</div>,
}))

// Mapbox Search Box API のモック
const mockSuggest = vi.fn()
const mockRetrieve = vi.fn()

vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(() => ({
    suggest: mockSuggest,
    retrieve: mockRetrieve,
  })),
}))

describe('InlineMapPicker - Issue#53: Mapbox移行', () => {
  const defaultProps = {
    position: null as { lat: number; lng: number } | null,
    onPositionChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    capturedOnMoveEnd = null
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
  })

  describe('場所検索（Mapbox Search Box API）', () => {
    it('検索入力でMapbox Search Box APIのsuggestが呼ばれる', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

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
      await user.type(searchInput, '東京タワー')

      // デバウンス待ち（300ms）
      vi.advanceTimersByTime(300)

      await waitFor(() => {
        expect(mockSuggest).toHaveBeenCalled()
      })
    })

    it('検索が日本国内に制限されている', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      mockSuggest.mockResolvedValue({ suggestions: [] })

      render(<InlineMapPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/場所を検索/)
      await user.type(searchInput, '東京')

      vi.advanceTimersByTime(300)

      await waitFor(() => {
        expect(mockSuggest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            country: 'jp',
          })
        )
      })
    })

    it('検索候補選択時は地図のセンタリングのみ行われる（flyTo）', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

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
      await user.type(searchInput, '東京タワー')

      vi.advanceTimersByTime(300)

      await waitFor(() => {
        expect(mockSuggest).toHaveBeenCalled()
      })

      // 検索候補をクリック
      const suggestion = await screen.findByText('東京タワー')
      await user.click(suggestion)

      await waitFor(() => {
        // flyToが呼ばれることを確認（センタリング）
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
    it('地図移動完了後に中心座標がonPositionChangeに伝播される', async () => {
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
      if (capturedOnMoveEnd) {
        capturedOnMoveEnd({ target: mockMap })
      }

      await waitFor(() => {
        expect(onPositionChange).toHaveBeenCalledWith({
          lat: 35.6585,
          lng: 139.7454,
        })
      })
    })

    it('座標はGeocoding APIではなく地図中心点から取得される', async () => {
      const onPositionChange = vi.fn()
      render(
        <InlineMapPicker
          {...defaultProps}
          onPositionChange={onPositionChange}
        />
      )

      // 地図をドラッグした後の中心点をシミュレート
      mockMap.getCenter.mockReturnValue({ lng: 139.7000, lat: 35.6500 })

      if (capturedOnMoveEnd) {
        capturedOnMoveEnd({ target: mockMap })
      }

      await waitFor(() => {
        // map.getCenter() の値がそのまま渡される
        expect(onPositionChange).toHaveBeenCalledWith({
          lat: 35.6500,
          lng: 139.7000,
        })
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

  describe('座標表示', () => {
    it('地図の中心座標が表示される', async () => {
      mockMap.getCenter.mockReturnValue({ lng: 139.7454, lat: 35.6585 })

      render(
        <InlineMapPicker
          {...defaultProps}
          position={{ lat: 35.6585, lng: 139.7454 }}
        />
      )

      // 座標が4桁の精度で表示される
      await waitFor(() => {
        expect(screen.getByText(/35\.6585/)).toBeInTheDocument()
        expect(screen.getByText(/139\.7454/)).toBeInTheDocument()
      })
    })
  })
})
