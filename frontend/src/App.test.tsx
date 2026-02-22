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
  on: vi.fn(),
  off: vi.fn(),
}

const MapMock = ({ children, onLoad }: any) => {
  if (onLoad) {
    onLoad({ target: mockMap })
  }
  return <div data-testid="mapbox-map">{children}</div>
}

vi.mock('react-map-gl', () => ({
  default: MapMock,
  Map: MapMock,
  Marker: ({ children }: any) => <div>{children}</div>,
}))

// Mapbox Search Box API のモック（InlineMapPicker用）
vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(() => ({
    suggest: vi.fn(),
    retrieve: vi.fn(),
  })),
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
      expect(screen.getByText('Photlas')).toBeInTheDocument()
    })

    it('hides SplashScreen after 2 seconds', () => {
      renderApp()
      expect(screen.getByText('Photlas')).toBeInTheDocument()
      skipSplashScreen()
      expect(screen.queryByText('Photlas')).not.toBeInTheDocument()
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
        expect(screen.getByRole('button', { name: /風景/ })).toBeInTheDocument()
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
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

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

    it('transitions from LoginRequiredDialog to SignUpDialog when signup button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

      // 投稿ボタンをクリックしてLoginRequiredDialogを開く
      const postButton = screen.getByRole('button', { name: /投稿/i })
      await user.click(postButton)

      await waitFor(() => {
        expect(screen.getByText('ログインが必要です')).toBeInTheDocument()
      })

      // 新規アカウント作成ボタンをクリック
      const signUpButton = screen.getByRole('button', { name: /新規アカウント作成/i })
      await user.click(signUpButton)

      // SignUpDialogが表示される
      await waitFor(() => {
        expect(screen.getByText(/表示名/i)).toBeInTheDocument()
      })
    })

    it('transitions from TopMenuPanel to LoginDialog when login is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

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

    it('transitions from TopMenuPanel to SignUpDialog when signup is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

      // メニューボタンをクリック
      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /新規アカウント作成/i })).toBeInTheDocument()
      })

      // 新規アカウント作成ボタンをクリック
      const signUpButton = screen.getByRole('button', { name: /新規アカウント作成/i })
      await user.click(signUpButton)

      // SignUpDialogが表示される
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウント作成' })).toBeInTheDocument()
      })
    })

    it('transitions from LoginDialog to PasswordResetDialog', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

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

    it('transitions from LoginDialog to SignUpDialog', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

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

      // 新規登録リンクをクリック
      const signUpLink = screen.getByText(/新規登録/i)
      await user.click(signUpLink)

      // SignUpDialogが表示される
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウント作成' })).toBeInTheDocument()
      })
    })

    it('transitions from SignUpDialog to LoginDialog', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

      // メニュー → 新規アカウント作成ダイアログを開く
      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /新規アカウント作成/i })).toBeInTheDocument()
      })

      const signUpButton = screen.getByRole('button', { name: /新規アカウント作成/i })
      await user.click(signUpButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウント作成' })).toBeInTheDocument()
      })

      // ログインリンクをクリック
      const loginLink = screen.getByText(/ログイン$/i)
      await user.click(loginLink)

      // LoginDialogが表示される
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
      })
    })
  })

  describe('Terms and Privacy Dialogs - 利用規約・プライバシーポリシー', () => {
    it('opens TermsOfServicePage when terms link is clicked from SignUpDialog', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

      // SignUpDialogを開く
      const postButton = screen.getByRole('button', { name: /投稿/i })
      await user.click(postButton)

      await waitFor(() => {
        expect(screen.getByText('ログインが必要です')).toBeInTheDocument()
      })

      const signUpButton = screen.getByRole('button', { name: /新規アカウント作成/i })
      await user.click(signUpButton)

      // SignUpDialogが表示される
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'アカウント作成' })).toBeInTheDocument()
      })

      // 利用規約リンクをクリック
      const termsLink = screen.getByText(/利用規約の全文を表示/i)
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
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

      const postButton = screen.getByRole('button', { name: /投稿/i })
      await user.click(postButton)

      // 認証済みなのでPhotoContributionDialogが表示される（LoginRequiredDialogではない）
      await waitFor(() => {
        expect(screen.getByText('写真を投稿')).toBeInTheDocument()
      })
      expect(screen.queryByText('ログインが必要です')).not.toBeInTheDocument()
    })

    it('shows authenticated menu items in TopMenuPanel', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      // 認証済みメニュー項目が表示される
      await waitFor(() => {
        expect(screen.getByText(/マイページ/)).toBeInTheDocument()
      })
      expect(screen.getByText(/行きたい場所リスト/)).toBeInTheDocument()
      expect(screen.getByText(/アカウント設定/)).toBeInTheDocument()
      expect(screen.getByText(/ログアウト/)).toBeInTheDocument()

      // 未認証メニュー項目は表示されない
      expect(screen.queryByRole('button', { name: /^ログイン$/i })).not.toBeInTheDocument()
      expect(screen.queryByText(/新規アカウント作成/)).not.toBeInTheDocument()
    })

    it('opens AccountSettingsDialog from TopMenuPanel', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp()
      skipSplashScreen()

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
})
