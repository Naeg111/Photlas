import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OAuthCallbackPage from './OAuthCallbackPage'

// ---------- モック ----------

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockFetch = vi.fn()

/**
 * window.location.hash を上書きしてページをレンダリングする。
 */
function renderWithHash(hash: string) {
  // jsdom は hash の直接代入を許容する
  window.location.hash = hash
  return render(
    <MemoryRouter>
      <OAuthCallbackPage />
    </MemoryRouter>
  )
}

// ---------- テスト ----------

describe('OAuthCallbackPage', () => {
  let localStorageMock: Record<string, string>

  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
    window.location.hash = ''

    // Real localStorage stub（setup.ts のモックは getItem/setItem のみ記録するので上書き）
    localStorageMock = {}
    // setup.ts で global.localStorage が vi.fn() でモックされているので、実装を差し込む
    ;(localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value
    })
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => localStorageMock[key] ?? null)

    // window.location.reload をモック（jsdom では未実装）
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        reload: vi.fn(),
        hash: '',
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('エラー処理', () => {
    it('error=OAUTH_EMAIL_REQUIRED のフラグメント時、エラー画面と対応メッセージが表示される', async () => {
      window.location.hash = '#error=OAUTH_EMAIL_REQUIRED'
      render(
        <MemoryRouter>
          <OAuthCallbackPage />
        </MemoryRouter>
      )

      // 見出し (h2) はユニーク
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /OAuth ログインエラー/ })).toBeInTheDocument()
      })
      // OAUTH_EMAIL_REQUIRED 固有のメッセージが本文 <p> に表示される
      expect(
        screen.getByText(/メールアドレスが取得できませんでした/)
      ).toBeInTheDocument()
    })

    it('未知のエラーコードは汎用 OAUTH_UNKNOWN_ERROR メッセージにフォールバック', async () => {
      window.location.hash = '#error=UNKNOWN_WEIRD_CODE'
      render(
        <MemoryRouter>
          <OAuthCallbackPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByText(/予期しないエラー/)
        ).toBeInTheDocument()
      })
    })

    it('フラグメントが空の場合は汎用エラーメッセージを表示', async () => {
      window.location.hash = ''
      render(
        <MemoryRouter>
          <OAuthCallbackPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /OAuth ログインエラー/ })
        ).toBeInTheDocument()
      })
    })
  })

  describe('リンク確認フロー', () => {
    it('link_confirmation_token + provider のフラグメント時は / へ state 付きで navigate', async () => {
      window.location.hash = '#link_confirmation_token=abc123&provider=GOOGLE'
      render(
        <MemoryRouter>
          <OAuthCallbackPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', {
          replace: true,
          state: { linkConfirmationToken: 'abc123', provider: 'GOOGLE' },
        })
      })
    })
  })

  describe('ログイン成功', () => {
    const USER_PROFILE = {
      userId: 42,
      username: 'alice',
      email: 'alice@example.com',
      role: 101,
      language: 'ja',
    }

    it('access_token のフラグメント時、/users/me を Bearer 付きで呼び出し localStorage に保存する', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(USER_PROFILE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      window.location.hash = '#access_token=jwt.test.value'
      render(
        <MemoryRouter>
          <OAuthCallbackPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toEqual(expect.stringContaining('/users/me'))
      expect(options).toMatchObject({
        headers: { Authorization: 'Bearer jwt.test.value' },
      })

      await waitFor(() => {
        expect(localStorageMock['auth_token']).toBe('jwt.test.value')
        const savedUser = JSON.parse(localStorageMock['auth_user'])
        expect(savedUser.userId).toBe(42)
        expect(savedUser.email).toBe('alice@example.com')
      })
    })

    it('成功時は / へ replace 遷移する', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(USER_PROFILE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      window.location.hash = '#access_token=jwt-ok'
      render(
        <MemoryRouter>
          <OAuthCallbackPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
      })
    })

    it('requires_username_setup=true 付きは /?requires_username_setup=1 へ遷移', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(USER_PROFILE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      window.location.hash = '#access_token=jwt-setup&requires_username_setup=true'
      render(
        <MemoryRouter>
          <OAuthCallbackPage />
        </MemoryRouter>
      )

      // Issue#104: requires_username_setup の URL パラメータは廃止（/users/me ベースに移行）
      // OAuthCallbackPage は常に / にリダイレクト
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/',
          { replace: true }
        )
      })
    })

    it('/users/me が失敗したらエラー画面を表示', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('unauthorized', { status: 401 })
      )
      window.location.hash = '#access_token=bad-jwt'
      render(
        <MemoryRouter>
          <OAuthCallbackPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /OAuth ログインエラー/ })
        ).toBeInTheDocument()
      })
      // 成功リダイレクトは発生しない
      expect(mockNavigate).not.toHaveBeenCalledWith('/', { replace: true })
    })
  })
})
