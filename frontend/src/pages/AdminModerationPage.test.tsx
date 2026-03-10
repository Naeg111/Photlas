import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import AdminModerationPage from './AdminModerationPage'

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

// fetch APIのモック
const mockFetch = vi.fn()

const MOCK_QUEUE_ITEMS = [
  {
    photo_id: 1,
    title: 'テスト写真1',
    image_url: 'https://example.com/photo1.jpg',
    user_id: 10,
    username: 'testuser1',
    created_at: '2026-03-10T12:00:00',
  },
  {
    photo_id: 2,
    title: 'テスト写真2',
    image_url: 'https://example.com/photo2.jpg',
    user_id: 20,
    username: 'testuser2',
    created_at: '2026-03-10T13:00:00',
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
      user: { userId: 1, role: 'ADMIN' },
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
      expect(screen.getByText('テスト写真1')).toBeInTheDocument()
    })

    expect(screen.getByText('テスト写真2')).toBeInTheDocument()
    expect(screen.getByText('2件の審査待ち')).toBeInTheDocument()
  })

  it('審査待ちの写真がない場合はメッセージが表示される', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: 'ADMIN' },
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

  it('承認ボタンをクリックすると写真が承認される', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: 'ADMIN' },
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
      expect(screen.queryByText('テスト写真1')).not.toBeInTheDocument()
    })

    expect(screen.getByText('テスト写真2')).toBeInTheDocument()
  })

  it('拒否ボタンをクリックすると写真が拒否される', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 1, role: 'ADMIN' },
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
      expect(screen.queryByText('テスト写真2')).not.toBeInTheDocument()
    })

    expect(screen.getByText('テスト写真1')).toBeInTheDocument()
  })
})
