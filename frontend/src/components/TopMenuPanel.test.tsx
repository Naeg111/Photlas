import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TopMenuPanel } from './TopMenuPanel'
import { AuthProvider } from '../contexts/AuthContext'

/**
 * Issue#11: フロントエンドデザインのコード導入 - トップメニューパネル
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - スライドインアニメーションを持つパネル
 * - ログイン状態でマイページ・行きたい場所リスト・アカウント設定・ログアウトを表示
 * - ログアウト状態でログイン・新規アカウント作成を表示
 */

const renderWithProvider = (ui: JSX.Element) => {
  return render(<AuthProvider>{ui}</AuthProvider>)
}

describe('TopMenuPanel', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnMyPageClick = vi.fn()
  const mockOnFavoritesClick = vi.fn()
  const mockOnAccountSettingsClick = vi.fn()
  const mockOnAboutClick = vi.fn()
  const mockOnTermsClick = vi.fn()
  const mockOnPrivacyClick = vi.fn()
  const mockOnLoginClick = vi.fn()
  // Issue#104: onSignUpClick を削除
  const mockOnLogout = vi.fn()

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    isLoggedIn: true,
    onMyPageClick: mockOnMyPageClick,
    onFavoritesClick: mockOnFavoritesClick,
    onAccountSettingsClick: mockOnAccountSettingsClick,
    onAboutClick: mockOnAboutClick,
    onTermsClick: mockOnTermsClick,
    onPrivacyClick: mockOnPrivacyClick,
    onLoginClick: mockOnLoginClick,
    onLogout: mockOnLogout,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements - ログイン状態', () => {
    it('renders logged-in menu items', () => {
      renderWithProvider(<TopMenuPanel {...defaultProps} />)

      expect(screen.getByText(/Photlasとは？/)).toBeInTheDocument()
      expect(screen.getByText(/プロフィール/)).toBeInTheDocument()
      // 行きたい場所リストは一時非表示
      expect(screen.getByText(/アカウント設定/)).toBeInTheDocument()
      expect(screen.getByText(/利用規約/)).toBeInTheDocument()
      expect(screen.getByText(/プライバシーポリシー/)).toBeInTheDocument()
      expect(screen.getByText(/ログアウト/)).toBeInTheDocument()
    })

    it('does not render login/signup items when logged in', () => {
      renderWithProvider(<TopMenuPanel {...defaultProps} />)

      expect(screen.queryByText(/^ログイン$/)).not.toBeInTheDocument()
      expect(screen.queryByText(/新規アカウント作成/)).not.toBeInTheDocument()
    })
  })

  describe('UI Elements - ログアウト状態', () => {
    it('renders logged-out menu items', () => {
      renderWithProvider(<TopMenuPanel {...defaultProps} isLoggedIn={false} />)

      expect(screen.getByText(/Photlasとは？/)).toBeInTheDocument()
      expect(screen.getByText(/ログイン/)).toBeInTheDocument()
      // Issue#104: 「新規アカウント作成」ボタンを削除
      expect(screen.queryByText(/新規アカウント作成/)).not.toBeInTheDocument()
      expect(screen.getByText(/利用規約/)).toBeInTheDocument()
      expect(screen.getByText(/プライバシーポリシー/)).toBeInTheDocument()
    })

    it('does not render logged-in only items when logged out', () => {
      renderWithProvider(<TopMenuPanel {...defaultProps} isLoggedIn={false} />)

      expect(screen.queryByText(/マイページ/)).not.toBeInTheDocument()
      expect(screen.queryByText(/行きたい場所リスト/)).not.toBeInTheDocument()
      expect(screen.queryByText(/アカウント設定/)).not.toBeInTheDocument()
      expect(screen.queryByText(/ログアウト/)).not.toBeInTheDocument()
    })
  })

  describe('Panel Behavior', () => {
    it('uses sheet component for slide-in animation', () => {
      renderWithProvider(<TopMenuPanel {...defaultProps} />)

      // メニュー項目が表示されることでSheetコンポーネントが機能していることを確認
      expect(screen.getByText(/プロフィール/)).toBeInTheDocument()
    })
  })

  describe('行きたい場所リストの一時非表示', () => {
    it('ログイン時に「行きたい場所リスト」ボタンが表示されない', () => {
      renderWithProvider(<TopMenuPanel {...defaultProps} />)

      expect(screen.queryByText(/行きたい場所リスト/)).not.toBeInTheDocument()
    })
  })

  describe('ラベル変更', () => {
    it('「マイページ」ではなく「プロフィール」と表示される', () => {
      renderWithProvider(<TopMenuPanel {...defaultProps} />)

      expect(screen.getByText(/プロフィール/)).toBeInTheDocument()
      expect(screen.queryByText(/マイページ/)).not.toBeInTheDocument()
    })
  })
})
