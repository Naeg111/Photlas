import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContactDialog } from './ContactDialog'

/**
 * Issue#114: お問い合わせダイアログ
 * TDD Red段階
 */
describe('ContactDialog', () => {
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('open=trueの場合にダイアログが表示される', () => {
    render(<ContactDialog open={true} onOpenChange={mockOnOpenChange} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('open=falseの場合にダイアログが表示されない', () => {
    render(<ContactDialog open={false} onOpenChange={mockOnOpenChange} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('タイトル「お問い合わせ」が表示される', () => {
    render(<ContactDialog open={true} onOpenChange={mockOnOpenChange} />)
    expect(screen.getByText('お問い合わせ')).toBeInTheDocument()
  })

  it('案内文が表示される', () => {
    render(<ContactDialog open={true} onOpenChange={mockOnOpenChange} />)
    expect(
      screen.getByText(/ご意見・ご要望・不具合のご報告などは、下記メールアドレスまでお気軽にご連絡ください/)
    ).toBeInTheDocument()
  })

  it('support@photlas.jp へのメールリンクが表示される', () => {
    render(<ContactDialog open={true} onOpenChange={mockOnOpenChange} />)
    const emailLink = screen.getByText('support@photlas.jp')
    expect(emailLink).toBeInTheDocument()
  })

  it('mailto リンクに subject (件名) が含まれる', () => {
    render(<ContactDialog open={true} onOpenChange={mockOnOpenChange} />)
    const link = screen.getByText('support@photlas.jp').closest('a')
    expect(link).toHaveAttribute('href', expect.stringContaining('mailto:support@photlas.jp'))
    // 件名は URL エンコードされているため「Photlas」を含むキーワードで判定
    const href = link?.getAttribute('href') ?? ''
    const decoded = decodeURIComponent(href)
    expect(decoded).toContain('subject=Photlasへのお問い合わせ')
  })

  it('mailto リンクに body (本文テンプレ) が含まれる', () => {
    render(<ContactDialog open={true} onOpenChange={mockOnOpenChange} />)
    const link = screen.getByText('support@photlas.jp').closest('a')
    const href = link?.getAttribute('href') ?? ''
    const decoded = decodeURIComponent(href)
    expect(decoded).toContain('body=お問い合わせ内容をご記入ください。')
  })
})
