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
  const mockOnProfileClick = vi.fn()
  const mockOnAccountSettingsClick = vi.fn()
  const mockOnLogoutClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements', () => {
    it('renders when open prop is true', () => {
      render(
        <TopMenuPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onProfileClick={mockOnProfileClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onLogoutClick={mockOnLogoutClick}
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
          onProfileClick={mockOnProfileClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onLogoutClick={mockOnLogoutClick}
        />
      )

      expect(screen.getByText(/マイページ/i)).toBeInTheDocument()
    })

    it('renders account settings menu item', () => {
      render(
        <TopMenuPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onProfileClick={mockOnProfileClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onLogoutClick={mockOnLogoutClick}
        />
      )

      expect(screen.getByText(/アカウント設定/i)).toBeInTheDocument()
    })

    it('renders logout menu item', () => {
      render(
        <TopMenuPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onProfileClick={mockOnProfileClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onLogoutClick={mockOnLogoutClick}
        />
      )

      expect(screen.getByText(/ログアウト/i)).toBeInTheDocument()
    })
  })

  describe('Menu Icons', () => {
    it('renders icons for each menu item', () => {
      const { container } = render(
        <TopMenuPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onProfileClick={mockOnProfileClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onLogoutClick={mockOnLogoutClick}
        />
      )

      // lucide-reactアイコンが存在することを確認
      const icons = container.querySelectorAll('svg')
      expect(icons.length).toBeGreaterThan(0)
    })
  })

  describe('Panel Behavior', () => {
    it('uses sheet component for slide-in animation', () => {
      const { container } = render(
        <TopMenuPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onProfileClick={mockOnProfileClick}
          onAccountSettingsClick={mockOnAccountSettingsClick}
          onLogoutClick={mockOnLogoutClick}
        />
      )

      // Sheetコンポーネントが使用されていることを確認
      // data-属性やrole属性で確認可能
      const dialog = container.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })
  })
})
