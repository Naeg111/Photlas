import { render, screen, cleanup, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { SPLASH_SCREEN_DURATION_MS } from './config/app'

/**
 * App コンポーネントのテスト
 * Issue#28: App.tsx再構築と不要ファイル削除
 *
 * モーダルベースのナビゲーションを使用
 */

// motion/react のモック（アニメーションを無効化）
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mapbox GL JS (react-map-gl) のモック
const { mockMap, MapMock } = vi.hoisted(() => {
  const mockMap = {
    setZoom: vi.fn(),
    getZoom: vi.fn(() => 11),
    getCenter: vi.fn(() => ({ lng: 139.7454, lat: 35.6585 })),
    getBounds: vi.fn(() => ({
      getNorth: () => 35.7,
      getSouth: () => 35.6,
      getEast: () => 139.8,
      getWest: () => 139.7,
    })),
    flyTo: vi.fn(),
    setLanguage: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    addImage: vi.fn(),
    hasImage: vi.fn(() => false),
    getSource: vi.fn(() => ({ setData: vi.fn() })),
    removeSource: vi.fn(),
    removeLayer: vi.fn(),
    getLayer: vi.fn(() => undefined),
    setLayoutProperty: vi.fn(),
  }

  const MapMock = ({ children, onLoad }: any) => {
    if (onLoad) {
      onLoad({ target: mockMap })
    }
    return <div data-testid="mapbox-map">{children}</div>
  }

  return { mockMap, MapMock }
})

vi.mock('react-map-gl', () => ({
  default: MapMock,
  Map: MapMock,
  Marker: ({ children }: any) => <div>{children}</div>,
  AttributionControl: () => null,
}))

// Mapbox Search/Geocoding API のモック
vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(() => ({
    suggest: vi.fn(),
    retrieve: vi.fn(),
  })),
  GeocodingCore: vi.fn(() => ({
    forward: vi.fn(),
  })),
  SessionToken: vi.fn(),
}))

// fetch APIのモック
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  }) as any
)

// localStorage と sessionStorage のモック
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

// Image コンストラクタのモック（@radix-ui/react-avatar用）
class MockImage {
  src: string = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
}
vi.stubGlobal('Image', MockImage)

/**
 * SplashScreenをスキップしてメインコンテンツを表示する
 * fake timersが有効な状態で呼び出す必要がある
 */
function skipSplashScreen() {
  act(() => {
    vi.advanceTimersByTime(SPLASH_SCREEN_DURATION_MS)
  })
}

/**
 * Radix UIのPresenceコンポーネントがfake timersで無限ループするため、
 * ダイアログ操作を行うテストではスプラッシュ画面スキップ後にreal timersへ切り替える。
 * 戻り値のuserEventインスタンスをダイアログ操作に使用すること。
 */
function switchToRealTimers() {
  vi.useRealTimers()
  return userEvent.setup()
}

/**
 * AppをMemoryRouterでラップしてレンダリングする
 */
function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  )
}

