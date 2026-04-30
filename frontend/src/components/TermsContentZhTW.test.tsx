import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TermsContentZhTW } from './TermsContentZhTW'

/**
 * Issue#101: 中国語繁体字版利用規約の基本構造テスト。
 */
describe('TermsContentZhTW - 基本構造', () => {
  it('第1條 の見出しが表示される', () => {
    const { container } = render(<TermsContentZhTW />)
    expect(container.textContent).toMatch(/第1條|第一條/)
  })

  it('第3條 のユーザー登録が表示される', () => {
    const { container } = render(<TermsContentZhTW />)
    expect(container.textContent).toMatch(/第3條|第三條/)
  })

  it('第16條 の準拠法・管轄裁判所が表示される', () => {
    const { container } = render(<TermsContentZhTW />)
    expect(container.textContent).toMatch(/第16條|第十六條/)
  })

  it('制定日が記載されている', () => {
    const { container } = render(<TermsContentZhTW />)
    expect(container.textContent).toMatch(/2026.*2.*16/)
  })

  it('Issue#105: 13歲 の利用制限が明記されている', () => {
    const { container } = render(<TermsContentZhTW />)
    expect(container.textContent).toMatch(/13[歲周年]/)
  })

  it('Issue#105: 撮影地国の法令遵守 (拍攝) 関連が記載されている', () => {
    const { container } = render(<TermsContentZhTW />)
    // 繁体字で「拍攝」(撮影) を含む
    expect(container.textContent).toMatch(/拍攝/)
  })
})
