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
 * - 写真・表示名・場所名・撮影日時が表示される
 * - マップ上に現在地点と指摘地点の2つのピンが表示される
 * - 「受け入れる」「拒否する」ボタンが表示される
 * - 未ログイン時にログイン案内が表示される
 * - 受け入れ/拒否後に結果メッセージと「閉じる」ボタンが表示される
 */

// react-map-glのモック
// Issue#145: language と initialViewState.bounds を data 属性で公開し、
// 言語切替・自動フィットの assert を可能にする。
vi.mock('react-map-gl', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MapMock = ({ children, language, initialViewState }: any) => (
    <div
      data-testid="mapbox-map"
      data-language={language}
      data-bounds={initialViewState && initialViewState.bounds ? JSON.stringify(initialViewState.bounds) : undefined}
    >
      {children}
    </div>
  )
  return {
    default: MapMock,
    Map: MapMock,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Marker: ({ children }: any) => <div data-testid="map-marker">{children}</div>,
  }
})

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
  User: () => <span data-testid="icon-user" />,
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
  profileImageUrl: 'https://cdn/profiles/1/avatar.webp',
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

  // #11+#12: 受け入れ/拒否完了ダイアログのスタイル統一
  describe('受け入れ/拒否完了ダイアログのスタイル統一 (shadcn DialogContent + Button)', () => {
    it('受け入れダイアログは shadcn Dialog (role="dialog") で実装され、既定幅 sm:max-w-[552px] を持つ', async () => {
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
      await user.click(await screen.findByRole('button', { name: '受け入れる' }))
      // shadcn Dialog は role="dialog" を持つ
      const dialog = await screen.findByRole('dialog')
      expect(dialog).toBeInTheDocument()
      // 他ダイアログと同じ 552px 既定幅 (sm: ブレイクポイント)
      expect(dialog.className).toMatch(/sm:max-w-/)
    })

    it('受け入れダイアログの「閉じる」ボタンは shadcn Button (rounded-md) を採用する', async () => {
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
      await user.click(await screen.findByRole('button', { name: '受け入れる' }))
      const closeBtn = await screen.findByRole('button', { name: '閉じる' })
      // shadcn Button の基本クラス
      expect(closeBtn.className).toContain('rounded-md')
      // 旧スタイルの rounded-full は削除されている
      expect(closeBtn.className).not.toContain('rounded-full')
    })

    it('拒否ダイアログも同様に shadcn Dialog + rounded-md ボタンを採用する', async () => {
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
      await user.click(await screen.findByRole('button', { name: '拒否する' }))
      const dialog = await screen.findByRole('dialog')
      expect(dialog.className).toMatch(/sm:max-w-/)
      const closeBtn = await screen.findByRole('button', { name: '閉じる' })
      expect(closeBtn.className).toContain('rounded-md')
      expect(closeBtn.className).not.toContain('rounded-full')
    })
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

    // #9: 未ログイン画面をダイアログ化
    describe('#9 ダイアログ化・タイトル・閉じ手段', () => {
      it('未ログイン時の画面が shadcn Dialog (role="dialog") で表示される', () => {
        renderWithToken('valid-token')
        const dialog = screen.getByRole('dialog')
        expect(dialog).toBeInTheDocument()
        expect(dialog.className).toMatch(/sm:max-w-/)
      })

      it('ダイアログタイトルに「撮影場所指摘の確認」が表示される', () => {
        renderWithToken('valid-token')
        expect(screen.getByText('撮影場所指摘の確認')).toBeInTheDocument()
      })

      it('案内文言が「確認するにはログインしてください。」に統一されている', () => {
        renderWithToken('valid-token')
        expect(screen.getByText('確認するにはログインしてください。')).toBeInTheDocument()
        // 旧文言が消えていること
        expect(screen.queryByText('レビューを行うにはログインしてください。')).not.toBeInTheDocument()
      })

      it('ログインボタンが shadcn Button (rounded-md・rounded-full は無し) で表示される', () => {
        renderWithToken('valid-token')
        const btn = screen.getByRole('button', { name: 'ログイン' })
        expect(btn.className).toContain('rounded-md')
        expect(btn.className).not.toContain('rounded-full')
      })

      it('閉じる手段がない: 右上 X ボタンが存在しない', () => {
        renderWithToken('valid-token')
        // shadcn Dialog の組込み close は accessible name "Close" を持つ。
        // hideCloseButton 有効化でこの要素自体が存在しないことを期待。
        expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
      })
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

  // ============================================================
  // Issue#145: 確認画面 UI 改修
  // ============================================================
  describe('Issue#145 - 確認画面 UI 改修', () => {
    const loadReview = async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => mockReviewData })
      renderWithToken('valid-token')
      await screen.findByTestId('review-photo')
    }

    it('メイン確認画面が shadcn Dialog (role="dialog") で表示され、既定幅 sm:max-w- を持つ', async () => {
      await loadReview()
      const dialog = await screen.findByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog.className).toMatch(/sm:max-w-/)
    })

    it('メイン確認画面に閉じる手段 (Close ボタン) が無い', async () => {
      await loadReview()
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    })

    it('写真はクロップ済みサムネ (thumbnailUrl) を src に使い、正方形・object-cover で表示する', async () => {
      await loadReview()
      const photo = screen.getByTestId('review-photo')
      expect(photo).toHaveAttribute('src', mockReviewData.thumbnailUrl)
      expect(photo.className).toContain('object-cover')
      expect(photo.closest('.aspect-square')).not.toBeNull()
    })

    it('ユーザー名の左に投稿者アイコンを表示し、クリック不可（button/a で包まない）', async () => {
      await loadReview()
      const avatar = screen.getByTestId('review-avatar')
      expect(avatar).toHaveAttribute('src', mockReviewData.profileImageUrl)
      expect(avatar.className).toContain('rounded-full')
      expect(avatar.closest('button')).toBeNull()
      expect(avatar.closest('a')).toBeNull()
    })

    it('プロフィール画像が無い場合はプレースホルダ（User アイコン）を表示する', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...mockReviewData, profileImageUrl: null }) })
      renderWithToken('valid-token')
      await screen.findByTestId('review-photo')
      expect(screen.queryByTestId('review-avatar')).not.toBeInTheDocument()
      expect(screen.getByTestId('review-avatar-placeholder')).toBeInTheDocument()
    })

    it('ミニマップに language が渡される（地名ラベルの言語切替）', async () => {
      await loadReview()
      const map = await screen.findByTestId('mapbox-map')
      expect(map).toHaveAttribute('data-language')
      expect(map.getAttribute('data-language')).toBeTruthy()
    })

    it('ミニマップに自動フィット用の bounds が渡される（両ピンが収まる）', async () => {
      await loadReview()
      const map = await screen.findByTestId('mapbox-map')
      expect(map).toHaveAttribute('data-bounds')
      const bounds = JSON.parse(map.getAttribute('data-bounds') as string)
      expect(Array.isArray(bounds)).toBe(true)
      expect(bounds).toHaveLength(2)
    })

    it('元位置は白黒ピン・指摘位置は赤ピンで描画し、青ピンは使わない', async () => {
      await loadReview()
      const map = await screen.findByTestId('mapbox-map')
      // 白黒ピン（元位置）
      expect(map.querySelector('path[fill="#ffffff"]')).not.toBeNull()
      // 赤ピン（指摘位置）
      expect(map.querySelector('path[fill="#EF4444"]')).not.toBeNull()
      // 旧・青ピンは廃止
      expect(map.querySelector('path[fill="#3B82F6"]')).toBeNull()
    })

    it('アクションボタンは共通 Button (rounded-md) で、右が受け入れ・左が拒否', async () => {
      await loadReview()
      const accept = screen.getByRole('button', { name: '受け入れる' })
      const reject = screen.getByRole('button', { name: '拒否する' })
      expect(accept.className).toContain('rounded-md')
      expect(accept.className).not.toContain('rounded-full')
      expect(reject.className).toContain('rounded-md')
      expect(reject.className).not.toContain('rounded-full')
      // 受け入れ＝primary 配色
      expect(accept.className).toContain('bg-primary')
      // DOM 順で reject(左) が accept(右) より前に来る
      // eslint-disable-next-line no-bitwise
      expect(reject.compareDocumentPosition(accept) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })
})
