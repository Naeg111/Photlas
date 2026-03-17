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

// react-map-glのモック
vi.mock('react-map-gl', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mapbox-map">{children}</div>
  ),
  Map: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mapbox-map">{children}</div>
  ),
  Marker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map-marker">{children}</div>
  ),
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

  it('should display a map', () => {
    render(<LocationSuggestionDialog {...defaultProps} />)

    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
  })

  it('should have a submit button', () => {
    render(<LocationSuggestionDialog {...defaultProps} />)

    expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
  })

  it('should not render when open is false', () => {
    render(<LocationSuggestionDialog {...defaultProps} open={false} />)

    expect(screen.queryByText('撮影場所の指摘')).not.toBeInTheDocument()
  })
})
