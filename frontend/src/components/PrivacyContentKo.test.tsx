import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PrivacyContentKo } from './PrivacyContentKo'

/**
 * Issue#101: 韓国語版プライバシーポリシーの基本構造テスト。
 */
describe('PrivacyContentKo - 基本構造', () => {
  it('第1条相当 (제1조) の見出しが表示される', () => {
    const { container } = render(<PrivacyContentKo />)
    expect(container.textContent).toContain('제1조')
  })

  it('第6条相当 (제6조) の見出しが表示される', () => {
    const { container } = render(<PrivacyContentKo />)
    expect(container.textContent).toContain('제6조')
  })

  it('第18条相当 (제18조) のお問い合わせが表示される', () => {
    const { container } = render(<PrivacyContentKo />)
    expect(container.textContent).toContain('제18조')
  })

  it('連絡先メールアドレス support@photlas.jp が表示される', () => {
    const { container } = render(<PrivacyContentKo />)
    expect(container.textContent).toContain('support@photlas.jp')
  })

  it('制定日が記載されている', () => {
    const { container } = render(<PrivacyContentKo />)
    // 日本語版の発効日と整合する 2026 年 2 月 16 日
    expect(container.textContent).toMatch(/2026.*2.*16/)
  })

  it('Issue#105: 「13세」(13歳) の利用制限が明記されている', () => {
    const { container } = render(<PrivacyContentKo />)
    expect(container.textContent).toContain('13세')
  })

  it('Issue#105: 第6条に「販売しません」相当の宣言がある', () => {
    const { container } = render(<PrivacyContentKo />)
    // 「판매」(販売) を含む
    expect(container.textContent).toMatch(/판매/)
  })
})
