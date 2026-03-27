import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocationSuggestionDialog } from './LocationSuggestionDialog'

/**
 * Issue#65: LocationSuggestionDialog のテスト
 *
 * 要件:
 * - マップ上に現在の撮影地点が表示される
 * - ユーザーが指摘地点を配置できる
 * - 送信ボタンで指摘を送信できる
 */

// InlineMapPickerのモック
vi.mock('./InlineMapPicker', () => ({
  InlineMapPicker: ({ markers, pinColor, onPositionChange }: {
    markers?: Array<{ lat: number; lng: number; color: string }>
    pinColor?: string
    onPositionChange?: (pos: { lat: number; lng: number }) => void
  }) => (
    <div data-testid="inline-map-picker" data-pin-color={pinColor}>
      <input placeholder="場所を検索" />
      {markers?.map((m, i) => (
        <div key={i} data-testid={`additional-marker-${i}`} data-color={m.color} />
      ))}
      <button onClick={() => onPositionChange?.({ lat: 35.0, lng: 139.0 })}>
        simulate-move
      </button>
    </div>
  ),
}))

// @mapbox/search-js-coreのモック
vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(),
  SessionToken: vi.fn(),
}))

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  photoId: 1,
  currentLatitude: 35.658581,
  currentLongitude: 139.745433,
}

describe('LocationSuggestionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render dialog when open is true', () => {
    render(<LocationSuggestionDialog {...defaultProps} />)

    expect(screen.getByText('撮影場所の指摘')).toBeInTheDocument()
  })

  it('should display a map picker', () => {
    render(<LocationSuggestionDialog {...defaultProps} />)

    expect(screen.getByTestId('inline-map-picker')).toBeInTheDocument()
  })

  it('should have a submit button', () => {
    render(<LocationSuggestionDialog {...defaultProps} />)

    expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
  })

  it('should not render when open is false', () => {
    render(<LocationSuggestionDialog {...defaultProps} open={false} />)

    expect(screen.queryByText('撮影場所の指摘')).not.toBeInTheDocument()
  })

  // ============================================================
  // Issue#76: 固定ピン方式への変更
  // ============================================================

  it('Issue#76 - InlineMapPickerが使用されている', () => {
    render(<LocationSuggestionDialog {...defaultProps} />)

    expect(screen.getByTestId('inline-map-picker')).toBeInTheDocument()
  })

  it('Issue#76 - 固定中央ピンが青色で表示される', () => {
    render(<LocationSuggestionDialog {...defaultProps} />)

    const picker = screen.getByTestId('inline-map-picker')
    expect(picker).toHaveAttribute('data-pin-color', '#3B82F6')
  })

  it('Issue#76 - 現在の登録位置が赤色マーカーで表示される', () => {
    render(<LocationSuggestionDialog {...defaultProps} />)

    const marker = screen.getByTestId('additional-marker-0')
    expect(marker).toBeInTheDocument()
    expect(marker).toHaveAttribute('data-color', '#EF4444')
  })

  it('Issue#76 - 場所検索の入力フィールドが表示される', () => {
    render(<LocationSuggestionDialog {...defaultProps} />)

    expect(screen.getByPlaceholderText('場所を検索')).toBeInTheDocument()
  })
})
