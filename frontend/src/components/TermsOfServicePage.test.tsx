import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import i18n from 'i18next'
import { TermsOfServicePage } from './TermsOfServicePage'

/**
 * TermsOfServicePage コンポーネントのテスト
 * Issue#51: 利用規約の文面改訂
 * Issue#101: 多言語対応 + ハードコード日本語の i18n 化
 */

describe('TermsOfServicePage', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements - UI要素', () => {
    it('renders dialog when open prop is true', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not render dialog when open prop is false', () => {
      render(<TermsOfServicePage {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders dialog title', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      expect(screen.getByRole('heading', { name: '利用規約' })).toBeInTheDocument()
    })

    it('renders terms of service content', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      expect(screen.getByText(/第1条（適用）/)).toBeInTheDocument()
      expect(screen.getByText(/第2条（定義）/)).toBeInTheDocument()
      expect(screen.getByText(/第3条（ユーザー登録）/)).toBeInTheDocument()
    })

    it('renders all required sections', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      expect(screen.getByText(/第4条（投稿データの取扱い）/)).toBeInTheDocument()
      expect(screen.getByText(/第5条（禁止事項）/)).toBeInTheDocument()
      expect(screen.getByText(/第6条（利用料金）/)).toBeInTheDocument()
      expect(screen.getByText(/第7条（退会・アカウント削除）/)).toBeInTheDocument()
      expect(screen.getByText(/第8条（登録抹消）/)).toBeInTheDocument()
      expect(screen.getByText(/第9条（コンテンツモデレーション）/)).toBeInTheDocument()
      expect(screen.getByText(/第10条（本サービスの停止・変更・終了）/)).toBeInTheDocument()
      expect(screen.getByText(/第11条（免責事項）/)).toBeInTheDocument()
      expect(screen.getByText(/第12条（規約の変更）/)).toBeInTheDocument()
      expect(screen.getByText(/第17条（外部サービスの利用）/)).toBeInTheDocument()
      expect(screen.getByText(/第18条（お問い合わせ）/)).toBeInTheDocument()
    })

    it('renders contact email address', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      expect(screen.getByText(/support@photlas.jp/)).toBeInTheDocument()
    })

    it('renders effective date', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      expect(screen.getByText(/制定日/)).toBeInTheDocument()
    })
  })

  describe('Issue#53: 外部サービス利用規約リンク', () => {
    it('renders Mapbox terms of service link', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      const mapboxLink = screen.getByRole('link', { name: /Mapbox/i })
      expect(mapboxLink).toHaveAttribute('href', 'https://www.mapbox.com/legal/tos')
    })

    it('renders OpenStreetMap license link', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      const osmLink = screen.getByRole('link', { name: /OpenStreetMap/i })
      expect(osmLink).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
    })
  })

  /**
   * Issue#101: 5 言語対応 + ハードコード日本語の i18n 化のテスト。
   */
  describe('Issue#101 - 多言語対応', () => {
    afterEach(async () => {
      await i18n.changeLanguage('ja')
    })

    it('言語が ja の場合、日本語コンテンツが表示される', async () => {
      await i18n.changeLanguage('ja')
      render(<TermsOfServicePage {...defaultProps} />)
      expect(screen.getByText(/第1条（適用）/)).toBeInTheDocument()
    })

    it('言語が en の場合、英語コンテンツが表示される', async () => {
      await i18n.changeLanguage('en')
      render(<TermsOfServicePage {...defaultProps} />)
      expect(screen.getAllByText(/Article \d+/).length).toBeGreaterThan(0)
    })

    it('言語が ko の場合、韓国語コンテンツが表示される', async () => {
      await i18n.changeLanguage('ko')
      render(<TermsOfServicePage {...defaultProps} />)
      expect(screen.getAllByText(/제1조/).length).toBeGreaterThan(0)
    })

    it('言語が zh-CN の場合、簡体字コンテンツが表示される', async () => {
      await i18n.changeLanguage('zh-CN')
      render(<TermsOfServicePage {...defaultProps} />)
      expect(screen.getAllByText(/第1条|第一条/).length).toBeGreaterThan(0)
    })

    it('言語が zh-TW の場合、繁体字コンテンツが表示される', async () => {
      await i18n.changeLanguage('zh-TW')
      render(<TermsOfServicePage {...defaultProps} />)
      expect(screen.getAllByText(/第1條|第一條/).length).toBeGreaterThan(0)
    })

    it('DialogTitle が i18n 化されている（en で英語タイトルが表示される）', async () => {
      await i18n.changeLanguage('en')
      render(<TermsOfServicePage {...defaultProps} />)
      const headings = screen.getAllByRole('heading', { name: /Terms of Service/i })
      expect(headings.length).toBeGreaterThan(0)
    })

    it('DialogTitle が i18n 化されている（ko で韓国語タイトルが表示される）', async () => {
      await i18n.changeLanguage('ko')
      render(<TermsOfServicePage {...defaultProps} />)
      const headings = screen.getAllByRole('heading', { name: /이용약관/ })
      expect(headings.length).toBeGreaterThan(0)
    })
  })
})
