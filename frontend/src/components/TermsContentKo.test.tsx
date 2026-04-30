import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TermsContentKo } from './TermsContentKo'

/**
 * Issue#101: 韓国語版利用規約の基本構造テスト。
 */
describe('TermsContentKo - 基本構造', () => {
  it('第1条相当 (제1조) の見出しが表示される', () => {
    const { container } = render(<TermsContentKo />)
    expect(container.textContent).toContain('제1조')
  })

  it('第3条相当 (제3조) のユーザー登録が表示される', () => {
    const { container } = render(<TermsContentKo />)
    expect(container.textContent).toContain('제3조')
  })

  it('第16条相当 (제16조) の準拠法・管轄裁判所が表示される', () => {
    const { container } = render(<TermsContentKo />)
    expect(container.textContent).toContain('제16조')
  })

  it('制定日が記載されている', () => {
    const { container } = render(<TermsContentKo />)
    expect(container.textContent).toMatch(/2026.*2.*16/)
  })

  it('Issue#105: 13세 の利用制限が明記されている', () => {
    const { container } = render(<TermsContentKo />)
    expect(container.textContent).toContain('13세')
  })

  it('Issue#105: 撮影地国の法令遵守 (촬영) 関連が記載されている', () => {
    const { container } = render(<TermsContentKo />)
    // 韓国語で「撮影」(촬영) を含む
    expect(container.textContent).toMatch(/촬영/)
  })
})
