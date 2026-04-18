import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PrivacyContentJa } from './PrivacyContentJa'

/**
 * Issue#94 §4: WAF ログの収集開始に伴うプライバシーポリシー文面の更新。
 * 旧文面（IP の一時取得のみ）から、WAF ログの収集・90 日保管を明記する
 * 新文面に置き換わっていることを検証する。
 */
describe('PrivacyContentJa - Issue#94 WAF log disclosure', () => {
  it('第2条(7)技術情報に WAF ログの記載がある', () => {
    const { container } = render(<PrivacyContentJa />)
    expect(container.textContent).toContain('WAF ログ')
  })

  it('WAF ログの収集項目として IPアドレス・リクエスト URL・User-Agent・アクセス時刻が明記されている', () => {
    const { container } = render(<PrivacyContentJa />)
    const text = container.textContent ?? ''
    expect(text).toContain('IPアドレス')
    expect(text).toContain('リクエスト URL')
    expect(text).toContain('User-Agent')
    expect(text).toContain('アクセス時刻')
  })

  it('WAF ログの利用目的としてレートリミット制御・不正アクセスの検知および調査が明記されている', () => {
    const { container } = render(<PrivacyContentJa />)
    const text = container.textContent ?? ''
    expect(text).toContain('レートリミット制御')
    expect(text).toContain('不正アクセスの検知および調査')
  })

  it('WAF ログの保管期間が「最大 90 日間」と明記されている', () => {
    const { container } = render(<PrivacyContentJa />)
    expect(container.textContent).toContain('最大 90 日間')
  })

  it('WAF ログは保管期間経過後に自動削除される旨が明記されている', () => {
    const { container } = render(<PrivacyContentJa />)
    expect(container.textContent).toContain('保管期間経過後は自動的に削除')
  })

  it('旧文面の「永続的な保存は行いません」が残っていない', () => {
    const { container } = render(<PrivacyContentJa />)
    expect(container.textContent).not.toContain('永続的な保存は行いません')
  })
})
