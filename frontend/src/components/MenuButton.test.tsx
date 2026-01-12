import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import MenuButton from './MenuButton'

/**
 * MenuButton コンポーネントのテスト
 * TDD Red-Green-Refactor サイクルでの開発
 *
 * Issue#1 要件:
 * - メニューボタンの表示
 * - 右上に配置
 * - クリック可能
 *
 * Issue#20 要件:
 * - ドロップダウンメニューの表示
 * - アカウント設定メニュー項目
 * - AccountSettingsDialog の統合
 *
 * Note: ドロップダウンメニューとAccountSettingsDialogの統合テストは、
 * Radix UIのポータル実装の制約によりJSDOM環境では正しく動作しないため、
 * E2Eテストで確認することを推奨します。
 * AccountSettingsDialog自体の機能テストはAccountSettingsDialog.test.tsxで
 * 21個のテストケースにより網羅的にテストされています。
 */

// AuthContext のモック
const mockUser = {
  username: 'testuser',
  email: 'test@example.com',
  role: 'USER',
}

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    getAuthToken: () => 'mock-token',
  }),
}))

// useNavigate のモック
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// fetch API のモック
globalThis.fetch = vi.fn() as any

// sonner (toast) のモック
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const MockedMenuButton = () => (
  <BrowserRouter>
    <MenuButton />
  </BrowserRouter>
)

describe('MenuButton', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('Basic UI - Issue#1', () => {
    it('renders menu button', () => {
      render(<MockedMenuButton />)
      expect(screen.getByRole('button', { name: /メニュー/i })).toBeInTheDocument()
    })

    it('displays correct text', () => {
      render(<MockedMenuButton />)
      expect(screen.getByRole('button', { name: /メニュー/i })).toHaveTextContent('メニュー')
    })

    it('is clickable', () => {
      render(<MockedMenuButton />)
      const button = screen.getByRole('button', { name: /メニュー/i })
      expect(button).not.toBeDisabled()
    })

    it('has correct accessibility attributes', () => {
      render(<MockedMenuButton />)
      const button = screen.getByRole('button', { name: /メニュー/i })
      expect(button).toHaveAttribute('aria-label', 'ユーザーメニューを開く')
      expect(button).toHaveAttribute('title', 'アカウント設定やその他の機能にアクセス')
    })
  })

  describe('Component Integration - Issue#20', () => {
    it('renders DropdownMenu trigger', () => {
      render(<MockedMenuButton />)
      const button = screen.getByRole('button', { name: /メニュー/i })
      expect(button).toHaveAttribute('aria-haspopup', 'menu')
    })

    it('renders with user authenticated', () => {
      render(<MockedMenuButton />)
      // Button should render when user is authenticated
      expect(screen.getByRole('button', { name: /メニュー/i })).toBeInTheDocument()
    })
  })
})
