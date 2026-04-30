import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PrivacyContentZhCN } from './PrivacyContentZhCN'

/**
 * Issue#101: 中国語簡体字版プライバシーポリシーの基本構造テスト。
 */
describe('PrivacyContentZhCN - 基本構造', () => {
  it('第1条 (第1条 / 第一条) の見出しが表示される', () => {
    const { container } = render(<PrivacyContentZhCN />)
    expect(container.textContent).toMatch(/第1条|第一条/)
  })

  it('第6条 の見出しが表示される', () => {
    const { container } = render(<PrivacyContentZhCN />)
    expect(container.textContent).toMatch(/第6条|第六条/)
  })

  it('第18条 のお問い合わせが表示される', () => {
    const { container } = render(<PrivacyContentZhCN />)
    expect(container.textContent).toMatch(/第18条|第十八条/)
  })

  it('連絡先メールアドレス support@photlas.jp が表示される', () => {
    const { container } = render(<PrivacyContentZhCN />)
    expect(container.textContent).toContain('support@photlas.jp')
  })

  it('制定日が記載されている', () => {
    const { container } = render(<PrivacyContentZhCN />)
    expect(container.textContent).toMatch(/2026.*2.*16/)
  })

  it('Issue#105: 13歳 (13岁 / 13周岁) の利用制限が明記されている', () => {
    const { container } = render(<PrivacyContentZhCN />)
    expect(container.textContent).toMatch(/13[岁周年]/)
  })

  it('Issue#105: 第6条に「販売しません」相当の宣言がある', () => {
    const { container } = render(<PrivacyContentZhCN />)
    // 簡体字「出售」または「贩售」
    expect(container.textContent).toMatch(/出售|贩售|不会出售/)
  })
})
