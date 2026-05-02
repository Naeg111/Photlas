import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import EmailVerificationPage from './EmailVerificationPage'

// テスト用定数
const VALID_TOKEN = 'test-valid-token'
const VERIFY_EMAIL_ENDPOINT = '/api/v1/auth/verify-email'

// テキスト定数
const TEXT_LOADING = 'メールアドレスを認証しています...'
const TEXT_SUCCESS_HEADING = '認証完了'
const TEXT_SUCCESS_MESSAGE = 'Photlasに戻ってログインしてください。'
const TEXT_IN_APP_MESSAGE = 'ブラウザでPhotlasを開いてログインしてください。'
const TEXT_OPEN_PHOTLAS = 'Photlasを開く'
const TEXT_HOME = 'ホーム'
const TEXT_ERROR_HEADING = '認証エラー'
const TEXT_NO_TOKEN_ERROR = '認証トークンが見つかりません'
const TEXT_GENERIC_ERROR = 'エラーが発生しました'
const TEXT_API_ERROR = 'トークンが無効または期限切れです'

// localStorage マーカーキー
const EMAIL_JUST_VERIFIED_KEY = 'email_just_verified'

// 通常ブラウザの user-agent
const UA_NORMAL = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

// アプリ内ブラウザの user-agent（LINE）
const UA_IN_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.0.0'

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
 * navigator.userAgent を一時的に上書きする
 */
function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
  })
}

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
    setUserAgent(UA_NORMAL)
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

  describe('Issue#110 - 背景色', () => {
    it('ページ全体の外側コンテナの背景が bg-black である', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      const { container } = renderWithToken(VALID_TOKEN)

      // 外側コンテナ（最上位の div）
      const outer = container.querySelector('.min-h-screen')
      expect(outer).toHaveClass('bg-black')
      expect(outer).not.toHaveClass('bg-gray-50')
    })

    it('中央のカード（bg-white）はそのまま維持される', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      const { container } = renderWithToken(VALID_TOKEN)

      const card = container.querySelector('.bg-white')
      expect(card).toBeInTheDocument()
    })
  })

  describe('認証成功（通常ブラウザ）', () => {
    beforeEach(() => {
      setUserAgent(UA_NORMAL)
    })

    it('API 200レスポンスで成功メッセージが表示される', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_SUCCESS_HEADING)).toBeInTheDocument()
        expect(screen.getByText(TEXT_SUCCESS_MESSAGE)).toBeInTheDocument()
      })
    })

    it('成功時に「Photlasを開く」リンクが表示される', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_OPEN_PHOTLAS)).toBeInTheDocument()
      })
    })

    it('Issue#110 - 成功後に自動遷移しない（3秒経過しても navigate されない）', async () => {
      vi.useFakeTimers()
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

      renderWithToken(VALID_TOKEN)

      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.getByText(TEXT_SUCCESS_HEADING)).toBeInTheDocument()
      expect(mockNavigate).not.toHaveBeenCalled()

      // 3秒経過しても navigate されないことを確認
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(mockNavigate).not.toHaveBeenCalled()

      // さらに10秒経過しても navigate されない
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('Issue#110 - 「Photlasを開く」クリックで state.openLogin=true を渡して遷移する', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))
      const user = userEvent.setup()

      renderWithToken(VALID_TOKEN)

      const link = await screen.findByText(TEXT_OPEN_PHOTLAS)
      await user.click(link)

      expect(mockNavigate).toHaveBeenCalledWith('/', { state: { openLogin: true } })
    })

    it('Issue#110 - 認証成功時に localStorage にマーカーが書き込まれる', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_SUCCESS_HEADING)).toBeInTheDocument()
      })

      // マーカーが書き込まれた呼び出しが行われたことを確認
      const calls = (localStorage.setItem as unknown as ReturnType<typeof vi.fn>).mock.calls
      const markerCall = calls.find(([key]) => key === EMAIL_JUST_VERIFIED_KEY)
      expect(markerCall).toBeDefined()
      expect(markerCall![1]).toMatch(/^\d+$/) // タイムスタンプ
    })
  })

  describe('Issue#110 - アプリ内ブラウザの場合', () => {
    beforeEach(() => {
      setUserAgent(UA_IN_APP)
    })

    it('成功画面に「ブラウザでPhotlasを開いて...」メッセージが表示される', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_IN_APP_MESSAGE)).toBeInTheDocument()
      })
    })

    it('成功画面に「Photlasを開く」リンクは表示されない', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_SUCCESS_HEADING)).toBeInTheDocument()
      })

      expect(screen.queryByText(TEXT_OPEN_PHOTLAS)).not.toBeInTheDocument()
    })

    it('エラー画面に「ホーム」リンクは表示されない', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: TEXT_API_ERROR }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_ERROR_HEADING)).toBeInTheDocument()
      })

      expect(screen.queryByText(TEXT_HOME)).not.toBeInTheDocument()
    })
  })

  describe('認証失敗', () => {
    it('API非200レスポンスでAPIからのエラーメッセージが表示される', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: TEXT_API_ERROR }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      )

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

    it('Issue#110 - 認証失敗時はマーカーが書き込まれない', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: TEXT_API_ERROR }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_ERROR_HEADING)).toBeInTheDocument()
      })

      // マーカーキーで setItem が呼ばれていないことを確認
      const calls = (localStorage.setItem as unknown as ReturnType<typeof vi.fn>).mock.calls
      const markerCall = calls.find(([key]) => key === EMAIL_JUST_VERIFIED_KEY)
      expect(markerCall).toBeUndefined()
    })
  })

  describe('API呼び出し', () => {
    it('tokenを含むURLでverify-email APIが呼び出される', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
      const [calledUrl] = mockFetch.mock.calls[0]
      expect(calledUrl).toEqual(
        expect.stringContaining(`${VERIFY_EMAIL_ENDPOINT}?token=${VALID_TOKEN}`)
      )
    })
  })

  // Issue#96 PR2b: 429 レート制限ハンドリング（パターンA: ページロード時のAPI呼び出し）
  describe('Rate Limit (429) - レート制限', () => {
    it('メール認証で429を受信したらレート制限メッセージがエラー画面に表示される', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Too many requests', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Retry-After': '60' },
        })
      )

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(screen.getByText(TEXT_ERROR_HEADING)).toBeInTheDocument()
        expect(
          screen.getByText('リクエストが多すぎます。60 秒後に再度お試しください。')
        ).toBeInTheDocument()
      })
    })

    it('Retry-Afterヘッダが欠落していてもデフォルト60秒のメッセージを表示する', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Too many requests', {
          status: 429,
        })
      )

      renderWithToken(VALID_TOKEN)

      await waitFor(() => {
        expect(
          screen.getByText('リクエストが多すぎます。60 秒後に再度お試しください。')
        ).toBeInTheDocument()
      })
    })
  })
})
