import { render, screen, cleanup, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import App from './App'
import { SPLASH_SCREEN_DURATION_MS } from './config/app'

/**
 * App コンポーネントのテスト
 * Issue#28: App.tsx再構築と不要ファイル削除
 *
 * React Routerを削除し、モーダルベースのナビゲーションに移行
 */

// motion/react のモック（アニメーションを無効化）
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Google Maps APIのモック
const mockMap = {
  setZoom: vi.fn(),
  getZoom: vi.fn(() => 11),
  getCenter: vi.fn(() => ({ lat: () => 35.6585, lng: () => 139.7454 })),
  getBounds: vi.fn(() => ({
    getNorthEast: () => ({ lat: () => 35.7, lng: () => 139.8 }),
    getSouthWest: () => ({ lat: () => 35.6, lng: () => 139.7 }),
  })),
  addListener: vi.fn(() => ({ remove: vi.fn() })),
}

// @react-google-maps/api のモック
vi.mock('@react-google-maps/api', () => ({
  GoogleMap: ({ children, onLoad }: any) => {
    if (onLoad) {
      onLoad(mockMap)
    }
    return <div data-testid="google-map">{children}</div>
  },
  useLoadScript: () => ({
    isLoaded: true,
    loadError: undefined,
  }),
  OverlayViewF: ({ children }: any) => <div>{children}</div>,
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

/**
 * SplashScreenをスキップしてメインコンテンツを表示する
 * fake timersが有効な状態で呼び出す必要がある
 */
function skipSplashScreen() {
  act(() => {
    vi.advanceTimersByTime(SPLASH_SCREEN_DURATION_MS)
  })
}

describe('App - Issue#28: App.tsx再構築', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
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
      render(<App />)
      expect(screen.getByText('Photlas')).toBeInTheDocument()
    })

    it('hides SplashScreen after 2 seconds', () => {
      render(<App />)
      expect(screen.getByText('Photlas')).toBeInTheDocument()
      skipSplashScreen()
      expect(screen.queryByText('Photlas')).not.toBeInTheDocument()
    })

    it('shows main content after SplashScreen disappears', () => {
      render(<App />)
      skipSplashScreen()
      expect(screen.getByTestId('google-map')).toBeInTheDocument()
    })
  })

  describe('Main Layout - メインレイアウト', () => {
    it('renders MapView as main content', () => {
      render(<App />)
      skipSplashScreen()
      expect(screen.getByTestId('google-map')).toBeInTheDocument()
    })

    it('renders filter button in top-left area', () => {
      render(<App />)
      skipSplashScreen()
      // Issue#28: フィルターボタンはSlidersHorizontalアイコンを使用
      const filterButton = screen.getByRole('button', { name: /フィルター/i })
      expect(filterButton).toBeInTheDocument()
    })

    it('renders menu button in top-right area', () => {
      render(<App />)
      skipSplashScreen()
      // Issue#28: メニューボタンはMenuアイコンを使用
      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      expect(menuButton).toBeInTheDocument()
    })

    it('renders post button (FAB) in bottom-right area', () => {
      render(<App />)
      skipSplashScreen()
      // Issue#28: 投稿ボタンはPlusアイコンを使用
      const postButton = screen.getByRole('button', { name: /投稿/i })
      expect(postButton).toBeInTheDocument()
    })
  })

  describe('Dialog State Management - ダイアログ状態管理', () => {
    it('opens FilterPanel when filter button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      skipSplashScreen()

      const filterButton = screen.getByRole('button', { name: /フィルター/i })
      await user.click(filterButton)

      // FilterPanelが表示される
      await waitFor(() => {
        expect(screen.getByText(/カテゴリ/)).toBeInTheDocument()
      })
    })

    it('opens TopMenuPanel when menu button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
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
      render(<App />)
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
      render(<App />)
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

      // LoginDialogが表示される
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/メールアドレス/i)).toBeInTheDocument()
      })
    })

    it('transitions from LoginRequiredDialog to SignUpDialog when signup button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
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
      render(<App />)
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

      // LoginDialogが表示される
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/メールアドレス/i)).toBeInTheDocument()
      })
    })

    it('transitions from LoginDialog to SignUpDialog when signup link is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      skipSplashScreen()

      // メニューからログインダイアログを開く
      const menuButton = screen.getByRole('button', { name: /メニュー/i })
      await user.click(menuButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ログイン/i })).toBeInTheDocument()
      })

      const loginButton = screen.getByRole('button', { name: /ログイン/i })
      await user.click(loginButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/メールアドレス/i)).toBeInTheDocument()
      })

      // 新規登録リンクをクリック
      const signUpLink = screen.getByText(/アカウントをお持ちでない方/i)
      await user.click(signUpLink)

      // SignUpDialogが表示される
      await waitFor(() => {
        expect(screen.getByText(/表示名/i)).toBeInTheDocument()
      })
    })

    it('transitions from SignUpDialog to LoginDialog when login link is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      skipSplashScreen()

      // 投稿ボタンからLoginRequiredDialogを開き、SignUpDialogへ
      const postButton = screen.getByRole('button', { name: /投稿/i })
      await user.click(postButton)

      await waitFor(() => {
        expect(screen.getByText('ログインが必要です')).toBeInTheDocument()
      })

      const signUpButton = screen.getByRole('button', { name: /新規アカウント作成/i })
      await user.click(signUpButton)

      await waitFor(() => {
        expect(screen.getByText(/表示名/i)).toBeInTheDocument()
      })

      // ログインリンクをクリック
      const loginLink = screen.getByText(/既にアカウントをお持ちの方/i)
      await user.click(loginLink)

      // LoginDialogが表示される
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/メールアドレス/i)).toBeInTheDocument()
      })
    })
  })

  describe('Terms and Privacy Dialogs - 利用規約・プライバシーポリシー', () => {
    it('opens TermsOfServicePage when terms link is clicked from SignUpDialog', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      skipSplashScreen()

      // SignUpDialogを開く
      const postButton = screen.getByRole('button', { name: /投稿/i })
      await user.click(postButton)

      await waitFor(() => {
        expect(screen.getByText('ログインが必要です')).toBeInTheDocument()
      })

      const signUpButton = screen.getByRole('button', { name: /新規アカウント作成/i })
      await user.click(signUpButton)

      await waitFor(() => {
        expect(screen.getByText(/利用規約/i)).toBeInTheDocument()
      })

      // 利用規約リンクをクリック
      const termsLink = screen.getByText(/利用規約全文を読む/i)
      await user.click(termsLink)

      // TermsOfServicePageが表示される
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '利用規約' })).toBeInTheDocument()
      })
    })
  })

  describe('No React Router - React Router不使用', () => {
    it('renders without MemoryRouter wrapper', () => {
      // Issue#28: AppはReact Routerなしで動作する
      render(<App />)
      skipSplashScreen()
      expect(screen.getByTestId('google-map')).toBeInTheDocument()
    })

    it('does not use URL-based navigation', () => {
      render(<App />)
      skipSplashScreen()
      // URLが変化しないことを確認（モック環境では常にlocation.pathnameは初期値）
      expect(window.location.pathname).toBe('/')
    })
  })
})
