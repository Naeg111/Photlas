import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TermsOfServicePage } from './TermsOfServicePage'

/**
 * TermsOfServicePage コンポーネントのテスト
 * Issue#51: 利用規約の文面改訂
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

  describe('言語切替', () => {
    it('初期表示は日本語である', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      expect(screen.getByText(/第1条（適用）/)).toBeInTheDocument()
    })

    it('言語トグルスイッチが表示される', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      expect(screen.getByText('日本語')).toBeInTheDocument()
      expect(screen.getByText('英語')).toBeInTheDocument()
    })

    it('トグルを切り替えると英語版が表示される', async () => {
      render(<TermsOfServicePage {...defaultProps} />)

      const toggle = screen.getByRole('switch')
      await userEvent.setup().click(toggle)

      expect(screen.getByText('Article 1 (Application)')).toBeInTheDocument()
    })

    it('トグルを再度切り替えると日本語版に戻る', async () => {
      render(<TermsOfServicePage {...defaultProps} />)

      const user = userEvent.setup()
      const toggle = screen.getByRole('switch')
      await user.click(toggle)
      await user.click(toggle)

      expect(screen.getByText(/第1条（適用）/)).toBeInTheDocument()
    })
  })
})
