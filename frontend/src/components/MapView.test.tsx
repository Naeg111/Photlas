import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import MapView from './MapView'

/**
 * Issue#13: 地図検索機能のインタラクション改善とピン表示制御
 * TDD Red段階のテストコード
 */

// Google Maps APIのモック
const mockMap = {
  setZoom: vi.fn(),
  getZoom: vi.fn(),
  getCenter: vi.fn(() => ({ lat: () => 35.6585, lng: () => 139.7454 })),
  getBounds: vi.fn(() => ({
    getNorthEast: () => ({ lat: () => 35.7, lng: () => 139.8 }),
    getSouthWest: () => ({ lat: () => 35.6, lng: () => 139.7 }),
  })),
  addListener: vi.fn((event: string, callback: () => void) => {
    if (event === 'idle') {
      // idle イベントをシミュレート（初回と地図移動後）
      setTimeout(callback, 100)
      setTimeout(callback, 200)
    }
    return { remove: vi.fn() }
  }),
}

// @react-google-maps/api のモック
vi.mock('@react-google-maps/api', () => ({
  GoogleMap: ({ children, onLoad, zoom }: any) => {
    if (onLoad) {
      onLoad(mockMap)
    }
    return (
      <div data-testid="google-map" data-zoom={zoom}>
        {children}
      </div>
    )
  },
  useLoadScript: () => ({
    isLoaded: true,
    loadError: undefined,
  }),
  MarkerF: ({ position, onClick }: any) => (
    <div
      data-testid="map-marker"
      data-lat={position.lat}
      data-lng={position.lng}
      onClick={onClick}
    />
  ),
  OverlayViewF: ({ children }: any) => <div>{children}</div>,
}))

// fetch APIのモック
global.fetch = vi.fn()

describe('MapView Component - Issue#13', () => {
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

    it('地図移動後（idle イベント）にAPIが呼ばれる', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
      global.fetch = mockFetch

      render(<MapView />)

      // idle イベント（初回と地図移動）により2回APIが呼ばれることを確認
      // モックは100msと200msで2回のidleイベントをシミュレートする
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
        // ピンのスタイルが円形（border-radius: 50%）であることを確認
        const pin = screen.getByTestId('map-pin-1')
        expect(pin).toHaveClass('rounded-full')

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
        expect(pin).toHaveClass('bg-green-500')
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
        expect(pin).toHaveClass('bg-yellow-500')
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
        expect(pin).toHaveClass('bg-orange-500')
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
        expect(pin).toHaveClass('bg-red-500')
      })
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
