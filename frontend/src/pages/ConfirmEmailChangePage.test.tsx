import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ConfirmEmailChangePage from './ConfirmEmailChangePage'

// テスト用定数
const VALID_TOKEN = 'test-valid-token'
const NEW_EMAIL = 'new@example.com'
const NEW_TOKEN = 'new-jwt-token'

// テキスト定数（既存i18nに合わせる）
const TEXT_SUCCESS_HEADING = '変更完了'
const TEXT_SUCCESS_MESSAGE_NORMAL = 'Photlasに戻って新しいメールアドレスでログインしてください。'
const TEXT_SUCCESS_MESSAGE_IN_APP = 'ブラウザでPhotlasを開いて新しいメールアドレスでログインしてください。'
const TEXT_OPEN_PHOTLAS = 'Photlasを開く'
const TEXT_HOME = 'ホーム'

// マーカーキー
const EMAIL_JUST_CHANGED_KEY = 'email_just_changed'

// user-agents
const UA_NORMAL = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const UA_IN_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.0.0'

// fetchモック
const mockFetch = vi.fn()

// ナビゲーションモック
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// AuthContext モック
// 同一参照を返さないと useEffect が無限ループする（依存配列に user, login 等が含まれているため）
const { mockLogout, mockLogin, mockUpdateUser, stableAuth } = vi.hoisted(() => {
  const mockLogout = vi.fn()
  const mockLogin = vi.fn()
  const mockUpdateUser = vi.fn()
  return {
    mockLogout,
    mockLogin,
    mockUpdateUser,
    stableAuth: {
      user: { userId: 1, email: 'old@example.com', username: 'testuser', role: 0 },
      login: mockLogin,
      logout: mockLogout,
      updateUser: mockUpdateUser,
    },
  }
})

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => stableAuth,
}))

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
  })
}

const renderWithToken = (token = VALID_TOKEN) => {
  return render(
    <MemoryRouter initialEntries={[`/confirm-email-change?token=${token}`]}>
      <ConfirmEmailChangePage />
    </MemoryRouter>
  )
}

describe('ConfirmEmailChangePage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
    setUserAgent(UA_NORMAL)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Issue#110 - 背景色', () => {
    it('外側コンテナの背景が bg-black である', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      const { container } = renderWithToken()

      const outer = container.querySelector('.min-h-screen')
      expect(outer).toHaveClass('bg-black')
      expect(outer).not.toHaveClass('bg-gray-50')
    })

    it('中央のカード（bg-white）はそのまま維持される', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      const { container } = renderWithToken()

      const card = container.querySelector('.bg-white')
      expect(card).toBeInTheDocument()
    })
  })

  describe('Issue#110 - 認証成功（通常ブラウザ）', () => {
    beforeEach(() => {
      setUserAgent(UA_NORMAL)
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: NEW_TOKEN, email: NEW_EMAIL }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('成功メッセージが表示される', async () => {
      renderWithToken()

      await waitFor(() => {
        expect(screen.getByText(TEXT_SUCCESS_HEADING)).toBeInTheDocument()
        expect(screen.getByText(TEXT_SUCCESS_MESSAGE_NORMAL)).toBeInTheDocument()
      })
    })

    it('「Photlasを開く」リンクが表示される', async () => {
      renderWithToken()

      await waitFor(() => {
        expect(screen.getByText(TEXT_OPEN_PHOTLAS)).toBeInTheDocument()
      })
    })

    it('成功時に logout() が呼ばれる（古いセッションを破棄）', async () => {
      renderWithToken()

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled()
      })
    })

    it('成功時に login() が呼ばれない（自動ログイン更新を行わない）', async () => {
      renderWithToken()

      await waitFor(() => {
        expect(screen.getByText(TEXT_SUCCESS_HEADING)).toBeInTheDocument()
      })

      expect(mockLogin).not.toHaveBeenCalled()
    })

    it('成功時に email_just_changed マーカーが localStorage に書き込まれる', async () => {
      renderWithToken()

      await waitFor(() => {
        expect(screen.getByText(TEXT_SUCCESS_HEADING)).toBeInTheDocument()
      })

      const calls = (localStorage.setItem as unknown as ReturnType<typeof vi.fn>).mock.calls
      const markerCall = calls.find(([key]) => key === EMAIL_JUST_CHANGED_KEY)
      expect(markerCall).toBeDefined()
      expect(markerCall![1]).toMatch(/^\d+$/) // タイムスタンプ
    })

    it('成功時にトップページへの自動遷移が行われない', async () => {
      vi.useFakeTimers()
      renderWithToken()

      // 成功表示まで待つ（fake timers でも awaiting は機能する）
      await vi.waitFor(() => {
        expect(screen.getByText(TEXT_SUCCESS_HEADING)).toBeInTheDocument()
      })

      expect(mockNavigate).not.toHaveBeenCalled()

      // 10 秒経過しても遷移しない
      vi.advanceTimersByTime(10000)
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('「Photlasを開く」クリックで state.openLogin=true を渡して遷移する', async () => {
      const user = userEvent.setup()
      renderWithToken()

      const link = await screen.findByText(TEXT_OPEN_PHOTLAS)
      await user.click(link)

      expect(mockNavigate).toHaveBeenCalledWith('/', { state: { openLogin: true } })
    })
  })

  describe('Issue#110 - アプリ内ブラウザ', () => {
    beforeEach(() => {
      setUserAgent(UA_IN_APP)
    })

    it('成功画面に「ブラウザで Photlas を開いて...」メッセージが表示される', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: NEW_TOKEN, email: NEW_EMAIL }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      renderWithToken()

      await waitFor(() => {
        expect(screen.getByText(TEXT_SUCCESS_MESSAGE_IN_APP)).toBeInTheDocument()
      })
    })

    it('成功画面に「Photlasを開く」リンクが表示されない', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: NEW_TOKEN, email: NEW_EMAIL }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      renderWithToken()

      await waitFor(() => {
        expect(screen.getByText(TEXT_SUCCESS_HEADING)).toBeInTheDocument()
      })

      expect(screen.queryByText(TEXT_OPEN_PHOTLAS)).not.toBeInTheDocument()
    })

    it('エラー画面に「ホーム」リンクが表示されない', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Token invalid' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      renderWithToken()

      // エラー画面が出るのを待つ
      await waitFor(() => {
        // エラー時のタイトル要素が存在する想定
        const heading = screen.queryByText(/エラー|失敗/)
        expect(heading).toBeInTheDocument()
      })

      expect(screen.queryByText(TEXT_HOME)).not.toBeInTheDocument()
    })
  })
})
