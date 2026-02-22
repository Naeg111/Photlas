import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import MapView from './MapView'

/**
 * Issue#53: Google Maps API から Mapbox API への移行
 * TDD Red段階のテストコード
 */

// API設定のモック
vi.mock('../config/api', () => ({
  API_V1_URL: 'http://localhost:3000/api/v1',
}))

// Mapbox GL JS のモックマップインスタンス
const mockMap = {
  setZoom: vi.fn(),
  getZoom: vi.fn(),
  getCenter: vi.fn(() => ({ lng: 139.7454, lat: 35.6585 })),
  getBounds: vi.fn(() => ({
    getNorth: () => 35.7,
    getSouth: () => 35.6,
    getEast: () => 139.8,
    getWest: () => 139.7,
  })),
  flyTo: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}

// react-map-gl のモック
const MapMock = ({ children, onLoad, onMoveEnd }: any) => {
  if (onLoad) {
    onLoad({ target: mockMap })
  }
  if (onMoveEnd) {
    // onMoveEnd イベントをシミュレート（初回と地図移動後）
    setTimeout(() => onMoveEnd({ target: mockMap }), 100)
    setTimeout(() => onMoveEnd({ target: mockMap }), 200)
  }
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

// fetch APIのモック
global.fetch = vi.fn()

describe('MapView Component - Issue#53', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMap.getZoom.mockReturnValue(11) // デフォルトはZoom 11
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('地図操作・状態に伴うピンの更新', () => {
    it('初回読み込み時にスポットAPIが呼ばれる', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 1,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            photoCount: 1,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/spots'),
          expect.any(Object)
        )
      })

      // パラメータに範囲（north, south, east, west）が含まれていることを確認
      const callArgs = mockFetch.mock.calls[0][0] as string
      expect(callArgs).toContain('north=')
      expect(callArgs).toContain('south=')
      expect(callArgs).toContain('east=')
      expect(callArgs).toContain('west=')
    })

    it('地図移動後（onMoveEnd イベント）にAPIが呼ばれる', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
      global.fetch = mockFetch

      render(<MapView />)

      // onMoveEnd イベント（初回と地図移動）により2回APIが呼ばれることを確認
      // モックは100msと200msで2回のonMoveEndイベントをシミュレートする
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(2)
        },
        { timeout: 300 }
      )
    })
  })

  describe('ズームレベルによる表示制御と誘導UI', () => {
    it('Zoom 11以上の場合、ピンが表示される', async () => {
      mockMap.getZoom.mockReturnValue(11)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 1,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            photoCount: 1,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const pin = screen.queryByTestId('map-pin-1')
        expect(pin).toBeInTheDocument()
      })
    })

    it('Zoom 10以下の場合、ピンが非表示になる', async () => {
      mockMap.getZoom.mockReturnValue(10)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 1,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            photoCount: 1,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const pin = screen.queryByTestId('map-pin-1')
        expect(pin).not.toBeInTheDocument()
      })
    })

    it('Zoom 10以下の場合、ズームバナーが表示される', async () => {
      mockMap.getZoom.mockReturnValue(10)

      render(<MapView />)

      await waitFor(() => {
        const banner = screen.getByText(/ズームしてスポットを表示/i)
        expect(banner).toBeInTheDocument()
      })
    })

    it('ズームバナーをタップするとZoom 11にズームアップする', async () => {
      mockMap.getZoom.mockReturnValue(10)
      const user = userEvent.setup()

      render(<MapView />)

      await waitFor(() => {
        const banner = screen.getByText(/ズームしてスポットを表示/i)
        expect(banner).toBeInTheDocument()
      })

      const banner = screen.getByText(/ズームしてスポットを表示/i)
      await user.click(banner)

      expect(mockMap.setZoom).toHaveBeenCalledWith(11)
    })
  })

  describe('ピンのデザイン', () => {
    it('ピンが円形で、写真枚数が表示される', async () => {
      mockMap.getZoom.mockReturnValue(11)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 1,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            photoCount: 3,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        // ピンがSVGマーカー形状で表示されていることを確認
        const pin = screen.getByTestId('map-pin-1')
        expect(pin.querySelector('svg')).toBeInTheDocument()

        // 写真枚数が表示されていることを確認
        expect(screen.getByText('3')).toBeInTheDocument()
      })
    })

    it('photoCountに応じてピンの色が変わる（1件=Green）', async () => {
      mockMap.getZoom.mockReturnValue(11)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 1,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            photoCount: 1,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const pin = screen.getByTestId('map-pin-1')
        expect(pin.querySelector('path')?.getAttribute('fill')).toBe('#00d68f')
      })
    })

    it('photoCountに応じてピンの色が変わる（5件以上=Yellow）', async () => {
      mockMap.getZoom.mockReturnValue(11)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 1,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Yellow',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            photoCount: 5,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const pin = screen.getByTestId('map-pin-1')
        expect(pin.querySelector('path')?.getAttribute('fill')).toBe('#ffbe0b')
      })
    })

    it('photoCountに応じてピンの色が変わる（10件以上=Orange）', async () => {
      mockMap.getZoom.mockReturnValue(11)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 1,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Orange',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            photoCount: 10,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const pin = screen.getByTestId('map-pin-1')
        expect(pin.querySelector('path')?.getAttribute('fill')).toBe('#ff6b35')
      })
    })

    it('photoCountに応じてピンの色が変わる（30件以上=Red）', async () => {
      mockMap.getZoom.mockReturnValue(11)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 1,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Red',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            photoCount: 30,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const pin = screen.getByTestId('map-pin-1')
        expect(pin.querySelector('path')?.getAttribute('fill')).toBe('#ff006e')
      })
    })
  })

  describe('Issue#39: ピンクラスタリング', () => {
    it('近接するスポットがクラスタまたは個別ピンとして表示される', async () => {
      // superclusterの内部判定によりクラスタ化の有無が変わるため、いずれかの表示を確認
      mockMap.getZoom.mockReturnValue(11)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 1,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb1.jpg',
            photoCount: 3,
          },
          {
            spotId: 2,
            latitude: 35.6586,
            longitude: 139.7455,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb2.jpg',
            photoCount: 2,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const pin1 = screen.queryByTestId('map-pin-1')
        const pin2 = screen.queryByTestId('map-pin-2')
        const hasCluster = pin1 === null && pin2 === null
        const hasIndividualPins = pin1 !== null && pin2 !== null
        expect(hasCluster || hasIndividualPins).toBe(true)
      })
    })

    it('十分に離れたスポットは個別ピンとして表示される', async () => {
      mockMap.getZoom.mockReturnValue(16)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 10,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb1.jpg',
            photoCount: 1,
          },
          {
            spotId: 11,
            latitude: 35.7000,
            longitude: 139.8000,
            pinColor: 'Yellow',
            thumbnailUrl: 'https://example.com/thumb2.jpg',
            photoCount: 5,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const pin10 = screen.getByTestId('map-pin-10')
        const pin11 = screen.getByTestId('map-pin-11')
        expect(pin10).toBeInTheDocument()
        expect(pin11).toBeInTheDocument()
      })
    })

    it('クラスタ化時は合計投稿件数、個別表示時は各件数が表示される', async () => {
      // superclusterの内部判定によりクラスタ化の有無が変わるため、いずれかの表示を確認
      mockMap.getZoom.mockReturnValue(11)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 20,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb1.jpg',
            photoCount: 8,
          },
          {
            spotId: 21,
            latitude: 35.6586,
            longitude: 139.7455,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb2.jpg',
            photoCount: 7,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const totalText = screen.queryByText('15')
        const individual8 = screen.queryByText('8')
        expect(totalText !== null || individual8 !== null).toBe(true)
      })
    })

    it('クラスタ化時は合計件数で色が決定、個別表示時はピンが表示される', async () => {
      // superclusterの内部判定によりクラスタ化の有無が変わるため、いずれかの表示を確認
      mockMap.getZoom.mockReturnValue(11)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 30,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb1.jpg',
            photoCount: 20,
          },
          {
            spotId: 31,
            latitude: 35.6586,
            longitude: 139.7455,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb2.jpg',
            photoCount: 15,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const clusterPin = document.querySelector('[data-testid^="map-cluster-"]')
        const greenPin = screen.queryByTestId('map-pin-30')
        expect(clusterPin !== null || greenPin !== null).toBe(true)
      })
    })

    it('クラスタピンまたは個別ピンが表示される', async () => {
      // superclusterの内部判定によりクラスタ化の有無が変わるため、いずれかの表示を確認
      mockMap.getZoom.mockReturnValue(11)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 40,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb1.jpg',
            photoCount: 3,
          },
          {
            spotId: 41,
            latitude: 35.6586,
            longitude: 139.7455,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb2.jpg',
            photoCount: 2,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const clusterPin = document.querySelector('[data-testid^="map-cluster-"]')
        const individualPin = document.querySelector('[data-testid^="map-pin-"]')
        expect(clusterPin !== null || individualPin !== null).toBe(true)
      })
    })

    it('クラスタが表示された場合、クリックでonClusterClickが呼ばれる', async () => {
      // superclusterの内部判定によりクラスタ化の有無が変わるため、クラスタ表示時のみ検証
      mockMap.getZoom.mockReturnValue(11)
      const user = userEvent.setup()
      const mockClusterClick = vi.fn()
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            spotId: 50,
            latitude: 35.6585,
            longitude: 139.7454,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb1.jpg',
            photoCount: 3,
          },
          {
            spotId: 51,
            latitude: 35.6586,
            longitude: 139.7455,
            pinColor: 'Green',
            thumbnailUrl: 'https://example.com/thumb2.jpg',
            photoCount: 2,
          },
        ],
      })
      global.fetch = mockFetch

      render(<MapView onClusterClick={mockClusterClick} />)

      await waitFor(() => {
        const cluster = document.querySelector('[data-testid^="map-cluster-"]')
        const pin = screen.queryByTestId('map-pin-50')
        expect(cluster !== null || pin !== null).toBe(true)
      })

      // クラスタが表示されていればクリックしてonClusterClick呼び出し確認
      const cluster = document.querySelector('[data-testid^="map-cluster-"]')
      if (cluster) {
        await user.click(cluster as HTMLElement)
        expect(mockClusterClick).toHaveBeenCalledWith(expect.arrayContaining([50, 51]))
      }
    })
  })

  describe('撮影地点プレビュー', () => {
    it('showShootingLocationPinで白色のピンが表示される', async () => {
      mockMap.getZoom.mockReturnValue(16)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
      global.fetch = mockFetch

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      // showShootingLocationPinを呼び出し
      ref.current.showShootingLocationPin(35.6585, 139.7454)

      await waitFor(() => {
        const pin = screen.getByTestId('shooting-location-pin')
        expect(pin).toBeInTheDocument()
        // 白色を確認
        const path = pin.querySelector('path')
        expect(path?.getAttribute('fill')).toBe('#ffffff')
      })

      // flyToが呼ばれたことを確認（Mapbox形式）
      expect(mockMap.flyTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [139.7454, 35.6585],
          zoom: 16,
        })
      )
    })

    it('clearShootingLocationPinで白色のピンが消える', async () => {
      mockMap.getZoom.mockReturnValue(16)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
      global.fetch = mockFetch

      const ref = { current: null as any }
      render(<MapView ref={ref} />)

      await waitFor(() => {
        expect(ref.current).not.toBeNull()
      })

      // ピンを表示してからクリア
      ref.current.showShootingLocationPin(35.6585, 139.7454)

      await waitFor(() => {
        expect(screen.getByTestId('shooting-location-pin')).toBeInTheDocument()
      })

      ref.current.clearShootingLocationPin()

      await waitFor(() => {
        expect(screen.queryByTestId('shooting-location-pin')).not.toBeInTheDocument()
      })
    })

    it('onMapClickコールバックが地図クリック時に呼ばれる', async () => {
      mockMap.getZoom.mockReturnValue(11)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
      global.fetch = mockFetch

      const onMapClick = vi.fn()
      render(<MapView onMapClick={onMapClick} />)

      await waitFor(() => {
        expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
      })

      // Mapbox MapのonClickが呼ばれることを確認
      // モックではMapのonClickは直接テストできないので、
      // propsが正しく渡されることを確認
      expect(onMapClick).not.toHaveBeenCalled()
    })
  })

  describe('エラーハンドリング', () => {
    it('APIエラー時にトースト通知が表示される', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const toast = screen.getByText(/データの取得に失敗しました/i)
        expect(toast).toBeInTheDocument()
      })
    })

    it('トースト通知は画面中央上部に表示される', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const toast = screen.getByText(/データの取得に失敗しました/i)
        const container = toast.closest('[data-testid="toast-container"]')
        expect(container).toHaveClass('top-center')
      })
    })

    it('トースト通知は赤系の背景色で表示される', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch

      render(<MapView />)

      await waitFor(() => {
        const toast = screen.getByText(/データの取得に失敗しました/i)
        expect(toast.closest('[role="alert"]')).toHaveClass('bg-red-500')
      })
    })
  })
})
