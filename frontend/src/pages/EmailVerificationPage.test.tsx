import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EmailVerificationPage from './EmailVerificationPage'

// テスト用定数
const VALID_TOKEN = 'test-valid-token'
const VERIFY_EMAIL_ENDPOINT = '/api/v1/auth/verify-email'

// テキスト定数
const TEXT_LOADING = 'メールアドレスを認証しています...'
const TEXT_SUCCESS_HEADING = '認証完了'
const TEXT_SUCCESS_MESSAGE = 'メールアドレスの認証が完了しました。'
const TEXT_AUTO_REDIRECT = '3秒後にトップページへ移動します...'
const TEXT_GO_TO_TOP = '今すぐトップページへ'
const TEXT_ERROR_HEADING = '認証エラー'
const TEXT_NO_TOKEN_ERROR = '認証トークンが見つかりません'
const TEXT_GENERIC_ERROR = '認証に失敗しました。しばらく経ってからお試しください。'
const TEXT_API_ERROR = 'トークンが無効または期限切れです'

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

// sonnerモック
vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

/**
 * tokenパラメータ付きでEmailVerificationPageをレンダリングする
 */
const renderWithToken = (token?: string) => {
  const initialEntries = token
    ? [`/verify-email?token=${token}`]
    : ['/verify-email']

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <EmailVerificationPage />
    </MemoryRouter>
  )
}

describe('EmailVerificationPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('ページ表示', () => {
    it('tokenがある場合、ローディングスピナーが表示される', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      renderWithToken(VALID_TOKEN)

      expect(screen.getByText(TEXT_LOADING)).toBeInTheDocument()
    })

    it('tokenがない場合、エラーメッセージが表示される', () => {
      renderWithToken()

      expect(screen.getByText(TEXT_ERROR_HEADING)).toBeInTheDocument()
      expect(screen.getByText(TEXT_NO_TOKEN_ERROR)).toBeInTheDocument()
    })
  })

  describe('認証成功', () => {
    it('API 200レスポンスで成功メッセージが表示される', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_SUCCESS_HEADING)).toBeInTheDocument()
        expect(screen.getByText(TEXT_SUCCESS_MESSAGE)).toBeInTheDocument()
      })
    })

    it('成功時に「今すぐトップページへ」リンクが表示される', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_GO_TO_TOP)).toBeInTheDocument()
        expect(screen.getByText(TEXT_AUTO_REDIRECT)).toBeInTheDocument()
      })
    })

    it('成功後3秒でトップページへ自動遷移する', async () => {
      vi.useFakeTimers()
      mockFetch.mockResolvedValueOnce({ ok: true })

      renderWithToken(VALID_TOKEN)

      // Promiseのマイクロタスクを処理するためフラッシュ
      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.getByText(TEXT_SUCCESS_HEADING)).toBeInTheDocument()
      expect(mockNavigate).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('認証失敗', () => {
    it('API非200レスポンスでAPIからのエラーメッセージが表示される', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: TEXT_API_ERROR }),
      })

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_ERROR_HEADING)).toBeInTheDocument()
        expect(screen.getByText(TEXT_API_ERROR)).toBeInTheDocument()
      })
    })

    it('fetch例外発生時に汎用エラーメッセージが表示される', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_ERROR_HEADING)).toBeInTheDocument()
        expect(screen.getByText(TEXT_GENERIC_ERROR)).toBeInTheDocument()
      })
    })
  })

  describe('API呼び出し', () => {
    it('tokenを含むURLでverify-email APIが呼び出される', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`${VERIFY_EMAIL_ENDPOINT}?token=${VALID_TOKEN}`)
        )
      })
    })
  })
})
