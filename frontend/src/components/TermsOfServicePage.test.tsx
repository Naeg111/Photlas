import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TermsOfServicePage } from './TermsOfServicePage'

/**
 * TermsOfServicePage コンポーネントのテスト
 * Issue#27: パネル・ダイアログ群の移行
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

      // 主要な条項が表示されていることを確認
      expect(screen.getByText(/第1条（適用）/)).toBeInTheDocument()
      expect(screen.getByText(/第2条（定義）/)).toBeInTheDocument()
      expect(screen.getByText(/第3条（ユーザー登録）/)).toBeInTheDocument()
    })

    it('renders scrollable area for long content', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      // 利用規約の内容が表示されていることを確認
      expect(screen.getByText(/本規約は、本サービスの提供条件/)).toBeInTheDocument()
    })

    it('renders all required sections', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      // 全ての条項が存在することを確認
      expect(screen.getByText(/第4条（投稿データの取扱い）/)).toBeInTheDocument()
      expect(screen.getByText(/第5条（禁止事項）/)).toBeInTheDocument()
      expect(screen.getByText(/第6条（本サービスの停止等）/)).toBeInTheDocument()
      expect(screen.getByText(/第7条（免責事項）/)).toBeInTheDocument()
      expect(screen.getByText(/第8条（準拠法・管轄裁判所）/)).toBeInTheDocument()
    })

    it('renders effective date', () => {
      render(<TermsOfServicePage {...defaultProps} />)

      expect(screen.getByText(/制定日/)).toBeInTheDocument()
    })
  })
})
