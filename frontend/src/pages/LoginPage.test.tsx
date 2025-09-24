import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import LoginPage from './LoginPage'

/**
 * Issue#5: ログイン・ログアウト機能 - ログインページ UI テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - メールアドレス入力欄
 * - パスワード入力欄
 * - 「ログイン状態を保持する」チェックボックス
 * - ログインボタン
 * - 「パスワードをお忘れですか？」リンク
 * - 「アカウントをお持ちでないですか？新規登録はこちら」リンク
 */

const MockedLoginPage = () => (
  <BrowserRouter>
    <LoginPage />
  </BrowserRouter>
)

// fetch APIのモック
global.fetch = vi.fn()

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // localStorage/sessionStorageのモック
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  describe('UI Elements', () => {
    it('renders email input field', () => {
      // Red段階: LoginPageコンポーネントが存在しないため失敗
      render(<MockedLoginPage />)

      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'メールアドレス' })).toHaveAttribute('type', 'email')
    })

    it('renders password input field', () => {
      render(<MockedLoginPage />)

      expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
      expect(screen.getByLabelText('パスワード')).toHaveAttribute('type', 'password')
    })

    it('renders remember me checkbox', () => {
      render(<MockedLoginPage />)

      expect(screen.getByRole('checkbox', { name: 'ログイン状態を保持する' })).toBeInTheDocument()
    })

    it('renders login button', () => {
      render(<MockedLoginPage />)

      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    })

    it('renders forgot password link', () => {
      render(<MockedLoginPage />)

      expect(screen.getByText('パスワードをお忘れですか？')).toBeInTheDocument()
    })

    it('renders signup link', () => {
      render(<MockedLoginPage />)

      expect(screen.getByText('アカウントをお持ちでないですか？')).toBeInTheDocument()
      expect(screen.getByText('新規登録はこちら')).toBeInTheDocument()
    })

    it('has correct page title', () => {
      render(<MockedLoginPage />)

      expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('shows required error for empty email', async () => {
      render(<MockedLoginPage />)

      const loginButton = screen.getByRole('button', { name: 'ログイン' })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText('メールアドレスは必須です')).toBeInTheDocument()
      })
    })

    it('shows required error for empty password', async () => {
      render(<MockedLoginPage />)

      const loginButton = screen.getByRole('button', { name: 'ログイン' })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText('パスワードは必須です')).toBeInTheDocument()
      })
    })

    it('shows invalid email format error', async () => {
      render(<MockedLoginPage />)

      const emailInput = screen.getByLabelText('メールアドレス')
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })

      const loginButton = screen.getByRole('button', { name: 'ログイン' })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText('正しいメールアドレス形式で入力してください')).toBeInTheDocument()
      })
    })
  })

  describe('Login Process', () => {
    it('sends POST request to /api/v1/auth/login on form submission', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { username: 'testuser', email: 'test@example.com', role: 'USER' },
          token: 'mock-jwt-token'
        })
      } as Response)

      render(<MockedLoginPage />)

      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const loginButton = screen.getByRole('button', { name: 'ログイン' })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'Password123'
          })
        })
      })
    })

    it('stores JWT in localStorage when remember me is checked', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { username: 'testuser', email: 'test@example.com', role: 'USER' },
          token: 'mock-jwt-token'
        })
      } as Response)

      render(<MockedLoginPage />)

      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const rememberCheckbox = screen.getByRole('checkbox', { name: 'ログイン状態を保持する' })
      const loginButton = screen.getByRole('button', { name: 'ログイン' })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.click(rememberCheckbox)
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(window.localStorage.setItem).toHaveBeenCalledWith('auth_token', 'mock-jwt-token')
      })
    })

    it('stores JWT in sessionStorage when remember me is not checked', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { username: 'testuser', email: 'test@example.com', role: 'USER' },
          token: 'mock-jwt-token'
        })
      } as Response)

      render(<MockedLoginPage />)

      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const loginButton = screen.getByRole('button', { name: 'ログイン' })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(window.sessionStorage.setItem).toHaveBeenCalledWith('auth_token', 'mock-jwt-token')
      })
    })

    it('shows error message on login failure', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: 'メールアドレスまたはパスワードが正しくありません'
        })
      } as Response)

      render(<MockedLoginPage />)

      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const loginButton = screen.getByRole('button', { name: 'ログイン' })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText('メールアドレスまたはパスワードが正しくありません')).toBeInTheDocument()
      })
    })

    it('disables login button during request', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<MockedLoginPage />)

      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const loginButton = screen.getByRole('button', { name: 'ログイン' })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.click(loginButton)

      expect(loginButton).toBeDisabled()
    })
  })

  describe('Navigation', () => {
    it('links to signup page', () => {
      render(<MockedLoginPage />)

      const signupLink = screen.getByText('新規登録はこちら')
      expect(signupLink).toHaveAttribute('href', '/register')
    })

    it('redirects to previous page after successful login', async () => {
      // モックの実装は実際のルーティング実装時に詳細化
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { username: 'testuser', email: 'test@example.com', role: 'USER' },
          token: 'mock-jwt-token'
        })
      } as Response)

      render(<MockedLoginPage />)

      // テスト内容は実装時に詳細化
      expect(true).toBe(true) // プレースホルダー
    })
  })
})