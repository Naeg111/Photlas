import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginDialog } from './LoginDialog'

/**
 * LoginDialog コンポーネントのテスト
 * Issue#26: 認証機能のモーダルベース移行
 */

// AuthContextのモック
const mockLogin = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: false,
  }),
}))

// sonner (toast) のモック
vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

// fetch APIのモック
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('LoginDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onShowSignUp: vi.fn(),
    onShowPasswordReset: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements - UI要素', () => {
    it('renders dialog when open prop is true', () => {
      render(<LoginDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('ログイン')).toBeInTheDocument()
    })

    it('does not render dialog when open prop is false', () => {
      render(<LoginDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders email input field', () => {
      render(<LoginDialog {...defaultProps} />)

      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('example@photlas.com')).toBeInTheDocument()
    })

    it('renders password input field with toggle button', () => {
      render(<LoginDialog {...defaultProps} />)

      expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('パスワードを入力')).toBeInTheDocument()
      // パスワード表示/非表示ボタン
      expect(screen.getByRole('button', { name: /パスワードを表示|パスワードを非表示/ })).toBeInTheDocument()
    })

    it('renders remember me checkbox', () => {
      render(<LoginDialog {...defaultProps} />)

      expect(screen.getByLabelText('ログイン状態を保持する')).toBeInTheDocument()
    })

    it('renders login button', () => {
      render(<LoginDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    })

    it('renders forgot password link', () => {
      render(<LoginDialog {...defaultProps} />)

      expect(screen.getByText('パスワードをお忘れですか？')).toBeInTheDocument()
    })

    it('renders sign up link', () => {
      render(<LoginDialog {...defaultProps} />)

      expect(screen.getByText('新規登録')).toBeInTheDocument()
    })
  })

  describe('Password Toggle - パスワード表示切替', () => {
    it('toggles password visibility when eye button is clicked', async () => {
      const user = userEvent.setup()
      render(<LoginDialog {...defaultProps} />)

      const passwordInput = screen.getByLabelText('パスワード')
      expect(passwordInput).toHaveAttribute('type', 'password')

      const toggleButton = screen.getByRole('button', { name: /パスワードを表示/ })
      await user.click(toggleButton)

      expect(passwordInput).toHaveAttribute('type', 'text')
    })
  })

  describe('Validation - バリデーション', () => {
    it('shows error when submitting with empty fields', async () => {
      const user = userEvent.setup()
      render(<LoginDialog {...defaultProps} />)

      const loginButton = screen.getByRole('button', { name: 'ログイン' })
      await user.click(loginButton)

      expect(screen.getByText('メールアドレスとパスワードを入力してください')).toBeInTheDocument()
    })

    it('shows error when only email is entered', async () => {
      const user = userEvent.setup()
      render(<LoginDialog {...defaultProps} />)

      await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
      await user.click(screen.getByRole('button', { name: 'ログイン' }))

      expect(screen.getByText('メールアドレスとパスワードを入力してください')).toBeInTheDocument()
    })

    it('shows error when only password is entered', async () => {
      const user = userEvent.setup()
      render(<LoginDialog {...defaultProps} />)

      await user.type(screen.getByLabelText('パスワード'), 'password123')
      await user.click(screen.getByRole('button', { name: 'ログイン' }))

      expect(screen.getByText('メールアドレスとパスワードを入力してください')).toBeInTheDocument()
    })
  })

  describe('API Integration - API連携', () => {
    it('calls login API with email and password on submit', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: 'test@example.com', username: 'testuser', token: 'test-token' }),
      })

      render(<LoginDialog {...defaultProps} />)

      await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
      await user.type(screen.getByLabelText('パスワード'), 'Password123')
      await user.click(screen.getByRole('button', { name: 'ログイン' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/login'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com', password: 'Password123' }),
          })
        )
      })
    })

    it('calls AuthContext login and shows toast on successful login', async () => {
      const { toast } = await import('sonner')
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: 'test@example.com', username: 'testuser', token: 'test-token' }),
      })

      render(<LoginDialog {...defaultProps} />)

      await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
      await user.type(screen.getByLabelText('パスワード'), 'Password123')
      await user.click(screen.getByRole('button', { name: 'ログイン' }))

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          { email: 'test@example.com', username: 'testuser' },
          'test-token',
          false // rememberMe is false by default
        )
        expect(toast).toHaveBeenCalledWith('ログインしました')
        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('passes rememberMe=true when checkbox is checked', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: 'test@example.com', username: 'testuser', token: 'test-token' }),
      })

      render(<LoginDialog {...defaultProps} />)

      await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
      await user.type(screen.getByLabelText('パスワード'), 'Password123')
      await user.click(screen.getByLabelText('ログイン状態を保持する'))
      await user.click(screen.getByRole('button', { name: 'ログイン' }))

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          true // rememberMe is true
        )
      })
    })

    it('shows error message when login fails with 401', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      render(<LoginDialog {...defaultProps} />)

      await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
      await user.type(screen.getByLabelText('パスワード'), 'WrongPassword123')
      await user.click(screen.getByRole('button', { name: 'ログイン' }))

      await waitFor(() => {
        expect(screen.getByText('メールアドレスまたはパスワードが正しくありません')).toBeInTheDocument()
      })
    })

    it('shows error message when network error occurs', async () => {
      const user = userEvent.setup()
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<LoginDialog {...defaultProps} />)

      await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
      await user.type(screen.getByLabelText('パスワード'), 'Password123')
      await user.click(screen.getByRole('button', { name: 'ログイン' }))

      await waitFor(() => {
        expect(screen.getByText('ログインに失敗しました')).toBeInTheDocument()
      })
    })

    it('shows loading state during API call', async () => {
      const user = userEvent.setup()
      let resolvePromise: (value: any) => void
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePromise = resolve
        })
      )

      render(<LoginDialog {...defaultProps} />)

      await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
      await user.type(screen.getByLabelText('パスワード'), 'Password123')
      await user.click(screen.getByRole('button', { name: 'ログイン' }))

      // ローディング中はボタンが無効化される
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeDisabled()

      // API完了
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ token: 'test-token' }),
      })
    })
  })

  describe('Dialog Transitions - ダイアログ遷移', () => {
    it('calls onShowSignUp when sign up link is clicked', async () => {
      const user = userEvent.setup()
      render(<LoginDialog {...defaultProps} />)

      await user.click(screen.getByText('新規登録'))

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
      expect(defaultProps.onShowSignUp).toHaveBeenCalled()
    })

    it('calls onShowPasswordReset when forgot password link is clicked', async () => {
      const user = userEvent.setup()
      render(<LoginDialog {...defaultProps} />)

      await user.click(screen.getByText('パスワードをお忘れですか？'))

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
      expect(defaultProps.onShowPasswordReset).toHaveBeenCalled()
    })
  })
})
