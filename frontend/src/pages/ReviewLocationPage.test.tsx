import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ReviewLocationPage from './ReviewLocationPage'

/**
 * Issue#65: ReviewLocationPage のテスト
 *
 * 要件:
 * - トークンなしでアクセスするとエラー表示
 * - マップ上に現在地点と指摘地点の2つのピンが表示される
 * - 「受け入れる」「拒否する」ボタンが表示される
 * - 未ログイン時にログイン案内が表示される
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

// Mapbox設定のモック
vi.mock('../config/mapbox', () => ({
  MAPBOX_ACCESS_TOKEN: 'test-token',
  MAPBOX_STYLE: 'mapbox://styles/test',
}))

// API設定のモック
vi.mock('../config/api', () => ({
  API_V1_URL: 'http://localhost:3000/api/v1',
}))

// AuthContextのモック（動的）
const mockUseAuth = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// LoginDialogのモック
vi.mock('../components/LoginDialog', () => ({
  LoginDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="login-dialog">ログインダイアログ</div> : null,
}))

// APIモック
const mockFetch = vi.fn()

const renderWithToken = (token?: string) => {
  const initialEntries = token
    ? [`/review-location?token=${token}`]
    : ['/review-location']

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/review-location" element={<ReviewLocationPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ReviewLocationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    global.fetch = mockFetch
    // デフォルトはログイン済み状態
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'owner@example.com' },
      isAuthenticated: true,
      getAuthToken: () => 'mock-token',
    })
  })

  it('should show error message when no token is provided', () => {
    renderWithToken()

    expect(screen.getByText('無効なリンクです')).toBeInTheDocument()
  })

  it('should show accept and reject buttons when review data is loaded', async () => {
    mockFetch.mockResolvedValue({
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
    mockFetch.mockResolvedValue({
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

  // ============================================================
  // Issue#65: 未ログイン時のログイン案内テスト
  // ============================================================
  describe('未ログイン時のログイン案内', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        getAuthToken: () => null,
      })
    })

    it('未ログイン時に「ログインが必要です」メッセージが表示される', () => {
      renderWithToken('valid-token')

      expect(screen.getByText('ログインが必要です')).toBeInTheDocument()
    })

    it('未ログイン時にログインボタンが表示される', () => {
      renderWithToken('valid-token')

      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    })

    it('ログインボタンクリックでLoginDialogが開く', async () => {
      renderWithToken('valid-token')

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'ログイン' }))

      expect(screen.getByTestId('login-dialog')).toBeInTheDocument()
    })

    it('未ログイン時にAPIリクエストを送信しない', () => {
      renderWithToken('valid-token')

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
