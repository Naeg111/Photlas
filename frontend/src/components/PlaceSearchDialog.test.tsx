import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlaceSearchDialog } from './PlaceSearchDialog'

/**
 * Issue#69: PlaceSearchDialog のテスト
 */

// Mapbox Search JS Coreのモック
const mockSuggest = vi.fn()
const mockRetrieve = vi.fn()
const mockForward = vi.fn()
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

// Mapbox設定のモック
vi.mock('../config/mapbox', () => ({
  MAPBOX_ACCESS_TOKEN: 'test-token',
}))

/** テスト用のSearchBoxSuggestionを生成する */
function createSuggestion(
  mapboxId: string,
  name: string,
  fullAddress: string,
  featureType: string,
) {
  return { name, full_address: fullAddress, mapbox_id: mapboxId, feature_type: featureType }
}

/** テスト用のSearchBoxRetrieveレスポンスを生成する */
function createRetrieveResponse(coordinates: [number, number], featureType: string) {
  return {
    features: [{
      geometry: { coordinates },
      properties: { feature_type: featureType },
    }],
  }
}

/** テスト用のGeocodingFeatureを生成する */
function createGeocodingFeature(
  id: string,
  name: string,
  placeFormatted: string,
  coordinates: [number, number],
  featureType: string,
) {
  return {
    id,
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates },
    properties: {
      mapbox_id: id,
      feature_type: featureType,
      name,
      name_preferred: name,
      place_formatted: placeFormatted,
      full_address: `${name}, ${placeFormatted}`,
      coordinates: { longitude: coordinates[0], latitude: coordinates[1] },
      context: {},
    },
  }
}

