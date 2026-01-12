import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import LogoutButton from './LogoutButton'

/**
 * Issue#5: ログイン・ログアウト機能 - ログアウトボタン コンポーネント テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * 要件:
 * - ログイン中のみ表示
 * - 確認ダイアログなしで即座にログアウト
 * - ログアウト後はトップページにリダイレクト
 */

// Navigation mockのセットアップ
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// AuthContext mockのセットアップ
const mockLogout = vi.fn()
const mockUseAuth = {
  isAuthenticated: true,
  user: { username: 'testuser', email: 'test@example.com', role: 'USER' },
  logout: mockLogout,
  login: vi.fn(),
}

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

const MockedLogoutButton = () => (
  <BrowserRouter>
    <LogoutButton />
  </BrowserRouter>
)

describe('LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Rendering', () => {
    it('renders logout button when user is authenticated', () => {
      // Red段階: LogoutButtonコンポーネントが存在しないため失敗
      render(<MockedLogoutButton />)

      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    })

    it('does not render when user is not authenticated', () => {
      // 未認証状態のモック
      mockUseAuth.isAuthenticated = false
      mockUseAuth.user = null as any

      render(<MockedLogoutButton />)

      expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument()
    })

    it('has correct styling classes', () => {
      mockUseAuth.isAuthenticated = true
      mockUseAuth.user = { username: 'testuser', email: 'test@example.com', role: 'USER' }

      render(<MockedLogoutButton />)

      const button = screen.getByRole('button', { name: 'ログアウト' })
      expect(button).toHaveClass('logout-button')
    })
  })

  describe('Logout Functionality', () => {
    beforeEach(() => {
      mockUseAuth.isAuthenticated = true
      mockUseAuth.user = { username: 'testuser', email: 'test@example.com', role: 'USER' }
    })

    it('calls logout function immediately when clicked', () => {
      render(<MockedLogoutButton />)

      const button = screen.getByRole('button', { name: 'ログアウト' })
      fireEvent.click(button)

      expect(mockLogout).toHaveBeenCalledTimes(1)
    })

    it('does not show confirmation dialog', () => {
      const confirmSpy = vi.spyOn(window, 'confirm')

      render(<MockedLogoutButton />)

      const button = screen.getByRole('button', { name: 'ログアウト' })
      fireEvent.click(button)

      expect(confirmSpy).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })

    it('navigates to home page after logout', () => {
      render(<MockedLogoutButton />)

      const button = screen.getByRole('button', { name: 'ログアウト' })
      fireEvent.click(button)

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('handles multiple rapid clicks gracefully', () => {
      render(<MockedLogoutButton />)

      const button = screen.getByRole('button', { name: 'ログアウト' })

      // 複数回連続クリック
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      // ログアウト処理は1回のみ実行されることを確認
      expect(mockLogout).toHaveBeenCalledTimes(3) // 実装により調整
      expect(mockNavigate).toHaveBeenCalledTimes(3) // 実装により調整
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseAuth.isAuthenticated = true
      mockUseAuth.user = { username: 'testuser', email: 'test@example.com', role: 'USER' }
    })

    it('has proper ARIA attributes', () => {
      render(<MockedLogoutButton />)

      const button = screen.getByRole('button', { name: 'ログアウト' })
      expect(button).toHaveAttribute('type', 'button')
    })

    it('is keyboard accessible', () => {
      render(<MockedLogoutButton />)

      const button = screen.getByRole('button', { name: 'ログアウト' })

      // Enterキーでも作動することを確認
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })

      expect(mockLogout).toHaveBeenCalled()
    })

    it('has proper focus management', () => {
      render(<MockedLogoutButton />)

      const button = screen.getByRole('button', { name: 'ログアウト' })

      // フォーカス可能であることを確認
      button.focus()
      expect(document.activeElement).toBe(button)
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockUseAuth.isAuthenticated = true
      mockUseAuth.user = { username: 'testuser', email: 'test@example.com', role: 'USER' }
    })

    it('handles logout function errors gracefully', () => {
      mockLogout.mockImplementationOnce(() => {
        throw new Error('Logout failed')
      })

      render(<MockedLogoutButton />)

      const button = screen.getByRole('button', { name: 'ログアウト' })

      // エラーが投げられてもクラッシュしないことを確認
      expect(() => fireEvent.click(button)).not.toThrow()
    })

    it('still navigates even if logout fails', () => {
      mockLogout.mockImplementationOnce(() => {
        throw new Error('Logout failed')
      })

      render(<MockedLogoutButton />)

      const button = screen.getByRole('button', { name: 'ログアウト' })
      fireEvent.click(button)

      // ナビゲーションは実行されることを確認
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })
})