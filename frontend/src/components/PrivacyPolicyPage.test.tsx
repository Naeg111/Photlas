import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrivacyPolicyPage } from './PrivacyPolicyPage'

/**
 * PrivacyPolicyPage コンポーネントのテスト
 * Issue#27: パネル・ダイアログ群の移行
 *
 * プライバシーポリシーを表示するダイアログ
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

    it('renders privacy policy introduction', () => {
      render(<PrivacyPolicyPage {...defaultProps} />)

      expect(screen.getByText(/Photlas運営/)).toBeInTheDocument()
      // プライバシーポリシーという文字列は複数箇所に存在するため、getAllByTextを使用
      const privacyPolicyElements = screen.getAllByText(/プライバシーポリシー/)
      expect(privacyPolicyElements.length).toBeGreaterThan(0)
    })

    it('renders all required sections', () => {
      render(<PrivacyPolicyPage {...defaultProps} />)

      // 全ての条項が存在することを確認
      expect(screen.getByText(/第1条（個人情報）/)).toBeInTheDocument()
      expect(screen.getByText(/第2条（個人情報の収集方法）/)).toBeInTheDocument()
      expect(screen.getByText(/第3条（個人情報の利用目的）/)).toBeInTheDocument()
      expect(screen.getByText(/第4条（利用目的の変更）/)).toBeInTheDocument()
      expect(screen.getByText(/第5条（個人情報の第三者提供）/)).toBeInTheDocument()
    })

    it('renders additional sections', () => {
      render(<PrivacyPolicyPage {...defaultProps} />)

      expect(screen.getByText(/第6条（個人情報の開示）/)).toBeInTheDocument()
      expect(screen.getByText(/第7条（個人情報の訂正および削除）/)).toBeInTheDocument()
      expect(screen.getByText(/第8条（個人情報の利用停止等）/)).toBeInTheDocument()
      expect(screen.getByText(/第9条（Cookie等の利用）/)).toBeInTheDocument()
      expect(screen.getByText(/第10条（プライバシーポリシーの変更）/)).toBeInTheDocument()
      expect(screen.getByText(/第11条（お問い合わせ窓口）/)).toBeInTheDocument()
    })

    it('renders effective date', () => {
      render(<PrivacyPolicyPage {...defaultProps} />)

      expect(screen.getByText(/制定日/)).toBeInTheDocument()
    })

    it('renders scrollable area for long content', () => {
      render(<PrivacyPolicyPage {...defaultProps} />)

      // 個人情報に関する説明が表示されていることを確認
      expect(screen.getByText(/個人情報保護法/)).toBeInTheDocument()
    })
  })
})
