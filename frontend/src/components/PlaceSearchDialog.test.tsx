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

describe('PlaceSearchDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onPlaceSelect: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
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
        { name: '東京タワー', full_address: '東京都港区芝公園4丁目', mapbox_id: 'id-1' },
        { name: '東京駅', full_address: '東京都千代田区丸の内1丁目', mapbox_id: 'id-2' },
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
        { name: '東京タワー', full_address: '東京都港区芝公園4丁目', mapbox_id: 'id-1', feature_type: 'poi' },
      ],
    })
    mockRetrieve.mockResolvedValue({
      features: [{
        geometry: { coordinates: [139.745433, 35.658581] },
        properties: { feature_type: 'poi' },
      }],
    })

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
        expect.any(Number)
      )
    })
  })

  it('候補を選択するとダイアログが閉じる', async () => {
    mockSuggest.mockResolvedValue({
      suggestions: [
        { name: '東京タワー', full_address: '東京都港区', mapbox_id: 'id-1' },
      ],
    })
    mockRetrieve.mockResolvedValue({
      features: [{
        geometry: { coordinates: [139.745433, 35.658581] },
        properties: { feature_type: 'poi' },
      }],
    })

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
})
