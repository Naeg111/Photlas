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

// sonnerのモック
const { mockToast } = vi.hoisted(() => ({
  mockToast: { error: vi.fn(), success: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: mockToast }))

// fetch APIのモック
globalThis.fetch = vi.fn() as any

describe('PasswordResetRequestModal', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
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
      expect(screen.getByRole('textbox', { name: 'メールアドレス' })).toHaveAttribute('type', 'email')
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
    it('メールアドレス未入力時は送信ボタンが非活性で送信できない', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const submitButton = screen.getByRole('button', { name: '送信' })
      expect(submitButton).toBeDisabled()
    })

    it('不正なメールアドレス形式で送信するとトーストエラーが表示される', async () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })

      const submitButton = screen.getByRole('button', { name: '送信' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('メールアドレスの形式が正しくありません')
      })
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
        json: async () => ({
          message: 'メールアドレスが見つかりません'
        })
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
      mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => {
        resolve({
          ok: true,
          json: async () => ({ message: 'Success' })
        } as Response)
      }, 100)))

      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      const submitButton = screen.getByRole('button', { name: '送信' })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)

      expect(submitButton).toBeDisabled()

      // Wait for the async operation to complete
      await waitFor(() => {
        expect(screen.getByText('パスワード再設定用のメールを送信しました。受信トレイをご確認ください。')).toBeInTheDocument()
      })
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

      // DialogContentの組み込み閉じるボタン（sr-only "Close"テキスト）をクリック
      const closeButton = screen.getByRole('button', { name: 'Close' })
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

  describe('Dialog化', () => {
    it('Dialogコンポーネントを使用している（data-slot="dialog-content"が存在する）', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      expect(document.querySelector('[data-slot="dialog-content"]')).toBeInTheDocument()
    })

    it('送信ボタンの背景色が黒である', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const submitButton = screen.getByRole('button', { name: '送信' })
      expect(submitButton.className).toContain('bg-primary')
    })
  })

  describe('送信ボタンの非活性制御', () => {
    it('メールアドレス未入力時は送信ボタンが非活性', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const submitButton = screen.getByRole('button', { name: '送信' })
      expect(submitButton).toBeDisabled()
    })

    it('メールアドレス入力後は送信ボタンが活性になる', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

      const submitButton = screen.getByRole('button', { name: '送信' })
      expect(submitButton).not.toBeDisabled()
    })

    it('不正なメールアドレス形式で送信するとトーストが表示される', async () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })

      const submitButton = screen.getByRole('button', { name: '送信' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('メールアドレスの形式が正しくありません')
      })
    })
  })

  describe('説明文の文字色', () => {
    it('説明文の文字色が黒である', () => {
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const text1 = screen.getByText('登録メールアドレスを入力してください。')
      const text2 = screen.getByText('入力したら送信ボタンを押してください。')

      expect(text1.className).toContain('text-black')
      expect(text2.className).toContain('text-black')
    })
  })

  // Issue#96 PR2b: 429 レート制限ハンドリング（パターンA: フォーム送信系）
  describe('Rate Limit (429) - レート制限', () => {
    it('パスワードリセット要求で429を受信したらレート制限メッセージをインライン表示する', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce(
        new Response('Too many requests', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Retry-After': '60' },
        })
      )

      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.click(screen.getByRole('button', { name: '送信' }))

      await waitFor(() => {
        expect(
          screen.getByText('リクエストが多すぎます。60 秒後に再度お試しください。')
        ).toBeInTheDocument()
      })
    })

    it('パスワードリセット要求で429を受信したら送信ボタンがクールダウン表示で無効化される', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce(
        new Response('Too many requests', {
          status: 429,
          headers: { 'Retry-After': '60' },
        })
      )

      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.click(screen.getByRole('button', { name: '送信' }))

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /送信（あと 60 秒）/ })
        expect(button).toBeDisabled()
      })
    })

    it('Retry-Afterヘッダが欠落していてもデフォルト60秒でクールダウンする', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce(
        new Response('Too many requests', {
          status: 429,
        })
      )

      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      const emailInput = screen.getByLabelText('メールアドレス')
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.click(screen.getByRole('button', { name: '送信' }))

      await waitFor(() => {
        expect(
          screen.getByText('リクエストが多すぎます。60 秒後に再度お試しください。')
        ).toBeInTheDocument()
      })
    })
  })
})
