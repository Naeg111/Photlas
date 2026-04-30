import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import i18n from 'i18next'
import { PrivacyPolicyPage } from './PrivacyPolicyPage'

/**
 * PrivacyPolicyPage コンポーネントのテスト
 * Issue#52: プライバシーポリシーの文面改訂
 * Issue#101: 多言語対応（ja / en / ko / zh-CN / zh-TW）+ ハードコード日本語の i18n 化
 */

describe('PrivacyPolicyPage', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements - UI要素', () => {
    it('renders dialog when open prop is true', () => {
      render(<PrivacyPolicyPage {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not render dialog when open prop is false', () => {
      render(<PrivacyPolicyPage {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders dialog title', () => {
      render(<PrivacyPolicyPage {...defaultProps} />)

      expect(screen.getByRole('heading', { name: 'プライバシーポリシー' })).toBeInTheDocument()
    })

    it('renders all required sections', () => {
      render(<PrivacyPolicyPage {...defaultProps} />)

      expect(screen.getByText(/第1条（基本方針）/)).toBeInTheDocument()
      expect(screen.getByText(/第2条（収集する情報）/)).toBeInTheDocument()
      expect(screen.getByText(/第3条（情報の収集方法）/)).toBeInTheDocument()
      expect(screen.getByText(/第4条（情報の利用目的）/)).toBeInTheDocument()
      expect(screen.getByText(/第5条（情報の保存・セキュリティ）/)).toBeInTheDocument()
      expect(screen.getByText(/第6条（第三者提供・外部サービスの利用）/)).toBeInTheDocument()
      expect(screen.getByText(/第7条（EXIF情報の取り扱い）/)).toBeInTheDocument()
      expect(screen.getByText(/第8条（コンテンツの自動審査）/)).toBeInTheDocument()
      expect(screen.getByText(/第9条（Cookie等の利用）/)).toBeInTheDocument()
      expect(screen.getByText(/第10条（個人情報の開示・訂正・削除）/)).toBeInTheDocument()
      expect(screen.getByText(/第11条（アカウント削除時のデータ取り扱い）/)).toBeInTheDocument()
    })

    it('renders contact email address', () => {
      render(<PrivacyPolicyPage {...defaultProps} />)

      const emailElements = screen.getAllByText(/support@photlas.jp/)
      expect(emailElements.length).toBeGreaterThan(0)
    })

    it('renders external service privacy policy links', () => {
      render(<PrivacyPolicyPage {...defaultProps} />)

      const links = screen.getAllByRole('link', { name: 'こちら' })
      expect(links.length).toBe(3)
      expect(links[0]).toHaveAttribute('href', 'https://www.mapbox.com/legal/privacy')
      expect(links[1]).toHaveAttribute('href', 'https://policies.google.com/privacy')
      expect(links[2]).toHaveAttribute('href', 'https://sentry.io/privacy/')
    })

    it('renders effective date', () => {
      render(<PrivacyPolicyPage {...defaultProps} />)

      expect(screen.getByText(/制定日/)).toBeInTheDocument()
    })
  })

  /**
   * Issue#101: 5 言語対応 + ハードコード日本語の i18n 化のテスト。
   */
  describe('Issue#101 - 多言語対応', () => {
    afterEach(async () => {
      // 他テストへの影響を防ぐため ja に戻す
      await i18n.changeLanguage('ja')
    })

    it('言語が ja の場合、日本語コンテンツが表示される', async () => {
      await i18n.changeLanguage('ja')
      render(<PrivacyPolicyPage {...defaultProps} />)
      expect(screen.getByText(/第1条（基本方針）/)).toBeInTheDocument()
    })

    it('言語が en の場合、英語コンテンツが表示される', async () => {
      await i18n.changeLanguage('en')
      render(<PrivacyPolicyPage {...defaultProps} />)
      // 英語コンテンツに含まれる Article XX 表記が複数存在することを確認
      expect(screen.getAllByText(/Article \d+/).length).toBeGreaterThan(0)
    })

    it('言語が ko の場合、韓国語コンテンツが表示される', async () => {
      await i18n.changeLanguage('ko')
      render(<PrivacyPolicyPage {...defaultProps} />)
      // 韓国語版に「제1조」(第1条) が含まれる
      expect(screen.getAllByText(/제1조/).length).toBeGreaterThan(0)
    })

    it('言語が zh-CN の場合、簡体字コンテンツが表示される', async () => {
      await i18n.changeLanguage('zh-CN')
      render(<PrivacyPolicyPage {...defaultProps} />)
      // 簡体字版に「第1条」(同形だが文脈で簡体字) が含まれる
      expect(screen.getAllByText(/第1条|第一条/).length).toBeGreaterThan(0)
    })

    it('言語が zh-TW の場合、繁体字コンテンツが表示される', async () => {
      await i18n.changeLanguage('zh-TW')
      render(<PrivacyPolicyPage {...defaultProps} />)
      expect(screen.getAllByText(/第1條|第一條/).length).toBeGreaterThan(0)
    })

    it('DialogTitle が i18n 化されている（en で英語タイトルが表示される）', async () => {
      await i18n.changeLanguage('en')
      render(<PrivacyPolicyPage {...defaultProps} />)
      // DialogTitle が英語の "Privacy Policy" になっていることを headings の最初の要素で確認
      const headings = screen.getAllByRole('heading', { name: /Privacy Policy/i })
      expect(headings.length).toBeGreaterThan(0)
    })

    it('DialogTitle が i18n 化されている（ko で韓国語タイトルが表示される）', async () => {
      await i18n.changeLanguage('ko')
      render(<PrivacyPolicyPage {...defaultProps} />)
      // 韓国語の場合は「개인정보처리방침」がタイトル
      const headings = screen.getAllByRole('heading', { name: /개인정보/ })
      expect(headings.length).toBeGreaterThan(0)
    })
  })
})
