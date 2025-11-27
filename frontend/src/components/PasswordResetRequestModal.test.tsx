import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import PasswordResetRequestModal from './PasswordResetRequestModal'

/**
 * Issue#6: パスワードリセット機能 - パスワードリセットリクエストモーダル UI テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - モーダルウィンドウの表示/非表示
 * - 説明文：「登録メールアドレスを入力してください。」
 * - メールアドレス入力欄
 * - 説明文：「入力したら送信ボタンを押してください。」
 * - 「送信」ボタン
 * - 送信後の確認メッセージ：「パスワード再設定用のメールを送信しました。受信トレイをご確認ください。」
 */

describe('PasswordResetRequestModal', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock before each test
    global.fetch = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  describe('UI Elements', () => {
    it('renders modal when open prop is true', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      expect(screen.getByText('パスワードリセット')).toBeInTheDocument()
    })

    it('does not render modal when open prop is false', () => {
      render(<PasswordResetRequestModal open={false} onClose={mockOnClose} />)

      expect(screen.queryByText('パスワードリセット')).not.toBeInTheDocument()
    })

    it('renders instruction text for email input', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      expect(screen.getByText('登録メールアドレスを入力してください。')).toBeInTheDocument()
    })

    it('renders email input field', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'メールアドレス' })).toHaveAttribute('type', 'text')
    })

    it('renders instruction text for submit button', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      expect(screen.getByText('入力したら送信ボタンを押してください。')).toBeInTheDocument()
    })

    it('renders submit button', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('shows required error for empty email', async () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const submitButton = screen.getByRole('button', { name: '送信' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('メールアドレスは必須です')).toBeInTheDocument()
      })
    })

    it('shows invalid email format error', async () => {
      // fetchのモックを設定（バリデーションが正しく動作すれば呼ばれないはず）
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid email' })
      } as Response)

      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })

      const submitButton = screen.getByRole('button', { name: '送信' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('正しいメールアドレス形式で入力してください')).toBeInTheDocument()
      })

      // fetchが呼ばれていないことを確認（バリデーションで止まっているはず）
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Password Reset Request Process', () => {
    it('sends POST request to /api/v1/auth/password-reset-request on form submission', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset email sent' })
      } as Response)

      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      const submitButton = screen.getByRole('button', { name: '送信' })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/password-reset-request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'test@example.com'
          })
        })
      })
    })

    it('displays success message after successful request', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset email sent' })
      } as Response)

      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      const submitButton = screen.getByRole('button', { name: '送信' })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('パスワード再設定用のメールを送信しました。受信トレイをご確認ください。')).toBeInTheDocument()
      })
    })

    it('shows error message on request failure', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'メールアドレスが見つかりません' })
      } as Response)

      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      const submitButton = screen.getByRole('button', { name: '送信' })

      fireEvent.change(emailInput, { target: { value: 'notfound@example.com' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('メールアドレスが見つかりません')).toBeInTheDocument()
      })
    })

    it('disables submit button during request', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      const submitButton = screen.getByRole('button', { name: '送信' })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)

      expect(submitButton).toBeDisabled()
    })

    it('hides email input and submit button after success, shows only success message', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset email sent' })
      } as Response)

      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      const submitButton = screen.getByRole('button', { name: '送信' })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('パスワード再設定用のメールを送信しました。受信トレイをご確認ください。')).toBeInTheDocument()
      })

      // After success, the input fields should not be visible
      expect(screen.queryByLabelText('メールアドレス')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '送信' })).not.toBeInTheDocument()
    })
  })

  describe('Modal Interaction', () => {
    it('calls onClose when modal is dismissed', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // Find the close button by aria-label
      const closeButton = screen.getByLabelText('閉じる')
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('resets form state when modal is reopened', async () => {
      const { rerender } = render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

      // Close and reopen modal
      rerender(<PasswordResetRequestModal open={false} onClose={mockOnClose} />)
      rerender(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // Email input should be reset
      expect(screen.getByLabelText('メールアドレス')).toHaveValue('')
    })
  })
})
