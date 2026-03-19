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
vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(() => ({
    suggest: mockSuggest,
    retrieve: mockRetrieve,
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

  it('市区町村が検索結果に表示される', async () => {
    mockSuggest.mockResolvedValue({
      suggestions: [
        createSuggestion('id-shibuya', '渋谷区', '東京都, 日本', 'district'),
      ],
    })

    render(<PlaceSearchDialog {...defaultProps} />)

    const input = screen.getByPlaceholderText('場所を検索')
    await userEvent.setup().type(input, '渋谷')

    await waitFor(() => {
      expect(screen.getByText('渋谷区')).toBeInTheDocument()
      expect(screen.getByText('東京都, 日本')).toBeInTheDocument()
    })
  })

  it('市区町村の候補を選択するとonPlaceSelectが座標とズームレベルで呼ばれる', async () => {
    mockSuggest.mockResolvedValue({
      suggestions: [
        createSuggestion('id-shibuya', '渋谷区', '東京都, 日本', 'district'),
      ],
    })
    mockRetrieve.mockResolvedValue(
      createRetrieveResponse([139.6989, 35.6580], 'district'),
    )

    render(<PlaceSearchDialog {...defaultProps} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('場所を検索'), '渋谷')

    await waitFor(() => {
      expect(screen.getByText('渋谷区')).toBeInTheDocument()
    })

    await user.click(screen.getByText('渋谷区'))

    await waitFor(() => {
      expect(defaultProps.onPlaceSelect).toHaveBeenCalledWith(
        139.6989,
        35.6580,
        12
      )
    })
  })

  it('閉じるボタンが表示されない', () => {
    render(<PlaceSearchDialog {...defaultProps} />)

    expect(screen.queryByLabelText('閉じる')).not.toBeInTheDocument()
  })

  it('POI検索結果が表示される', async () => {
    mockSuggest.mockResolvedValue({
      suggestions: [
        createSuggestion('poi-1', '渋谷駅', '東京都渋谷区道玄坂', 'poi'),
      ],
    })

    render(<PlaceSearchDialog {...defaultProps} />)

    const input = screen.getByPlaceholderText('場所を検索')
    await userEvent.setup().type(input, '渋谷駅')

    await waitFor(() => {
      expect(screen.getByText('渋谷駅')).toBeInTheDocument()
      expect(screen.getByText('東京都渋谷区道玄坂')).toBeInTheDocument()
    })
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
})
