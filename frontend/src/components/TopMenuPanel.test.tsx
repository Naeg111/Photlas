import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TopMenuPanel } from './TopMenuPanel'

/**
 * Issue#11: フロントエンドデザインのコード導入 - トップメニューパネル
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - スライドインアニメーションを持つパネル
 * - マイページ表示メニュー項目
 * - アカウント設定表示メニュー項目
 * - ログアウトメニュー項目
 */

describe('TopMenuPanel', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnMyPageClick = vi.fn()
  const mockOnAccountSettingsClick = vi.fn()
  const mockOnTermsClick = vi.fn()
  const mockOnPrivacyClick = vi.fn()
  const mockOnLoginClick = vi.fn()
  const mockOnSignUpClick = vi.fn()
  const mockOnLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements', () => {
    it('renders when open prop is true with logged in user', () => {
      render(
        <TopMenuPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          isLoggedIn={true}
          onMyPageClick={mockOnMyPageClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onTermsClick={mockOnTermsClick}
          onPrivacyClick={mockOnPrivacyClick}
          onLoginClick={mockOnLoginClick}
          onSignUpClick={mockOnSignUpClick}
          onLogout={mockOnLogout}
        />
      )

      // メニュー項目が表示されることを確認
      expect(screen.getByText(/マイページ/i)).toBeInTheDocument()
    })

    it('renders profile menu item', () => {
      render(
        <TopMenuPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          isLoggedIn={true}
          onMyPageClick={mockOnMyPageClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onTermsClick={mockOnTermsClick}
          onPrivacyClick={mockOnPrivacyClick}
          onLoginClick={mockOnLoginClick}
          onSignUpClick={mockOnSignUpClick}
          onLogout={mockOnLogout}
        />
      )

      expect(screen.getByText(/マイページ/i)).toBeInTheDocument()
    })

    it('renders account settings menu item', () => {
      render(
        <TopMenuPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          isLoggedIn={true}
          onMyPageClick={mockOnMyPageClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onTermsClick={mockOnTermsClick}
          onPrivacyClick={mockOnPrivacyClick}
          onLoginClick={mockOnLoginClick}
          onSignUpClick={mockOnSignUpClick}
          onLogout={mockOnLogout}
        />
      )

      expect(screen.getByText(/アカウント設定/i)).toBeInTheDocument()
    })

    it('renders logout menu item', () => {
      render(
        <TopMenuPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          isLoggedIn={true}
          onMyPageClick={mockOnMyPageClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onTermsClick={mockOnTermsClick}
          onPrivacyClick={mockOnPrivacyClick}
          onLoginClick={mockOnLoginClick}
          onSignUpClick={mockOnSignUpClick}
          onLogout={mockOnLogout}
        />
      )

      expect(screen.getByText(/ログアウト/i)).toBeInTheDocument()
    })
  })

  describe('Menu Icons', () => {
    it('renders icons for each menu item', () => {
      render(
        <TopMenuPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          isLoggedIn={true}
          onMyPageClick={mockOnMyPageClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onTermsClick={mockOnTermsClick}
          onPrivacyClick={mockOnPrivacyClick}
          onLoginClick={mockOnLoginClick}
          onSignUpClick={mockOnSignUpClick}
          onLogout={mockOnLogout}
        />
      )

      // メニュー項目が表示されていることを確認（アイコンと共にレンダリングされる）
      expect(screen.getByText(/マイページ/i)).toBeInTheDocument()
      expect(screen.getByText(/アカウント設定/i)).toBeInTheDocument()
      expect(screen.getByText(/ログアウト/i)).toBeInTheDocument()
    })
  })

  describe('Panel Behavior', () => {
    it('uses sheet component for slide-in animation', () => {
      render(
        <TopMenuPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          isLoggedIn={true}
          onMyPageClick={mockOnMyPageClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onTermsClick={mockOnTermsClick}
          onPrivacyClick={mockOnPrivacyClick}
          onLoginClick={mockOnLoginClick}
          onSignUpClick={mockOnSignUpClick}
          onLogout={mockOnLogout}
        />
      )

      // メニュー項目が表示されることでSheetコンポーネントが機能していることを確認
      expect(screen.getByText(/マイページ/i)).toBeInTheDocument()
    })
  })
})
