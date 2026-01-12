import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { AccountSettingsDialog } from './AccountSettingsDialog'
import { toast } from 'sonner'

/**
 * Issue#20: アカウント設定機能 - AccountSettingsDialog テスト
 *
 * テスト対象:
 * - メールアドレス変更機能
 * - パスワード変更機能
 * - アカウント削除機能
 */

// useNavigate のモック
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// fetch API のモック
globalThis.fetch = vi.fn() as any

// sonner (toast) のモック
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const MockedAccountSettingsDialog = ({ open, onOpenChange, currentEmail }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentEmail: string
}) => (
  <BrowserRouter>
    <AccountSettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      currentEmail={currentEmail}
    />
  </BrowserRouter>
)

describe('AccountSettingsDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()

    // localStorage のモック
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => {
          if (key === 'token') return 'mock-token'
          return null
        }),
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
    it('renders when open prop is true', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      expect(screen.getByText('アカウント設定')).toBeInTheDocument()
    })

    it('displays current email address', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const currentEmailInput = screen.getByDisplayValue('test@example.com')
      expect(currentEmailInput).toBeInTheDocument()
      expect(currentEmailInput).toBeDisabled()
    })

    it('displays email change section', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      expect(screen.getByText('メールアドレスの変更')).toBeInTheDocument()
      expect(screen.getByLabelText('新しいメールアドレス')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'メールアドレスを変更' })).toBeInTheDocument()
    })

    it('displays password change section', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      expect(screen.getByText('パスワードの変更')).toBeInTheDocument()
      expect(screen.getByLabelText('現在のパスワード')).toBeInTheDocument()
      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
      expect(screen.getByLabelText('新しいパスワード（確認）')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'パスワードを変更' })).toBeInTheDocument()
    })

    it('displays account deletion section', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      expect(screen.getByText('アカウント削除')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'アカウントを削除' })).toBeInTheDocument()
    })

    it('displays plan section', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      expect(screen.getByText('プラン')).toBeInTheDocument()
      expect(screen.getByText('無料プラン')).toBeInTheDocument()
    })
  })

  describe('Email Change', () => {
    it('successfully changes email with valid inputs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'newemail@example.com' }),
      })

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const newEmailInput = screen.getByLabelText('新しいメールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const submitButton = screen.getByRole('button', { name: 'メールアドレスを変更' })

      fireEvent.change(newEmailInput, { target: { value: 'newemail@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/users/me/email'),
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer mock-token',
            }),
            body: JSON.stringify({
              new_email: 'newemail@example.com',
              current_password: 'password123',
            }),
          })
        )
      })
    })

    it('shows error when password is incorrect (401)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const newEmailInput = screen.getByLabelText('新しいメールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const submitButton = screen.getByRole('button', { name: 'メールアドレスを変更' })

      fireEvent.change(newEmailInput, { target: { value: 'newemail@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it('shows error when email is already in use (409)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
      })

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const newEmailInput = screen.getByLabelText('新しいメールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const submitButton = screen.getByRole('button', { name: 'メールアドレスを変更' })

      fireEvent.change(newEmailInput, { target: { value: 'existing@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })
  })

  describe('Password Change', () => {
    it('successfully changes password with valid inputs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      })

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const currentPasswordInput = screen.getByLabelText('現在のパスワード')
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認）')
      const submitButton = screen.getByRole('button', { name: 'パスワードを変更' })

      fireEvent.change(currentPasswordInput, { target: { value: 'oldPassword123' } })
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/users/me/password'),
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer mock-token',
            }),
            body: JSON.stringify({
              current_password: 'oldPassword123',
              new_password: 'NewPass123',
              new_password_confirm: 'NewPass123',
            }),
          })
        )
      })
    })

    it('shows error when current password is incorrect (401)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const currentPasswordInput = screen.getByLabelText('現在のパスワード')
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認）')
      const submitButton = screen.getByRole('button', { name: 'パスワードを変更' })

      fireEvent.change(currentPasswordInput, { target: { value: 'wrongPassword' } })
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    // Issue#21: パスワードバリデーション統一 - 記号禁止チェック
    it('shows error when new password contains special characters', async () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const currentPasswordInput = screen.getByLabelText('現在のパスワード')
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認）')
      const submitButton = screen.getByRole('button', { name: 'パスワードを変更' })

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } })
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123!' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123!' } })
      fireEvent.click(submitButton)

      // フロントエンドバリデーションでエラーが表示されることを確認
      expect(toast.error).toHaveBeenCalledWith('パスワードは8〜20文字で、数字・小文字・大文字をそれぞれ1文字以上含め、記号は使用できません')

      // API呼び出しは行われないことを確認
      expect(mockFetch).not.toHaveBeenCalled()
    })

    // Issue#21: パスワードバリデーション統一 - 最大文字数チェック
    it('shows error when new password is longer than 20 characters', async () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const currentPasswordInput = screen.getByLabelText('現在のパスワード')
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認）')
      const submitButton = screen.getByRole('button', { name: 'パスワードを変更' })

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } })
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass12345678901234' } }) // 21文字
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass12345678901234' } })
      fireEvent.click(submitButton)

      // フロントエンドバリデーションでエラーが表示されることを確認
      expect(toast.error).toHaveBeenCalledWith('パスワードは8〜20文字で、数字・小文字・大文字をそれぞれ1文字以上含め、記号は使用できません')

      // API呼び出しは行われないことを確認
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Account Deletion', () => {
    it('opens confirmation dialog when delete button is clicked', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const deleteButton = screen.getByRole('button', { name: 'アカウントを削除' })
      fireEvent.click(deleteButton)

      expect(screen.getByText('本当に削除しますか？')).toBeInTheDocument()
      expect(screen.getByLabelText('パスワードを入力して確認')).toBeInTheDocument()
    })

    it('successfully deletes account and redirects to home', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      })

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      // Open delete dialog
      const deleteButton = screen.getByRole('button', { name: 'アカウントを削除' })
      fireEvent.click(deleteButton)

      // Enter password
      const passwordInput = screen.getByLabelText('パスワードを入力して確認')
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: '削除する' })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/users/me'),
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer mock-token',
            }),
            body: JSON.stringify({
              password: 'password123',
            }),
          })
        )
      })

      // Check that localStorage is cleared and navigation occurs
      await waitFor(() => {
        expect(window.localStorage.removeItem).toHaveBeenCalledWith('token')
        expect(window.localStorage.removeItem).toHaveBeenCalledWith('username')
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('shows error when password is incorrect (401)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      // Open delete dialog
      const deleteButton = screen.getByRole('button', { name: 'アカウントを削除' })
      fireEvent.click(deleteButton)

      // Enter wrong password
      const passwordInput = screen.getByLabelText('パスワードを入力して確認')
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: '削除する' })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })
  })

  describe('Form Validation', () => {
    it('shows error when trying to change email without filling all fields', async () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const submitButton = screen.getByRole('button', { name: 'メールアドレスを変更' })
      fireEvent.click(submitButton)

      // Should not call API
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('shows error when trying to change password without filling all fields', async () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const submitButton = screen.getByRole('button', { name: 'パスワードを変更' })
      fireEvent.click(submitButton)

      // Should not call API
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('shows error when password confirmation does not match', async () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail="test@example.com"
        />
      )

      const currentPasswordInput = screen.getByLabelText('現在のパスワード')
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認）')
      const submitButton = screen.getByRole('button', { name: 'パスワードを変更' })

      fireEvent.change(currentPasswordInput, { target: { value: 'oldPassword123' } })
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123' } })
      fireEvent.click(submitButton)

      // Should not call API
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
