import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MapPicker from './MapPicker'

/**
 * Issue#8: 位置設定用地図ピッカー (UI) - MapPickerコンポーネント テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - 全画面（またはモーダル内全画面）で表示
 * - Google Maps表示（固定ピン方式：画面中央にピン固定）
 * - 検索バー（Google Places Autocomplete）
 * - 現在地へ移動ボタン
 * - 決定ボタン（座標確定）とキャンセルボタン
 * - 初期座標を受け取る、デフォルトは日本全体
 */

describe('MapPicker', () => {
  const mockOnConfirm = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('UI Elements - UI要素の表示', () => {
    it('renders map picker when open prop is true', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      expect(screen.getByTestId('map-picker')).toBeInTheDocument()
    })

    it('does not render map picker when open prop is false', () => {
      render(<MapPicker open={false} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      expect(screen.queryByTestId('map-picker')).not.toBeInTheDocument()
    })

    it('renders map container', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      expect(screen.getByTestId('map-container')).toBeInTheDocument()
    })

    it('renders fixed center pin', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      // 固定ピンが画面中央に表示されることを確認
      const pin = screen.getByTestId('center-pin')
      expect(pin).toBeInTheDocument()
      expect(pin).toHaveClass('fixed')
    })

    it('renders search bar at the top', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const searchBar = screen.getByPlaceholderText(/場所を検索/)
      expect(searchBar).toBeInTheDocument()
      expect(searchBar).toHaveAttribute('type', 'text')
    })

    it('renders current location button', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: /現在地/ })).toBeInTheDocument()
    })

    it('renders confirm button at the bottom', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const confirmButton = screen.getByRole('button', { name: /この位置に決定/ })
      expect(confirmButton).toBeInTheDocument()
    })

    it('renders cancel button', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: /キャンセル/ })).toBeInTheDocument()
    })

    it('map container takes full screen height', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const mapContainer = screen.getByTestId('map-container')
      expect(mapContainer).toHaveClass('h-full')
    })
  })

  describe('Initial State - 初期状態', () => {
    it('uses default Japan center when no initialCenter is provided', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      // デフォルト座標が使用されることを確認
      const mapContainer = screen.getByTestId('map-container')
      expect(mapContainer).toBeInTheDocument()
      // 注: Google Mapsの実際の初期化は実装時に確認
    })

    it('uses provided initialCenter when given', () => {
      const customCenter = { lat: 35.6762, lng: 139.6503 } // 東京
      render(
        <MapPicker
          open={true}
          initialCenter={customCenter}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const mapContainer = screen.getByTestId('map-container')
      expect(mapContainer).toBeInTheDocument()
      // 注: 実装時にカスタム座標が使用されることを確認
    })

    it('has empty search bar initially', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const searchBar = screen.getByPlaceholderText(/場所を検索/)
      expect(searchBar).toHaveValue('')
    })
  })

  describe('Search Functionality - 検索機能', () => {
    it('allows typing in search bar', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const searchBar = screen.getByPlaceholderText(/場所を検索/)
      fireEvent.change(searchBar, { target: { value: '東京タワー' } })

      expect(searchBar).toHaveValue('東京タワー')
    })

    it('displays autocomplete suggestions when typing (mocked)', async () => {
      // Note: Google Places APIのモックは複雑なため、基本的なUIテストのみ
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const searchBar = screen.getByPlaceholderText(/場所を検索/)
      fireEvent.change(searchBar, { target: { value: '東京' } })

      // 実装時にAutocompleteのドロップダウンが表示されることを確認
      // await waitFor(() => {
      //   expect(screen.getByTestId('autocomplete-dropdown')).toBeInTheDocument()
      // })
    })
  })

  describe('Current Location - 現在地機能', () => {
    it('calls geolocation API when current location button is clicked', async () => {
      // Geolocation APIのモック
      const mockGeolocation = {
        getCurrentPosition: vi.fn((success) => {
          success({
            coords: {
              latitude: 35.6762,
              longitude: 139.6503
            }
          })
        })
      }
      vi.stubGlobal('navigator', { geolocation: mockGeolocation })

      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const currentLocationButton = screen.getByRole('button', { name: /現在地/ })
      fireEvent.click(currentLocationButton)

      await waitFor(() => {
        expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled()
      })

      vi.unstubAllGlobals()
    })

    it('shows error message when geolocation fails', async () => {
      // Geolocation APIのエラーモック
      const mockGeolocation = {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 1, message: 'User denied geolocation' })
        })
      }
      vi.stubGlobal('navigator', { geolocation: mockGeolocation })

      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const currentLocationButton = screen.getByRole('button', { name: /現在地/ })
      fireEvent.click(currentLocationButton)

      await waitFor(() => {
        expect(screen.getByText(/位置情報の取得に失敗しました/)).toBeInTheDocument()
      })

      vi.unstubAllGlobals()
    })
  })

  describe('Confirm and Cancel Actions - 決定とキャンセル', () => {
    it('calls onConfirm with current center coordinates when confirm button is clicked', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const confirmButton = screen.getByRole('button', { name: /この位置に決定/ })
      fireEvent.click(confirmButton)

      expect(mockOnConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: expect.any(Number),
          lng: expect.any(Number)
        })
      )
    })

    it('calls onConfirm with custom initial center when confirm is clicked without moving map', () => {
      const customCenter = { lat: 35.6762, lng: 139.6503 }
      render(
        <MapPicker
          open={true}
          initialCenter={customCenter}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const confirmButton = screen.getByRole('button', { name: /この位置に決定/ })
      fireEvent.click(confirmButton)

      expect(mockOnConfirm).toHaveBeenCalledWith(customCenter)
    })

    it('calls onCancel when cancel button is clicked', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const cancelButton = screen.getByRole('button', { name: /キャンセル/ })
      fireEvent.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('does not call onConfirm when cancel button is clicked', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const cancelButton = screen.getByRole('button', { name: /キャンセル/ })
      fireEvent.click(cancelButton)

      expect(mockOnConfirm).not.toHaveBeenCalled()
    })
  })

  describe('Fixed Pin Behavior - 固定ピンの動作', () => {
    it('pin remains at screen center regardless of map movement', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const pin = screen.getByTestId('center-pin')

      // ピンが中央固定であることを確認（CSSクラスで検証）
      expect(pin).toHaveClass('absolute')
      expect(pin).toHaveClass('top-1/2')
      expect(pin).toHaveClass('left-1/2')
    })

    it('pin has pointer-events-none to allow map interaction underneath', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const pin = screen.getByTestId('center-pin')
      expect(pin).toHaveClass('pointer-events-none')
    })
  })

  describe('Modal Behavior - モーダルの動作', () => {
    it('resets to initial state when closed and reopened', () => {
      const { rerender } = render(
        <MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
      )

      // 検索バーに入力
      const searchBar = screen.getByPlaceholderText(/場所を検索/)
      fireEvent.change(searchBar, { target: { value: '東京タワー' } })

      // 閉じて再度開く
      rerender(<MapPicker open={false} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)
      rerender(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      // 検索バーがリセットされていることを確認
      expect(screen.getByPlaceholderText(/場所を検索/)).toHaveValue('')
    })
  })

  describe('Accessibility - アクセシビリティ', () => {
    it('has proper ARIA labels for buttons', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: /現在地/ })).toHaveAttribute('aria-label')
      expect(screen.getByRole('button', { name: /この位置に決定/ })).toHaveAttribute('aria-label')
      expect(screen.getByRole('button', { name: /キャンセル/ })).toHaveAttribute('aria-label')
    })

    it('search bar has proper label', () => {
      render(<MapPicker open={true} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />)

      const searchBar = screen.getByPlaceholderText(/場所を検索/)
      expect(searchBar).toHaveAttribute('aria-label', '場所を検索')
    })
  })
})
