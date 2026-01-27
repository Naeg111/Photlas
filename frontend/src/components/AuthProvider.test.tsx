import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../contexts/AuthContext'

/**
 * Issue#5: ログイン・ログアウト機能 - 認証コンテキスト テスト
 * Issue#36: ユーザー情報更新機能追加
 * TDD Red段階: 実装前のテストケース定義
 *
 * 機能要件:
 * - ユーザーのログイン状態管理
 * - JWT トークンの保管・削除
 * - ログアウト機能
 * - ログイン状態の永続化
 * - ユーザー情報の部分更新 (Issue#36)
 */

// テスト用のコンポーネント
const TestComponent = () => {
  const { user, isAuthenticated, login, logout, updateUser } = useAuth()

  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      {user && (
        <div data-testid="user-info">
          <span data-testid="username">{user.username}</span>
          <span data-testid="email">{user.email}</span>
          <span data-testid="role">{user.role}</span>
        </div>
      )}
      <button
        onClick={() => login({
          username: 'testuser',
          email: 'test@example.com',
          role: 'USER'
        }, 'mock-jwt-token', false)}
        data-testid="login-button"
      >
        Login
      </button>
      <button
        onClick={() => login({
          username: 'testuser',
          email: 'test@example.com',
          role: 'USER'
        }, 'mock-jwt-token', true)}
        data-testid="login-remember-button"
      >
        Login with Remember
      </button>
      <button onClick={logout} data-testid="logout-button">
        Logout
      </button>
      {/* Issue#36: updateUser テスト用ボタン */}
      <button
        onClick={() => updateUser({ username: 'newusername' })}
        data-testid="update-username-button"
      >
        Update Username
      </button>
    </div>
  )
}

const MockedAuthProvider = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
)

