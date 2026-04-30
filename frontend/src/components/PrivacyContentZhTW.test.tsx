import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PrivacyContentZhTW } from './PrivacyContentZhTW'

/**
 * Issue#101: 中国語繁体字版プライバシーポリシーの基本構造テスト。
 */
describe('PrivacyContentZhTW - 基本構造', () => {
  it('第1條 (第1條 / 第一條) の見出しが表示される', () => {
    const { container } = render(<PrivacyContentZhTW />)
    expect(container.textContent).toMatch(/第1條|第一條/)
  })

  it('第6條 の見出しが表示される', () => {
    const { container } = render(<PrivacyContentZhTW />)
    expect(container.textContent).toMatch(/第6條|第六條/)
  })

  it('第18條 のお問い合わせが表示される', () => {
    const { container } = render(<PrivacyContentZhTW />)
    expect(container.textContent).toMatch(/第18條|第十八條/)
  })

  it('連絡先メールアドレス support@photlas.jp が表示される', () => {
    const { container } = render(<PrivacyContentZhTW />)
    expect(container.textContent).toContain('support@photlas.jp')
  })

  it('制定日が記載されている', () => {
    const { container } = render(<PrivacyContentZhTW />)
    expect(container.textContent).toMatch(/2026.*2.*16/)
  })

  it('Issue#105: 13歲 の利用制限が明記されている', () => {
    const { container } = render(<PrivacyContentZhTW />)
    expect(container.textContent).toMatch(/13[歲周年]/)
  })

  it('Issue#105: 第6條に「販売しません」相当の宣言がある', () => {
    const { container } = render(<PrivacyContentZhTW />)
    expect(container.textContent).toMatch(/出售|販售|不會出售/)
  })

  it('簡体字ではなく繁体字で書かれている（資訊 など）', () => {
    const { container } = render(<PrivacyContentZhTW />)
    const text = container.textContent ?? ''
    // 繁体字特有の語彙: 資訊（情報）/伺服器（サーバー）/網際網路 などのいずれか
    expect(text).toMatch(/資訊|伺服器|網際網路|資料|繁體/)
  })
})
