import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

/**
 * App コンポーネントのテスト
 * Issue#2 対応: ルーティング機能追加
 */

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

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    sessionStorageMock.getItem.mockReturnValue(null)
  })
  afterEach(() => {
    // 確実なDOMクリーンアップ
    cleanup()
    document.body.innerHTML = ''
  })

  it('renders MapView component on home page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    // MapViewコンポーネントが地図を表示していることを確認
    // Google Mapのdata-testidで確認
    expect(screen.getByTestId('google-map')).toBeInTheDocument()
  })

  it('renders all floating UI components on home page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    // フローティング要素の確認
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
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('アカウント登録')
  })

  it('renders RegisterSuccessPage when navigating to /register/success', () => {
    render(
      <MemoryRouter initialEntries={['/register/success']}>
        <App />
      </MemoryRouter>
    )
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('登録完了')
    expect(screen.getByText('登録ありがとうございます！')).toBeInTheDocument()
  })

  it('renders 404 page for unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>
    )
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ページが見つかりません')
  })
})