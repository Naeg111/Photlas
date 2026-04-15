import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ResetPasswordPage from './ResetPasswordPage'

// API URL
const RESET_PASSWORD_ENDPOINT = '/api/v1/auth/reset-password'

// テスト用定数
const VALID_TOKEN = 'test-valid-token'
const VALID_PASSWORD = 'Password1'
const MISMATCHED_PASSWORD = 'Password2'
const WEAK_PASSWORD = 'weak'

// ラベル・テキスト
const LABEL_NEW_PASSWORD = '新しいパスワード'
const LABEL_CONFIRM_PASSWORD = '新しいパスワード（確認）'
const BUTTON_SUBMIT = 'パスワードを再設定'
const BUTTON_LOGIN = 'ログインへ'

// fetchモック
const mockFetch = vi.fn()

// navigateモック
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

/**
 * tokenパラメータ付きでResetPasswordPageをレンダリングする
 */
const renderWithToken = (token?: string) => {
  const initialEntries = token
    ? [`/reset-password?token=${token}`]
    : ['/reset-password']

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ResetPasswordPage />
    </MemoryRouter>
  )
}

describe('ResetPasswordPage', () => {
  const originalTitle = document.title

  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    document.title = originalTitle
  })

  describe('ページ表示', () => {
    it('tokenがある場合、パスワードリセットフォームが表示される', () => {
      renderWithToken(VALID_TOKEN)

      expect(screen.getByText('パスワードの再設定')).toBeInTheDocument()
      expect(screen.getByLabelText(LABEL_NEW_PASSWORD)).toBeInTheDocument()
      expect(screen.getByLabelText(LABEL_CONFIRM_PASSWORD)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: BUTTON_SUBMIT })).toBeInTheDocument()
    })

    it('tokenがない場合、エラーメッセージが表示される', () => {
      renderWithToken()

      expect(screen.getByText('無効なリンクです')).toBeInTheDocument()
      expect(screen.queryByLabelText(LABEL_NEW_PASSWORD)).not.toBeInTheDocument()
    })

    it('document.titleが設定される', () => {
      renderWithToken(VALID_TOKEN)

      expect(document.title).toBe('パスワードの再設定 - Photlas')
    })
  })

  describe('バリデーション', () => {
    it('パスワードが要件を満たさない場合、エラーメッセージが表示される', async () => {
      renderWithToken(VALID_TOKEN)

      const newPasswordInput = screen.getByLabelText(LABEL_NEW_PASSWORD)
      const confirmPasswordInput = screen.getByLabelText(LABEL_CONFIRM_PASSWORD)
      const submitButton = screen.getByRole('button', { name: BUTTON_SUBMIT })

      fireEvent.change(newPasswordInput, { target: { value: WEAK_PASSWORD } })
      fireEvent.change(confirmPasswordInput, { target: { value: WEAK_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/パスワードは8文字以上/)).toBeInTheDocument()
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('パスワードと確認パスワードが一致しない場合、エラーメッセージが表示される', async () => {
      renderWithToken(VALID_TOKEN)

      const newPasswordInput = screen.getByLabelText(LABEL_NEW_PASSWORD)
      const confirmPasswordInput = screen.getByLabelText(LABEL_CONFIRM_PASSWORD)
      const submitButton = screen.getByRole('button', { name: BUTTON_SUBMIT })

      fireEvent.change(newPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.change(confirmPasswordInput, { target: { value: MISMATCHED_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument()
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('パスワード表示切り替え', () => {
    it('パスワードの表示/非表示を切り替えられる', () => {
      renderWithToken(VALID_TOKEN)

      const newPasswordInput = screen.getByLabelText(LABEL_NEW_PASSWORD)
      expect(newPasswordInput).toHaveAttribute('type', 'password')

      const toggleButtons = screen.getAllByRole('button', { name: /パスワードを表示|パスワードを非表示/ })
      fireEvent.click(toggleButtons[0])

      expect(newPasswordInput).toHaveAttribute('type', 'text')
    })
  })

  describe('API連携', () => {
    it('有効なパスワードで送信するとAPIが呼ばれる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'パスワードが正常に再設定されました' }),
      })

      renderWithToken(VALID_TOKEN)

      const newPasswordInput = screen.getByLabelText(LABEL_NEW_PASSWORD)
      const confirmPasswordInput = screen.getByLabelText(LABEL_CONFIRM_PASSWORD)
      const submitButton = screen.getByRole('button', { name: BUTTON_SUBMIT })

      fireEvent.change(newPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.change(confirmPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(RESET_PASSWORD_ENDPOINT),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              token: VALID_TOKEN,
              newPassword: VALID_PASSWORD,
              confirmPassword: VALID_PASSWORD,
            }),
          })
        )
      })
    })

    it('送信中はボタンが無効化される', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      renderWithToken(VALID_TOKEN)

      const newPasswordInput = screen.getByLabelText(LABEL_NEW_PASSWORD)
      const confirmPasswordInput = screen.getByLabelText(LABEL_CONFIRM_PASSWORD)
      const submitButton = screen.getByRole('button', { name: BUTTON_SUBMIT })

      fireEvent.change(newPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.change(confirmPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })
    })
  })

  describe('成功時の動線', () => {
    it('リセット成功後、完了メッセージとログインボタンが表示される', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'パスワードが正常に再設定されました' }),
      })

      renderWithToken(VALID_TOKEN)

      const newPasswordInput = screen.getByLabelText(LABEL_NEW_PASSWORD)
      const confirmPasswordInput = screen.getByLabelText(LABEL_CONFIRM_PASSWORD)
      const submitButton = screen.getByRole('button', { name: BUTTON_SUBMIT })

      fireEvent.change(newPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.change(confirmPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('パスワードを再設定しました')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: BUTTON_LOGIN })).toBeInTheDocument()
      })

      expect(screen.queryByLabelText(LABEL_NEW_PASSWORD)).not.toBeInTheDocument()
    })

    it('ログインボタンを押すとトップページに遷移する', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'パスワードが正常に再設定されました' }),
      })

      renderWithToken(VALID_TOKEN)

      const newPasswordInput = screen.getByLabelText(LABEL_NEW_PASSWORD)
      const confirmPasswordInput = screen.getByLabelText(LABEL_CONFIRM_PASSWORD)
      const submitButton = screen.getByRole('button', { name: BUTTON_SUBMIT })

      fireEvent.change(newPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.change(confirmPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: BUTTON_LOGIN })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: BUTTON_LOGIN }))

      expect(mockNavigate).toHaveBeenCalledWith('/', { state: { openLogin: true } })
    })
  })

  describe('エラーハンドリング', () => {
    it('トークンが無効な場合、エラーメッセージが表示される', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'トークンが無効または期限切れです' }),
      })

      renderWithToken(VALID_TOKEN)

      const newPasswordInput = screen.getByLabelText(LABEL_NEW_PASSWORD)
      const confirmPasswordInput = screen.getByLabelText(LABEL_CONFIRM_PASSWORD)
      const submitButton = screen.getByRole('button', { name: BUTTON_SUBMIT })

      fireEvent.change(newPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.change(confirmPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('トークンが無効または期限切れです')).toBeInTheDocument()
      })
    })

    it('通信エラー時にエラーメッセージが表示される', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      renderWithToken(VALID_TOKEN)

      const newPasswordInput = screen.getByLabelText(LABEL_NEW_PASSWORD)
      const confirmPasswordInput = screen.getByLabelText(LABEL_CONFIRM_PASSWORD)
      const submitButton = screen.getByRole('button', { name: BUTTON_SUBMIT })

      fireEvent.change(newPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.change(confirmPasswordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
      })
    })
  })
})
