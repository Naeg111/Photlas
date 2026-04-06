import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import AdminModerationPage from './AdminModerationPage'
import { ROLE_ADMIN, REASON_ADULT_CONTENT, REASON_VIOLENCE } from '../utils/codeConstants'

/**
 * Issue#54: 管理者モデレーションページのテスト
 */

// AuthContextのモック
const mockUseAuth = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// sonner (toast) のモック
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Toasterコンポーネントのモック
vi.mock('../components/ui/sonner', () => ({
  Toaster: () => null,
}))

// Issue#89: PhotoLightboxのモック
vi.mock('../components/PhotoLightbox', () => ({
  PhotoLightbox: ({ open, imageUrl }: { open: boolean; imageUrl: string }) =>
    open ? <div data-testid="photo-lightbox"><img src={imageUrl} alt="フルサイズ写真" /></div> : null,
}))

// fetch APIのモック
const mockFetch = vi.fn()

const MOCK_QUEUE_ITEMS = [
  {
    photo_id: 1,
    image_url: 'https://example.com/photo1.jpg',
    thumbnail_url: 'https://example.com/thumb1.webp',
    user_id: 10,
    username: 'testuser1',
    created_at: '2026-03-10T12:00:00',
    report_count: 2,
    report_reasons: [REASON_ADULT_CONTENT, REASON_VIOLENCE],
  },
  {
    photo_id: 2,
    image_url: 'https://example.com/photo2.jpg',
    thumbnail_url: 'https://example.com/thumb2.webp',
    user_id: 20,
    username: 'testuser2',
    created_at: '2026-03-10T13:00:00',
    report_count: 0,
    report_reasons: [],
  },
]

function renderPage() {
  return render(
    <BrowserRouter>
      <AdminModerationPage />
    </BrowserRouter>
  )
}

describe('AdminModerationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(globalThis, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
  })

  it('非管理者ユーザーにはアクセス権限エラーが表示される', () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: 'USER' },
      isAuthenticated: true,
    })

    renderPage()

    expect(screen.getByText('アクセス権限がありません')).toBeInTheDocument()
  })

  it('未認証ユーザーにはアクセス権限エラーが表示される', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    })

    renderPage()

    expect(screen.getByText('アクセス権限がありません')).toBeInTheDocument()
  })

  it('管理者ユーザーにはモデレーションキューが表示される', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: ROLE_ADMIN },
      isAuthenticated: true,
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: MOCK_QUEUE_ITEMS,
        total_elements: 2,
        total_pages: 1,
      }),
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('moderation-item-1')).toBeInTheDocument()
    })

    expect(screen.getByTestId('moderation-item-2')).toBeInTheDocument()
    expect(screen.getByText('2件の審査待ち')).toBeInTheDocument()
  })

  it('Issue#89 - トグルボタンクリックでぼかしが解除される', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: ROLE_ADMIN },
      isAuthenticated: true,
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: MOCK_QUEUE_ITEMS,
        total_elements: 2,
        total_pages: 1,
      }),
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('moderation-image-1')).toBeInTheDocument()
    })

    const image = screen.getByTestId('moderation-image-1')
    expect(image.className).toContain('blur-lg')

    const user = userEvent.setup()
    await user.click(screen.getByTestId('blur-toggle-1'))

    expect(image.className).not.toContain('blur-lg')
  })

  it('Issue#89 - トグルボタン再クリックでぼかしが再適用される', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: ROLE_ADMIN },
      isAuthenticated: true,
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: MOCK_QUEUE_ITEMS,
        total_elements: 2,
        total_pages: 1,
      }),
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('moderation-image-1')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    // ぼかし解除
    await user.click(screen.getByTestId('blur-toggle-1'))
    expect(screen.getByTestId('moderation-image-1').className).not.toContain('blur-lg')

    // ぼかし再適用
    await user.click(screen.getByTestId('blur-toggle-1'))
    expect(screen.getByTestId('moderation-image-1').className).toContain('blur-lg')
  })

  it('Issue#89 - ぼかし解除済みの画像クリックでライトボックスが表示される', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: ROLE_ADMIN },
      isAuthenticated: true,
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: MOCK_QUEUE_ITEMS,
        total_elements: 2,
        total_pages: 1,
      }),
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('moderation-image-1')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    // ぼかし解除
    await user.click(screen.getByTestId('blur-toggle-1'))

    // 画像クリック → ライトボックス表示
    await user.click(screen.getByTestId('moderation-image-container-1'))
    expect(screen.getByAltText('フルサイズ写真')).toBeInTheDocument()
  })

  it('Issue#89 - ぼかし中の画像クリックではライトボックスが開かない', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: ROLE_ADMIN },
      isAuthenticated: true,
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: MOCK_QUEUE_ITEMS,
        total_elements: 2,
        total_pages: 1,
      }),
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('moderation-image-1')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    // ぼかし中に画像クリック
    await user.click(screen.getByTestId('moderation-image-container-1'))

    // ライトボックスは表示されない
    expect(screen.queryByAltText('フルサイズ写真')).not.toBeInTheDocument()
  })

  it('Issue#89 - 「クリックで表示」オーバーレイが表示されない', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: ROLE_ADMIN },
      isAuthenticated: true,
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: MOCK_QUEUE_ITEMS,
        total_elements: 2,
        total_pages: 1,
      }),
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('moderation-image-1')).toBeInTheDocument()
    })

    expect(screen.queryByText('クリックで表示')).not.toBeInTheDocument()
  })

  it('審査待ちの写真がない場合はメッセージが表示される', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: ROLE_ADMIN },
      isAuthenticated: true,
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [],
        total_elements: 0,
        total_pages: 0,
      }),
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('審査待ちの写真はありません')).toBeInTheDocument()
    })
  })

  it('Issue#54 - 通報件数と通報理由が表示される', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: ROLE_ADMIN },
      isAuthenticated: true,
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: MOCK_QUEUE_ITEMS,
        total_elements: 2,
        total_pages: 1,
      }),
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('moderation-item-1')).toBeInTheDocument()
    })

    // 通報件数が表示される
    expect(screen.getByText('通報 2件')).toBeInTheDocument()

    // 通報理由が表示される
    expect(screen.getByText('成人向けコンテンツ')).toBeInTheDocument()
    expect(screen.getByText('暴力的なコンテンツ')).toBeInTheDocument()
  })

  it('承認ボタンをクリックすると写真が承認される', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: ROLE_ADMIN },
      isAuthenticated: true,
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: MOCK_QUEUE_ITEMS,
          total_elements: 2,
          total_pages: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: '写真を承認しました' }),
      })

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('approve-btn-1')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('approve-btn-1'))

    await waitFor(() => {
      expect(screen.queryByTestId('moderation-item-1')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('moderation-item-2')).toBeInTheDocument()
  })

  it('拒否ボタンをクリックすると写真が拒否される', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: ROLE_ADMIN },
      isAuthenticated: true,
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: MOCK_QUEUE_ITEMS,
          total_elements: 2,
          total_pages: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: '写真を拒否しました' }),
      })

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('reject-btn-2')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('reject-btn-2'))

    await waitFor(() => {
      expect(screen.queryByTestId('moderation-item-2')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('moderation-item-1')).toBeInTheDocument()
  })
})
