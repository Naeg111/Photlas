import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrivacyPolicyPage } from './PrivacyPolicyPage'

/**
 * PrivacyPolicyPage コンポーネントのテスト
 * Issue#52: プライバシーポリシーの文面改訂
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

})
