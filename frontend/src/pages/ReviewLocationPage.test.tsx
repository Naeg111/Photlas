import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ReviewLocationPage from './ReviewLocationPage'

/**
 * Issue#65: ReviewLocationPage のテスト
 *
 * 要件:
 * - トークンなしでアクセスするとエラー表示
 * - マップ上に現在地点と指摘地点の2つのピンが表示される
 * - 「受け入れる」「拒否する」ボタンが表示される
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

// AuthContextのモック
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'owner@example.com' },
    getAuthToken: () => 'mock-token',
  }),
}))

// APIモック
const mockFetch = vi.fn()

const renderWithToken = (token?: string) => {
  const initialEntries = token
    ? [`/review-location?token=${token}`]
    : ['/review-location']

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ReviewLocationPage />
    </MemoryRouter>
  )
}

describe('ReviewLocationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
  })

  it('should show error message when no token is provided', () => {
    renderWithToken()

    expect(screen.getByText('無効なリンクです')).toBeInTheDocument()
  })

  it('should show accept and reject buttons when review data is loaded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestionId: 1,
        currentLatitude: 35.658581,
        currentLongitude: 139.745433,
        suggestedLatitude: 35.681236,
        suggestedLongitude: 139.767125,
        photoTitle: 'テスト写真',
      }),
    })

    renderWithToken('valid-token')

    expect(await screen.findByRole('button', { name: '受け入れる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '拒否する' })).toBeInTheDocument()
  })

  it('should display a map with the review data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestionId: 1,
        currentLatitude: 35.658581,
        currentLongitude: 139.745433,
        suggestedLatitude: 35.681236,
        suggestedLongitude: 139.767125,
        photoTitle: 'テスト写真',
      }),
    })

    renderWithToken('valid-token')

    expect(await screen.findByTestId('mapbox-map')).toBeInTheDocument()
  })
})