describe('App - Issue#28: App.tsx再構築', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorageMock.getItem.mockReturnValue(null)
    sessionStorageMock.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    document.body.innerHTML = ''
  })

  describe('SplashScreen Integration - スプラッシュ画面', () => {
    it('displays SplashScreen on initial load', () => {
      renderApp()
      expect(screen.getByTestId('splash-screen')).toBeInTheDocument()
    })

    it('hides SplashScreen after 2 seconds', () => {
      renderApp()
      expect(screen.getByTestId('splash-screen')).toBeInTheDocument()
      skipSplashScreen()
      expect(screen.queryByTestId('splash-screen')).not.toBeInTheDocument()
    })

    it('shows main content after SplashScreen disappears', () => {
      renderApp()
      skipSplashScreen()
      expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
    })
  })

  describe('Main Layout - メインレイアウト', () => {
    it('renders MapView as main content', () => {
      renderApp()
      skipSplashScreen()
      expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
    })

    it('renders filter button in top-left area', () => {
      renderApp()
      skipSplashScreen()
      // Issue#28: フィルターボタンはSlidersHorizontalアイコンを使用
      const filterButton = screen.getByRole('button', { name: /フィルター/i })
      expect(filterButton).toBeInTheDocument()
    })

    it('renders menu button in top-right area', () => {
      renderApp()
      skipSplashScreen()
      // Issue#28: メニューボタンはMenuアイコンを使用
      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      expect(menuButton).toBeInTheDocument()
    })

    it('renders post button (FAB) in bottom-right area', () => {
      renderApp()
      skipSplashScreen()
      // Issue#28: 投稿ボタンはPlusアイコンを使用
      const postButton = screen.getByRole('button', { name: /投稿/i })
      expect(postButton).toBeInTheDocument()
    })

    it('Issue#70 - フィルター/メニューボタンのコンテナがsafe-area-inset-topを考慮している', () => {
      renderApp()
      skipSplashScreen()
      const filterButton = screen.getByRole('button', { name: /フィルター/i })
      const container = filterButton.parentElement
      expect(container?.className).toContain('safe-area-inset-top')
    })
  })

  describe('Dialog State Management - ダイアログ状態管理', () => {
    it('opens FilterPanel when filter button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

      const filterButton = screen.getByRole('button', { name: /フィルター/i })
      await user.click(filterButton)

      // FilterPanelが表示される（カテゴリボタンの存在で確認）
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /自然風景/ })).toBeInTheDocument()
      })
    })

    it('opens TopMenuPanel when menu button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      // TopMenuPanelが表示される（ログインボタンがある）
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ログイン/i })).toBeInTheDocument()
      })
    })

    it('opens LoginRequiredDialog when post button is clicked while not authenticated', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

      const postButton = screen.getByRole('button', { name: /投稿/i })
      await user.click(postButton)

      // 未ログイン時はLoginRequiredDialogが表示される
      await waitFor(() => {
        expect(screen.getByText('ログインが必要です')).toBeInTheDocument()
      })
    })
  })

  describe('Dialog Transitions - ダイアログ間遷移', () => {
    it('transitions from LoginRequiredDialog to LoginDialog when login button is clicked', async () => {
      renderApp()
      skipSplashScreen()
      const user = switchToRealTimers()

      // 投稿ボタンをクリックしてLoginRequiredDialogを開く
      const postButton = screen.getByRole('button', { name: /投稿/i })
      await user.click(postButton)

      await waitFor(() => {
        expect(screen.getByText('ログインが必要です')).toBeInTheDocument()
      })

      // ログインボタンをクリック
      const loginButton = screen.getByRole('button', { name: 'ログイン' })
      await user.click(loginButton)

      // LoginDialogが表示される（ログインダイアログのタイトル）
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
      })
    })

    it('[Phase 8r-3] transitions from LoginRequiredDialog to SignUpMethodDialog when signup button is clicked', async () => {
      renderApp()
      skipSplashScreen()
      const user = switchToRealTimers()

      // 投稿ボタンをクリックしてLoginRequiredDialogを開く
      const postButton = screen.getByRole('button', { name: /投稿/i })
      await user.click(postButton)

      await waitFor(() => {
        expect(screen.getByText('ログインが必要です')).toBeInTheDocument()
      })

      // 新規アカウント作成ボタンをクリック
      const signUpButton = screen.getByRole('button', { name: /新規アカウント作成/i })
      await user.click(signUpButton)

      // Q1 改訂後: OAuth 有無に関わらず SignUpMethodDialog が最初に表示される
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウント登録方法を選択' })).toBeInTheDocument()
      })
    })

    it('transitions from TopMenuPanel to LoginDialog when login is clicked', async () => {
      renderApp()
      skipSplashScreen()
      const user = switchToRealTimers()

      // メニューボタンをクリック
      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ログイン/i })).toBeInTheDocument()
      })

      // ログインボタンをクリック
      const loginButton = screen.getByRole('button', { name: /ログイン/i })
      await user.click(loginButton)

      // LoginDialogが表示される（ログインダイアログのタイトル）
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
      })
    })

    it('[Phase 8r-3] transitions from TopMenuPanel to SignUpMethodDialog when signup is clicked', async () => {
      renderApp()
      skipSplashScreen()
      const user = switchToRealTimers()

      // メニューボタンをクリック
      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /新規アカウント作成/i })).toBeInTheDocument()
      })

      // 新規アカウント作成ボタンをクリック
      const signUpButton = screen.getByRole('button', { name: /新規アカウント作成/i })
      await user.click(signUpButton)

      // Q1 改訂後: SignUpMethodDialog が最初に表示される
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウント登録方法を選択' })).toBeInTheDocument()
      })
    })

    it('transitions from LoginDialog to PasswordResetDialog', async () => {
      renderApp()
      skipSplashScreen()
      const user = switchToRealTimers()

      // メニュー → ログインダイアログを開く
      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ログイン/i })).toBeInTheDocument()
      })

      const loginButton = screen.getByRole('button', { name: /ログイン/i })
      await user.click(loginButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
      })

      // パスワードをお忘れですか？リンクをクリック
      const resetLink = screen.getByText(/パスワードをお忘れですか？/i)
      await user.click(resetLink)

      // PasswordResetDialogが表示される
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /パスワードリセット/i })).toBeInTheDocument()
      })
    })

    it('[Phase 8r-3] transitions from LoginDialog to SignUpMethodDialog（Q1 改訂）', async () => {
      renderApp()
      skipSplashScreen()
      const user = switchToRealTimers()

      // メニュー → ログインダイアログを開く
      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ログイン/i })).toBeInTheDocument()
      })

      const loginButton = screen.getByRole('button', { name: /ログイン/i })
      await user.click(loginButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
      })

      // 「新規登録」リンクをクリック → SignUpMethodDialog が開く（旧: SignUpDialog）
      const signUpLink = screen.getByText(/新規登録/i)
      await user.click(signUpLink)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウント登録方法を選択' })).toBeInTheDocument()
      })
    })

    it('[Phase 8r-3] transitions from SignUpDialog to LoginDialog（Method → メール → SignUp → ログイン）', async () => {
      renderApp()
      skipSplashScreen()
      const user = switchToRealTimers()

      // メニュー → 新規アカウント作成ボタン → SignUpMethodDialog が開く
      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /新規アカウント作成/i })).toBeInTheDocument()
      })

      const signUpButton = screen.getByRole('button', { name: /新規アカウント作成/i })
      await user.click(signUpButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウント登録方法を選択' })).toBeInTheDocument()
      })

      // 「メールアドレスで登録」を押して SignUpDialog へ遷移
      const emailBtn = screen.getByRole('button', { name: 'メールアドレスで登録' })
      await user.click(emailBtn)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウントを新規登録' })).toBeInTheDocument()
      })

      // SignUpDialog 内のログインリンクをクリック
      const loginLink = screen.getByText(/ログイン$/i)
      await user.click(loginLink)

      // LoginDialog が表示される
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
      })
    })
  })

  describe('Terms and Privacy Dialogs - 利用規約・プライバシーポリシー', () => {
    it('opens TermsOfServicePage when terms link is clicked from SignUpDialog', async () => {
      renderApp()
      skipSplashScreen()
      const user = switchToRealTimers()

      // SignUpDialogを開く
      const postButton = screen.getByRole('button', { name: /投稿/i })
      await user.click(postButton)

      await waitFor(() => {
        expect(screen.getByText('ログインが必要です')).toBeInTheDocument()
      })

      const signUpButton = screen.getByRole('button', { name: /新規アカウント作成/i })
      await user.click(signUpButton)

      // [Phase 8r-3] SignUpMethodDialog が最初に表示される → 「メールアドレスで登録」で SignUpDialog へ
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウント登録方法を選択' })).toBeInTheDocument()
      })
      const emailBtn = screen.getByRole('button', { name: 'メールアドレスで登録' })
      await user.click(emailBtn)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウントを新規登録' })).toBeInTheDocument()
      })

      // 利用規約リンクをクリック
      const termsLink = screen.getByRole('link', { name: '利用規約' })
      await user.click(termsLink)

      // TermsOfServicePageが表示される
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '利用規約' })).toBeInTheDocument()
      })
    })
  })

  describe('Routing - ルーティング', () => {
    it('renders main content at root path', () => {
      renderApp(['/'])
      skipSplashScreen()
      expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
    })
  })

  describe('Authenticated User - 認証済みユーザー', () => {
    beforeEach(() => {
      // 認証済み状態をシミュレート
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') return 'fake-token'
        if (key === 'auth_user') return JSON.stringify({ userId: 1, email: 'test@example.com', username: 'testuser', role: 'user' })
        return null
      })
    })

    it('opens PhotoContributionDialog when post button is clicked while authenticated', async () => {
      renderApp()
      skipSplashScreen()
      const user = switchToRealTimers()

      const postButton = screen.getByRole('button', { name: /投稿/i })
      await user.click(postButton)

      // 認証済みなのでPhotoContributionDialogが表示される（LoginRequiredDialogではない）
      await waitFor(() => {
        expect(screen.getByText('写真を投稿')).toBeInTheDocument()
      })
      expect(screen.queryByText('ログインが必要です')).not.toBeInTheDocument()
    })

    it('shows authenticated menu items in TopMenuPanel', async () => {
      renderApp()
      skipSplashScreen()
      const user = switchToRealTimers()

      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      // 認証済みメニュー項目が表示される
      await waitFor(() => {
        expect(screen.getByText(/プロフィール/)).toBeInTheDocument()
      })
      // 行きたい場所リストは一時非表示
      expect(screen.getByText(/アカウント設定/)).toBeInTheDocument()
      expect(screen.getByText(/ログアウト/)).toBeInTheDocument()

      // 未認証メニュー項目は表示されない
      expect(screen.queryByRole('button', { name: /^ログイン$/i })).not.toBeInTheDocument()
      expect(screen.queryByText(/新規アカウント作成/)).not.toBeInTheDocument()
    })

    it('opens AccountSettingsDialog from TopMenuPanel', async () => {
      renderApp()
      skipSplashScreen()
      const user = switchToRealTimers()

      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText(/アカウント設定/)).toBeInTheDocument()
      })

      const accountSettingsButton = screen.getByText(/アカウント設定/)
      await user.click(accountSettingsButton)

      // AccountSettingsDialogが表示される
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウント設定' })).toBeInTheDocument()
      })
    })
  })

  /**
   * Issue#99: アカウントリンク確認フロー統合テスト
   *
   * OAuthCallbackPage が `/` に linkConfirmationToken / provider 付き state で
   * 遷移してきた場合、App.tsx は LinkAccountConfirmDialog を開く。
   * これは Issue#81 で実装漏れていたフローで、Issue#99 で修正対象。
   */
  describe('Issue#99: アカウントリンク確認フロー', () => {
    function renderAppWithLinkState(state: {
      linkConfirmationToken: string
      provider: string
    }) {
      return render(
        <MemoryRouter
          initialEntries={[{ pathname: '/', state }]}
        >
          <App />
        </MemoryRouter>
      )
    }

    it('location.state.linkConfirmationToken があると LinkAccountConfirmDialog が開く（Google）', async () => {
      renderAppWithLinkState({
        linkConfirmationToken: 'link-token-xyz',
        provider: 'GOOGLE',
      })
      skipSplashScreen()

      await waitFor(() => {
        expect(screen.getByText('既存アカウントとの連携確認')).toBeInTheDocument()
      })
      // 説明文（DialogDescription）に Google が含まれる
      // Cookie バナー等にも "Google" が出る可能性があるため、ダイアログ内の存在のみ検証
      const descriptions = screen.getAllByText(/Google/)
      expect(descriptions.length).toBeGreaterThan(0)
    })

    it('location.state.linkConfirmationToken があると LinkAccountConfirmDialog が開く（LINE）', async () => {
      renderAppWithLinkState({
        linkConfirmationToken: 'link-token-abc',
        provider: 'LINE',
      })
      skipSplashScreen()

      await waitFor(() => {
        expect(screen.getByText('既存アカウントとの連携確認')).toBeInTheDocument()
      })
      // 説明文に LINE が含まれる
      const description = screen.getAllByText(/LINE/)
      expect(description.length).toBeGreaterThan(0)
    })

    it('location.state.linkConfirmationToken がない場合、LinkAccountConfirmDialog は開かない', async () => {
      renderApp() // 通常の '/' マウント
      skipSplashScreen()

      // 初期表示完了まで待つ（マップが表示される）
      await waitFor(() => {
        expect(screen.queryByText('既存アカウントとの連携確認')).not.toBeInTheDocument()
      })
    })
  })

  /**
   * Issue#99: OAuth 新規登録直後の仮ユーザー名設定ダイアログ表示。
   * OAuthCallbackPage が `/?requires_username_setup=1` に遷移してきた場合、
   * App.tsx で {@link UsernameSetupDialog} を開くべき（Issue#81 の実装漏れ）。
   *
   * テスト前提: 認証済みユーザーが localStorage に存在することをモックする。
   */
  describe('Issue#99: OAuth 新規登録の仮ユーザー名設定ダイアログ', () => {
    function renderAppAtPath(path: string) {
      return render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      )
    }

    function setAuthenticatedUser() {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') return 'test-jwt-token'
        if (key === 'auth_user') {
          return JSON.stringify({
            userId: 1,
            username: 'user_abc1234',
            email: 'oauth@example.com',
            role: 'USER',
            language: 'ja',
          })
        }
        return null
      })
    }

    it('?requires_username_setup=1 があると UsernameSetupDialog が開く', async () => {
      setAuthenticatedUser()
      renderAppAtPath('/?requires_username_setup=1')
      skipSplashScreen()

      await waitFor(() => {
        expect(screen.getByText('表示名を設定')).toBeInTheDocument()
      })
    })

    it('?requires_username_setup=1 がない場合、UsernameSetupDialog は開かない', async () => {
      setAuthenticatedUser()
      renderAppAtPath('/')
      skipSplashScreen()

      // 初期表示完了まで待つ
      await waitFor(() => {
        expect(screen.queryByText('表示名を設定')).not.toBeInTheDocument()
      })
    })

    it('未認証時は ?requires_username_setup=1 でも UsernameSetupDialog は開かない', async () => {
      // localStorage は空（setAuthenticatedUser を呼ばない）
      renderAppAtPath('/?requires_username_setup=1')
      skipSplashScreen()

      await waitFor(() => {
        expect(screen.queryByText('表示名を設定')).not.toBeInTheDocument()
      })
    })
  })
})
