import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ReviewLocationPage from './ReviewLocationPage'

/**
 * Issue#65, Issue#54: ReviewLocationPage のテスト
 *
 * 要件:
 * - トークンなしでアクセスするとエラー表示
 * - 写真・ユーザー名・場所名・撮影日時が表示される
 * - マップ上に現在地点と指摘地点の2つのピンが表示される
 * - 「受け入れる」「拒否する」ボタンが表示される
 * - 未ログイン時にログイン案内が表示される
 * - 受け入れ/拒否後に結果メッセージと「閉じる」ボタンが表示される
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

// lucide-reactのモック
vi.mock('lucide-react', () => ({
  MapPin: () => <span data-testid="icon-map-pin" />,
  Calendar: () => <span data-testid="icon-calendar" />,
}))

// APIモック
const mockFetch = vi.fn()

const mockReviewData = {
  suggestionId: 1,
  currentLatitude: 35.658581,
  currentLongitude: 139.745433,
  suggestedLatitude: 35.681236,
  suggestedLongitude: 139.767125,
  photoTitle: 'テスト写真',
  imageUrl: 'https://cdn/uploads/1/test.jpg',
  thumbnailUrl: 'https://cdn/thumbnails/uploads/1/test.webp',
  username: 'テストユーザー',
  placeName: '東京タワー',
  shotAt: '2026-03-01T12:00:00',
  cropCenterX: null,
  cropCenterY: null,
  cropZoom: null,
}

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

  it('should show photo, username, place name, and shot date', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockReviewData,
    })

    renderWithToken('valid-token')

    expect(await screen.findByTestId('review-photo')).toBeInTheDocument()
    expect(screen.getByTestId('review-username')).toHaveTextContent('テストユーザー')
    expect(screen.getByTestId('review-place-name')).toHaveTextContent('東京タワー')
    expect(screen.getByTestId('review-shot-at')).toBeInTheDocument()
  })

  it('should show accept and reject buttons when review data is loaded', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockReviewData,
    })

    renderWithToken('valid-token')

    expect(await screen.findByRole('button', { name: '受け入れる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '拒否する' })).toBeInTheDocument()
  })

  it('should display a minimap with the review data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockReviewData,
    })

    renderWithToken('valid-token')

    expect(await screen.findByTestId('review-minimap')).toBeInTheDocument()
  })

  it('should show result message and close button after accepting', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockReviewData })
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

    renderWithToken('valid-token')

    const user = userEvent.setup()
    const acceptButton = await screen.findByRole('button', { name: '受け入れる' })
    await user.click(acceptButton)

    expect(await screen.findByText('撮影場所の指摘を受け入れました。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument()
  })

  it('should show result message and close button after rejecting', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockReviewData })
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

    renderWithToken('valid-token')

    const user = userEvent.setup()
    const rejectButton = await screen.findByRole('button', { name: '拒否する' })
    await user.click(rejectButton)

    expect(await screen.findByText('撮影場所の指摘を拒否しました。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument()
  })

  // ============================================================
  // 未ログイン時のログイン案内テスト
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

  // Issue#96 PR2c: 429 レート制限ハンドリング（パターンA: インラインメッセージ + ボタンcooldown）
  describe('Rate Limit (429) - レート制限', () => {
    it('handleAction で 429 を受信したらインライン rate-limit メッセージが表示される', async () => {
      mockFetch
        // 初回 fetchReviewData（プレーンオブジェクトのまま）
        .mockResolvedValueOnce({ ok: true, json: async () => mockReviewData })
        // handleAction: fetchJson 経由で Response が必要
        .mockResolvedValueOnce(
          new Response('Too many requests', {
            status: 429,
            statusText: 'Too Many Requests',
            headers: { 'Retry-After': '60' },
          })
        )

      renderWithToken('valid-token')

      const user = userEvent.setup()
      const acceptButton = await screen.findByRole('button', { name: '受け入れる' })
      await user.click(acceptButton)

      expect(
        await screen.findByText('リクエストが多すぎます。60 秒後に再度お試しください。')
      ).toBeInTheDocument()
    })

    it('Retry-Afterヘッダ欠落時もデフォルト60秒のメッセージを表示する', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockReviewData })
        .mockResolvedValueOnce(
          new Response('Too many requests', { status: 429 })
        )

      renderWithToken('valid-token')

      const user = userEvent.setup()
      const rejectButton = await screen.findByRole('button', { name: '拒否する' })
      await user.click(rejectButton)

      expect(
        await screen.findByText('リクエストが多すぎます。60 秒後に再度お試しください。')
      ).toBeInTheDocument()
    })
  })
})
