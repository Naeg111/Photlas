import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TermsOfServicePage } from './TermsOfServicePage'

/**
 * TermsOfServicePage コンポーネントのテスト
 * Issue#51: 利用規約の文面改訂
 *
 * 利用規約を表示するダイアログ
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

    it('renders scrollable area for long content', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      expect(screen.getByText(/本規約は、本サービスの提供条件/)).toBeInTheDocument()
    })

    it('renders all required sections', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      expect(screen.getByText(/第4条（投稿データの取扱い）/)).toBeInTheDocument()
      expect(screen.getByText(/第5条（禁止事項）/)).toBeInTheDocument()
      expect(screen.getByText(/第6条（利用料金）/)).toBeInTheDocument()
      expect(screen.getByText(/第7条（退会・アカウント削除）/)).toBeInTheDocument()
      expect(screen.getByText(/第8条（登録抹消）/)).toBeInTheDocument()
      expect(screen.getByText(/第9条（本サービスの停止・変更・終了）/)).toBeInTheDocument()
      expect(screen.getByText(/第10条（免責事項）/)).toBeInTheDocument()
      expect(screen.getByText(/第11条（規約の変更）/)).toBeInTheDocument()
      expect(screen.getByText(/第12条（通知）/)).toBeInTheDocument()
      expect(screen.getByText(/第13条（権利義務の譲渡禁止）/)).toBeInTheDocument()
      expect(screen.getByText(/第14条（分離可能性）/)).toBeInTheDocument()
      expect(screen.getByText(/第15条（準拠法・管轄裁判所）/)).toBeInTheDocument()
      expect(screen.getByText(/第16条（お問い合わせ）/)).toBeInTheDocument()
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
})
