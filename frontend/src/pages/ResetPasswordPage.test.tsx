import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import ResetPasswordPage from './ResetPasswordPage'

/**
 * Issue#6: パスワードリセット機能 - パスワード再設定ページ UI テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - URLパラメータからトークンを取得
 * - 新しいパスワード入力欄
 * - 新しいパスワード（確認用）入力欄
 * - 「再設定」ボタン
 * - トークン無効時のエラーメッセージ表示
 * - 成功時のメッセージ表示とログインページへのリダイレクト
 */

// fetch APIのモック
global.fetch = vi.fn()

// useNavigateのモック
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('UI Elements', () => {
    it('renders page title', () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      expect(screen.getByRole('heading', { name: 'パスワード再設定' })).toBeInTheDocument()
    })

    it('renders new password input field', () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
      expect(screen.getByLabelText('新しいパスワード')).toHaveAttribute('type', 'password')
    })

    it('renders confirm password input field', () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      expect(screen.getByLabelText('新しいパスワード（確認用）')).toBeInTheDocument()
      expect(screen.getByLabelText('新しいパスワード（確認用）')).toHaveAttribute('type', 'password')
    })

    it('renders submit button', () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      expect(screen.getByRole('button', { name: '再設定' })).toBeInTheDocument()
    })
  })

  describe('Token Validation', () => {
    it('displays error message when token is missing', () => {
      render(
        <MemoryRouter initialEntries={['/reset-password']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      expect(screen.getByText('このリンクは無効です。再度パスワードリセットをリクエストしてください。')).toBeInTheDocument()
    })

    it('displays error message when token is invalid', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'トークンが無効または期限切れです'
        })
      } as Response)

      render(
        <MemoryRouter initialEntries={['/reset-password?token=invalid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('トークンが無効または期限切れです')).toBeInTheDocument()
      })
    })

    it('hides form inputs when token is missing, shows only error message', () => {
      render(
        <MemoryRouter initialEntries={['/reset-password']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      expect(screen.queryByLabelText('新しいパスワード')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('新しいパスワード（確認用）')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '再設定' })).not.toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('shows required error for empty new password', async () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const submitButton = screen.getByRole('button', { name: '再設定' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('新しいパスワードは必須です')).toBeInTheDocument()
      })
    })

    it('shows required error for empty confirm password', async () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const submitButton = screen.getByRole('button', { name: '再設定' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('確認用パスワードは必須です')).toBeInTheDocument()
      })
    })

    it('shows error when passwords do not match', async () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      fireEvent.change(newPasswordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument()
      })
    })

    it('shows error for password less than 8 characters', async () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      fireEvent.change(newPasswordInput, { target: { value: 'Pass1' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'Pass1' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('パスワードは8文字以上で入力してください')).toBeInTheDocument()
      })
    })

    it('shows error for password without uppercase letter', async () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      fireEvent.change(newPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('パスワードは大文字、小文字、数字を含む必要があります')).toBeInTheDocument()
      })
    })

    it('shows error for password without lowercase letter', async () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      fireEvent.change(newPasswordInput, { target: { value: 'PASSWORD123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'PASSWORD123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('パスワードは大文字、小文字、数字を含む必要があります')).toBeInTheDocument()
      })
    })

    it('shows error for password without number', async () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      fireEvent.change(newPasswordInput, { target: { value: 'PasswordOnly' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'PasswordOnly' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('パスワードは大文字、小文字、数字を含む必要があります')).toBeInTheDocument()
      })
    })
  })

  describe('Password Reset Process', () => {
    it('sends POST request to /api/v1/auth/reset-password on form submission', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successful' })
      } as Response)

      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: 'valid-token',
            newPassword: 'NewPassword123',
            confirmPassword: 'NewPassword123'
          })
        })
      })
    })

    it('displays success message after successful password reset', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successful' })
      } as Response)

      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('パスワードが再設定されました。')).toBeInTheDocument()
      })
    })

    it('redirects to login page after successful password reset', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successful' })
      } as Response)

      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login')
      }, { timeout: 5000 })
    })

    it('disables submit button during request', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.click(submitButton)

      expect(submitButton).toBeDisabled()
    })

    it('shows error message when API returns error', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: 'パスワードの要件を満たしていません'
        })
      } as Response)

      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('パスワードの要件を満たしていません')).toBeInTheDocument()
      })
    })
  })

  describe('Password Visibility Toggle', () => {
    it('toggles new password visibility when eye icon is clicked', () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      expect(newPasswordInput).toHaveAttribute('type', 'password')

      const toggleButton = screen.getAllByRole('button', { name: /show|hide|表示/i })[0]
      fireEvent.click(toggleButton)

      expect(newPasswordInput).toHaveAttribute('type', 'text')

      fireEvent.click(toggleButton)
      expect(newPasswordInput).toHaveAttribute('type', 'password')
    })

    it('toggles confirm password visibility when eye icon is clicked', () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      expect(confirmPasswordInput).toHaveAttribute('type', 'password')

      const toggleButtons = screen.getAllByRole('button', { name: /show|hide|表示/i })
      const confirmToggleButton = toggleButtons[1]
      fireEvent.click(confirmToggleButton)

      expect(confirmPasswordInput).toHaveAttribute('type', 'text')

      fireEvent.click(confirmToggleButton)
      expect(confirmPasswordInput).toHaveAttribute('type', 'password')
    })
  })
})
