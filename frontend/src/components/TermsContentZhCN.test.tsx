import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TermsContentZhCN } from './TermsContentZhCN'

/**
 * Issue#101: 中国語簡体字版利用規約の基本構造テスト。
 */
describe('TermsContentZhCN - 基本構造', () => {
  it('第1条 の見出しが表示される', () => {
    const { container } = render(<TermsContentZhCN />)
    expect(container.textContent).toMatch(/第1条|第一条/)
  })

  it('第3条 のユーザー登録が表示される', () => {
    const { container } = render(<TermsContentZhCN />)
    expect(container.textContent).toMatch(/第3条|第三条/)
  })

  it('第16条 の準拠法・管轄裁判所が表示される', () => {
    const { container } = render(<TermsContentZhCN />)
    expect(container.textContent).toMatch(/第16条|第十六条/)
  })

  it('制定日が記載されている', () => {
    const { container } = render(<TermsContentZhCN />)
    expect(container.textContent).toMatch(/2026.*2.*16/)
  })

  it('Issue#105: 13歳 (13岁 / 13周岁) の利用制限が明記されている', () => {
    const { container } = render(<TermsContentZhCN />)
    expect(container.textContent).toMatch(/13[岁周年]/)
  })

  it('Issue#105: 撮影地国の法令遵守 (拍摄) 関連が記載されている', () => {
    const { container } = render(<TermsContentZhCN />)
    // 簡体字で「拍摄」(撮影) を含む
    expect(container.textContent).toMatch(/拍摄/)
  })
})
