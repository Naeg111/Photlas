import { render, screen, cleanup, act } from '@testing-library/react'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { SPLASH_SCREEN_DURATION_MS } from './config/app'

/**
 * App コンポーネントのテスト
 * Issue#2 対応: ルーティング機能追加
 * Issue#25 対応: SplashScreen統合
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

describe('App', () => {
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

  it('renders MapView component on home page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    skipSplashScreen()
    expect(screen.getByTestId('google-map')).toBeInTheDocument()
  })

  it('renders all floating UI components on home page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    skipSplashScreen()
    expect(screen.getByRole('button', { name: '写真フィルター機能を開く' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ユーザーメニューを開く' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新しい写真を投稿する' })).toBeInTheDocument()
    expect(screen.getByTestId('category-buttons')).toBeInTheDocument()
  })

  it('renders RegisterPage when navigating to /register', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <App />
      </MemoryRouter>
    )
    skipSplashScreen()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('アカウント登録')
  })

  it('renders RegisterSuccessPage when navigating to /register/success', () => {
    render(
      <MemoryRouter initialEntries={['/register/success']}>
        <App />
      </MemoryRouter>
    )
    skipSplashScreen()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('登録完了')
    expect(screen.getByText('登録ありがとうございます！')).toBeInTheDocument()
  })

  it('renders 404 page for unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>
    )
    skipSplashScreen()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ページが見つかりません')
  })

  /**
   * Issue#25: SplashScreen統合テスト
   * アプリケーション起動時にSplashScreenを表示し、2秒後に非表示にする
   */
  describe('SplashScreen Integration', () => {
    it('displays SplashScreen on initial load', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      )
      expect(screen.getByText('Photlas')).toBeInTheDocument()
    })

    it('hides SplashScreen after 2 seconds', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      )
      expect(screen.getByText('Photlas')).toBeInTheDocument()
      skipSplashScreen()
      expect(screen.queryByText('Photlas')).not.toBeInTheDocument()
    })

    it('shows main content after SplashScreen disappears', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      )
      skipSplashScreen()
      expect(screen.getByTestId('google-map')).toBeInTheDocument()
    })
  })
})
