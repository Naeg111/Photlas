import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TermsContentJa } from './TermsContentJa'

/**
 * 既存条文の存在を確認する基本テスト。
 * Issue#105 で test ファイルを新規作成したタイミングで欠落補完。
 */
describe('TermsContentJa - 基本構造', () => {
  it('第1条 (適用) のセクション見出しが表示される', () => {
    const { container } = render(<TermsContentJa />)
    expect(container.textContent).toContain('第1条')
    expect(container.textContent).toContain('適用')
  })

  it('第3条 (ユーザー登録) のセクション見出しが表示される', () => {
    const { container } = render(<TermsContentJa />)
    expect(container.textContent).toContain('第3条')
    expect(container.textContent).toContain('ユーザー登録')
  })

  it('第5条 (禁止事項) のセクション見出しが表示される', () => {
    const { container } = render(<TermsContentJa />)
    expect(container.textContent).toContain('第5条')
    expect(container.textContent).toContain('禁止事項')
  })

  it('第16条 (準拠法・管轄裁判所) のセクション見出しが表示される', () => {
    const { container } = render(<TermsContentJa />)
    expect(container.textContent).toContain('第16条')
    expect(container.textContent).toContain('準拠法')
  })

  it('制定日が記載されている', () => {
    const { container } = render(<TermsContentJa />)
    expect(container.textContent).toContain('制定日')
  })
})

/**
 * Issue#105: 国際対応版への格上げ。
 * 撮影地国の法令遵守、国際利用の注記、最低利用年齢の明示を追加する。
 */
describe('TermsContentJa - Issue#105 国際対応版への格上げ', () => {
  // F. 第5条 - 投稿者責任の強化（撮影地国の法令遵守）
  it('第5条に撮影地国の法令遵守に関する投稿者責任が明記されている', () => {
    const { container } = render(<TermsContentJa />)
    const text = container.textContent ?? ''
    // 撮影地国の法令を遵守する責任
    expect(text).toContain('撮影地国の法令')
    // 第三者の写り込みへの配慮（同意取得または個人を特定できないよう加工）
    expect(text).toMatch(/同意.*取得|個人を特定できない/)
  })

  // G. 第16条 - 国際利用の注記
  it('第16条に国際利用の注記（自国法律の確認はユーザー責任）が追記されている', () => {
    const { container } = render(<TermsContentJa />)
    const text = container.textContent ?? ''
    // 日本法に基づく提供だが世界中からアクセス可能
    expect(text).toMatch(/世界中.*アクセス|世界各地からのアクセス/)
    // ユーザー自身の責任で自国法令の確認
    expect(text).toMatch(/自国の法律|居住国の法律/)
  })

  // H. 第3条 - 最低利用年齢 13 歳の明示
  it('第3条に「13歳以上」の利用制限が明記されている', () => {
    const { container } = render(<TermsContentJa />)
    const text = container.textContent ?? ''
    expect(text).toContain('13歳以上')
  })

  // 改定日: 国際対応版への更新が反映されている
  it('最終改定日に「国際対応版へ更新」と記載されている', () => {
    const { container } = render(<TermsContentJa />)
    const text = container.textContent ?? ''
    expect(text).toContain('国際対応版へ更新')
  })
})