describe('PlaceSearchDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onPlaceSelect: vi.fn(),
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('ダイアログが開いたとき検索ボックスが表示される', () => {
    render(<PlaceSearchDialog {...defaultProps} />)

    expect(screen.getByPlaceholderText('場所を検索')).toBeInTheDocument()
  })

  it('ダイアログが閉じているとき何も表示されない', () => {
    render(<PlaceSearchDialog {...defaultProps} open={false} />)

    expect(screen.queryByPlaceholderText('場所を検索')).not.toBeInTheDocument()
  })

  it('検索入力後にサジェストが表示される', async () => {
    mockSuggest.mockResolvedValue({
      suggestions: [
        createSuggestion('id-1', '東京タワー', '東京都港区芝公園4丁目', 'address'),
        createSuggestion('id-2', '東京駅', '東京都千代田区丸の内1丁目', 'poi'),
      ],
    })
    mockForward.mockResolvedValue({ features: [] })

    render(<PlaceSearchDialog {...defaultProps} />)

    const input = screen.getByPlaceholderText('場所を検索')
    await userEvent.setup().type(input, '東京')

    await waitFor(() => {
      expect(screen.getByText('東京タワー')).toBeInTheDocument()
      expect(screen.getByText('東京駅')).toBeInTheDocument()
    })
  })

  it('候補を選択するとonPlaceSelectが座標とズームレベルで呼ばれる', async () => {
    mockSuggest.mockResolvedValue({
      suggestions: [
        createSuggestion('id-1', '東京タワー', '東京都港区芝公園4丁目', 'poi'),
      ],
    })
    mockForward.mockResolvedValue({ features: [] })
    mockRetrieve.mockResolvedValue(
      createRetrieveResponse([139.745433, 35.658581], 'poi'),
    )

    render(<PlaceSearchDialog {...defaultProps} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('場所を検索'), '東京タワー')

    await waitFor(() => {
      expect(screen.getByText('東京タワー')).toBeInTheDocument()
    })

    await user.click(screen.getByText('東京タワー'))

    await waitFor(() => {
      expect(defaultProps.onPlaceSelect).toHaveBeenCalledWith(
        139.745433,
        35.658581,
        16
      )
    })
  })

  it('候補を選択するとダイアログが閉じる', async () => {
    mockSuggest.mockResolvedValue({
      suggestions: [
        createSuggestion('id-1', '東京タワー', '東京都港区', 'poi'),
      ],
    })
    mockForward.mockResolvedValue({ features: [] })
    mockRetrieve.mockResolvedValue(
      createRetrieveResponse([139.745433, 35.658581], 'poi'),
    )

    render(<PlaceSearchDialog {...defaultProps} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('場所を検索'), '東京タワー')

    await waitFor(() => {
      expect(screen.getByText('東京タワー')).toBeInTheDocument()
    })

    await user.click(screen.getByText('東京タワー'))

    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('ダイアログが開いたとき半透明オーバーレイが表示される', () => {
    const { container } = render(<PlaceSearchDialog {...defaultProps} />)

    const overlay = container.querySelector('[data-testid="search-overlay"]')
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveClass('bg-black/50')
  })

  it('検索ボックスが自動フォーカスされない', () => {
    render(<PlaceSearchDialog {...defaultProps} />)

    const input = screen.getByPlaceholderText('場所を検索')
    expect(input).not.toHaveFocus()
  })

  it('閉じるボタンが表示されない', () => {
    render(<PlaceSearchDialog {...defaultProps} />)

    expect(screen.queryByLabelText('閉じる')).not.toBeInTheDocument()
  })

  it('検索ボックスが不透明な白色背景を持つ', () => {
    render(<PlaceSearchDialog {...defaultProps} />)

    const input = screen.getByPlaceholderText('場所を検索')
    expect(input).toHaveStyle({ backgroundColor: '#ffffff' })
  })

  it('検索ボックスのフォントサイズが16pxでモバイルズームを防止する', () => {
    render(<PlaceSearchDialog {...defaultProps} />)

    const input = screen.getByPlaceholderText('場所を検索')
    expect(input).toHaveStyle({ fontSize: '16px' })
  })

  // --- 新規テスト: API併用（Red段階） ---

  it('SearchBoxCoreとGeocodingCoreの両方の結果がマージされて表示される', async () => {
    mockSuggest.mockResolvedValue({
      suggestions: [
        createSuggestion('poi-1', '渋谷駅', '東京都渋谷区道玄坂', 'poi'),
      ],
    })
    mockForward.mockResolvedValue({
      features: [
        createGeocodingFeature('geo-1', '渋谷区', '東京都, 日本', [139.6989, 35.6580], 'district'),
      ],
    })

    render(<PlaceSearchDialog {...defaultProps} />)

    const input = screen.getByPlaceholderText('場所を検索')
    await userEvent.setup().type(input, '渋谷')

    await waitFor(() => {
      expect(screen.getByText('渋谷駅')).toBeInTheDocument()
      expect(screen.getByText('渋谷区')).toBeInTheDocument()
    })
  })

  it('GeocodingCore由来の結果を選択するとretrieveなしで座標が取得される', async () => {
    mockSuggest.mockResolvedValue({ suggestions: [] })
    mockForward.mockResolvedValue({
      features: [
        createGeocodingFeature('geo-1', '渋谷区', '東京都, 日本', [139.6989, 35.6580], 'district'),
      ],
    })

    render(<PlaceSearchDialog {...defaultProps} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('場所を検索'), '渋谷')

    await waitFor(() => {
      expect(screen.getByText('渋谷区')).toBeInTheDocument()
    })

    await user.click(screen.getByText('渋谷区'))

    await waitFor(() => {
      expect(defaultProps.onPlaceSelect).toHaveBeenCalledWith(139.6989, 35.6580, 12)
      expect(mockRetrieve).not.toHaveBeenCalled()
    })
  })

  it('検索APIにcountryパラメータが含まれない（グローバル検索）', async () => {
    mockSuggest.mockResolvedValue({ suggestions: [] })
    mockForward.mockResolvedValue({ features: [] })

    render(<PlaceSearchDialog {...defaultProps} />)

    const input = screen.getByPlaceholderText('場所を検索')
    await userEvent.setup().type(input, 'Paris')

    await waitFor(() => {
      expect(mockSuggest).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ country: expect.anything() })
      )
      expect(mockForward).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ country: expect.anything() })
      )
    })
  })

  describe('アクセシビリティ', () => {
    it('オーバーレイがEnterキーで閉じられる', async () => {
      const mockOnClose = vi.fn()
      render(
        <PlaceSearchDialog
          open={true}
          onClose={mockOnClose}
          onPlaceSelect={() => {}}
          mapboxToken="test-token"
        />
      )

      const overlay = screen.getByTestId('search-overlay')
      overlay.focus()
      await userEvent.keyboard('{Enter}')

      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})
