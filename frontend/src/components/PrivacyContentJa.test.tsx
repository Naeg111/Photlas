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

/**
 * Issue#99: Google OAuth scope を email のみに変更したことに伴い、
 * プライバシーポリシーの Google 取得情報から「氏名」を削除する。
 * profile スコープを取得しないため、氏名は実際に取得されない。
 */
describe('PrivacyContentJa - Issue#99 Google scope minimization', () => {
  it('第2条(8)の Google 取得情報は「メールアドレス、Google ユーザーID」のみ', () => {
    const { container } = render(<PrivacyContentJa />)
    const text = container.textContent ?? ''
    expect(text).toContain('Google：メールアドレス、Google ユーザーID')
  })

  it('第2条(8)の Google 取得情報に「氏名」が含まれない', () => {
    const { container } = render(<PrivacyContentJa />)
    const text = container.textContent ?? ''
    expect(text).not.toContain('Google：メールアドレス、氏名')
  })

  it('第2条(8)の LINE 取得情報は変更されていない（表示名は引き続き取得）', () => {
    const { container } = render(<PrivacyContentJa />)
    const text = container.textContent ?? ''
    expect(text).toContain('LINE：メールアドレス、表示名、LINE ユーザーID')
  })
})

/**
 * Issue#105: 国際対応版への格上げ。
 * 海外プロモーション (Product Hunt 等) に向けて、業界標準のベストプラクティスに
 * 沿った条項をプライバシーポリシーに追加する。
 */
describe('PrivacyContentJa - Issue#105 国際対応版への格上げ', () => {
  // A. 第12条 - 最低利用年齢 13 歳の明示
  it('第12条に「13歳以上」の利用制限が明記されている', () => {
    const { container } = render(<PrivacyContentJa />)
    const text = container.textContent ?? ''
    expect(text).toContain('13歳以上')
  })

  // B. 第11条 - モデレーション削除写真の 180 日保持
  it('第11条にモデレーション削除写真の 180 日保持が明記されている', () => {
    const { container } = render(<PrivacyContentJa />)
    const text = container.textContent ?? ''
    expect(text).toContain('180日')
    // モデレーションによる削除と関連付けて記載されていること
    expect(text).toMatch(/モデレーション[\s\S]*?180日|180日[\s\S]*?モデレーション/)
  })

  // C. 第16条 - データポータビリティの運用方針明示
  it('第16条のデータポータビリティ権が「お問い合わせ窓口に連絡」のリクエストベース運用として記述されている', () => {
    const { container } = render(<PrivacyContentJa />)
    const text = container.textContent ?? ''
    // データポータビリティ権の宣言は維持
    expect(text).toContain('データポータビリティ')
    // お問い合わせ窓口経由のリクエスト運用が明記されている
    expect(text).toMatch(/データポータビリティ[\s\S]*?第18条のお問い合わせ窓口/)
  })

  // D. 第6条 - 「Do Not Sell」宣言
  it('第6条に「個人情報を第三者に販売しません」の宣言が追記されている', () => {
    const { container } = render(<PrivacyContentJa />)
    const text = container.textContent ?? ''
    expect(text).toContain('個人情報を第三者に販売しません')
  })

  // E. 第17条 - 国際ユーザー向け注記
  it('第17条に国際ユーザー向けの包括的注意書きが追記されている', () => {
    const { container } = render(<PrivacyContentJa />)
    const text = container.textContent ?? ''
    // 日本に拠点を置く事業者として世界中からアクセス可能である旨
    expect(text).toContain('日本に拠点')
    // ユーザー居住国の法律に基づく権利を尊重する旨
    expect(text).toContain('居住する国の法律')
  })

  // 改定日: 国際対応版への更新が反映されている
  it('最終改定日に「国際対応版へ更新」と記載されている', () => {
    const { container } = render(<PrivacyContentJa />)
    const text = container.textContent ?? ''
    expect(text).toContain('国際対応版へ更新')
  })
})