describe('AuthProvider', () => {
  beforeEach(() => {
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
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('starts with unauthenticated state', () => {
      // Red段階: AuthProviderとuseAuthが存在しないため失敗
      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated')
      expect(screen.queryByTestId('user-info')).not.toBeInTheDocument()
    })

    it('restores authentication from localStorage on mount', () => {
      const mockUser = { username: 'testuser', email: 'test@example.com', role: 'USER' }

      vi.mocked(window.localStorage.getItem)
        .mockImplementation((key) => {
          if (key === 'auth_token') return 'stored-jwt-token'
          if (key === 'auth_user') return JSON.stringify(mockUser)
          return null
        })

      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
      expect(screen.getByTestId('username')).toHaveTextContent('testuser')
      expect(screen.getByTestId('email')).toHaveTextContent('test@example.com')
      expect(screen.getByTestId('role')).toHaveTextContent('USER')
    })

    it('restores authentication from sessionStorage on mount', () => {
      const mockUser = { username: 'testuser', email: 'test@example.com', role: 'USER' }

      vi.mocked(window.sessionStorage.getItem)
        .mockImplementation((key) => {
          if (key === 'auth_token') return 'stored-jwt-token'
          if (key === 'auth_user') return JSON.stringify(mockUser)
          return null
        })

      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
      expect(screen.getByTestId('username')).toHaveTextContent('testuser')
    })
  })

  describe('Login Functionality', () => {
    it('updates state after successful login', async () => {
      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      const loginButton = screen.getByTestId('login-button')
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
        expect(screen.getByTestId('username')).toHaveTextContent('testuser')
        expect(screen.getByTestId('email')).toHaveTextContent('test@example.com')
        expect(screen.getByTestId('role')).toHaveTextContent('USER')
      })
    })

    it('stores token in sessionStorage when remember is false', async () => {
      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      const loginButton = screen.getByTestId('login-button')
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(window.sessionStorage.setItem).toHaveBeenCalledWith('auth_token', 'mock-jwt-token')
        expect(window.sessionStorage.setItem).toHaveBeenCalledWith('auth_user', JSON.stringify({
          username: 'testuser',
          email: 'test@example.com',
          role: 'USER'
        }))
      })
    })

    it('stores token in localStorage when remember is true', async () => {
      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      const loginRememberButton = screen.getByTestId('login-remember-button')
      fireEvent.click(loginRememberButton)

      await waitFor(() => {
        expect(window.localStorage.setItem).toHaveBeenCalledWith('auth_token', 'mock-jwt-token')
        expect(window.localStorage.setItem).toHaveBeenCalledWith('auth_user', JSON.stringify({
          username: 'testuser',
          email: 'test@example.com',
          role: 'USER'
        }))
      })
    })
  })

  describe('Logout Functionality', () => {
    it('clears authentication state on logout', async () => {
      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      // まずログイン
      const loginButton = screen.getByTestId('login-button')
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
      })

      // ログアウト
      const logoutButton = screen.getByTestId('logout-button')
      fireEvent.click(logoutButton)

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated')
        expect(screen.queryByTestId('user-info')).not.toBeInTheDocument()
      })
    })

    it('removes tokens from localStorage on logout', async () => {
      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      // ログイン（remember = true）
      const loginRememberButton = screen.getByTestId('login-remember-button')
      fireEvent.click(loginRememberButton)

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
      })

      // ログアウト
      const logoutButton = screen.getByTestId('logout-button')
      fireEvent.click(logoutButton)

      await waitFor(() => {
        expect(window.localStorage.removeItem).toHaveBeenCalledWith('auth_token')
        expect(window.localStorage.removeItem).toHaveBeenCalledWith('auth_user')
      })
    })

    it('removes tokens from sessionStorage on logout', async () => {
      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      // ログイン（remember = false）
      const loginButton = screen.getByTestId('login-button')
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
      })

      // ログアウト
      const logoutButton = screen.getByTestId('logout-button')
      fireEvent.click(logoutButton)

      await waitFor(() => {
        expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('auth_token')
        expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('auth_user')
      })
    })
  })

  describe('Token Management', () => {
    it('provides getAuthToken method', () => {
      // 実装時にgetAuthTokenメソッドのテストを追加
      expect(true).toBe(true) // プレースホルダー
    })

    it('handles malformed JSON in storage gracefully', () => {
      vi.mocked(window.localStorage.getItem)
        .mockImplementation((key) => {
          if (key === 'auth_token') return 'valid-token'
          if (key === 'auth_user') return 'invalid-json'
          return null
        })

      expect(() => {
        render(
          <MockedAuthProvider>
            <TestComponent />
          </MockedAuthProvider>
        )
      }).not.toThrow()

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated')
    })
  })

  // Issue#36: ユーザー情報更新機能テスト
  describe('User Update Functionality (Issue#36)', () => {
    it('updates username while keeping other user info', async () => {
      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      // まずログイン
      const loginButton = screen.getByTestId('login-button')
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByTestId('username')).toHaveTextContent('testuser')
      })

      // ユーザー名を更新
      const updateButton = screen.getByTestId('update-username-button')
      fireEvent.click(updateButton)

      await waitFor(() => {
        expect(screen.getByTestId('username')).toHaveTextContent('newusername')
        // 他の情報は維持される
        expect(screen.getByTestId('email')).toHaveTextContent('test@example.com')
        expect(screen.getByTestId('role')).toHaveTextContent('USER')
      })
    })

    it('persists updated user info to storage', async () => {
      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      // まずログイン
      const loginButton = screen.getByTestId('login-button')
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
      })

      // ユーザー名を更新
      const updateButton = screen.getByTestId('update-username-button')
      fireEvent.click(updateButton)

      await waitFor(() => {
        expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
          'auth_user',
          expect.stringContaining('newusername')
        )
      })
    })

    it('does nothing when user is not logged in', () => {
      render(
        <MockedAuthProvider>
          <TestComponent />
        </MockedAuthProvider>
      )

      // ログインせずに更新ボタンをクリック
      const updateButton = screen.getByTestId('update-username-button')
      fireEvent.click(updateButton)

      // エラーが発生しないことを確認
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated')
    })
  })
})