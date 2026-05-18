import { describe, it, expect } from 'vitest'
import { formatTagDisplayName } from './formatTagDisplayName'

describe('formatTagDisplayName', () => {
  it('末尾「全般」を持つ displayName からサフィックスを除去する', () => {
    expect(formatTagDisplayName('野鳥全般')).toBe('野鳥')
    expect(formatTagDisplayName('飛行機全般')).toBe('飛行機')
    expect(formatTagDisplayName('建造物全般')).toBe('建造物')
  })

  it('「全般」サフィックスを持たない displayName は変化しない', () => {
    expect(formatTagDisplayName('サクラ')).toBe('サクラ')
    expect(formatTagDisplayName('カワセミ')).toBe('カワセミ')
    expect(formatTagDisplayName('ぶどう畑')).toBe('ぶどう畑')
  })

  it('途中に「全般」を含む displayName は変化しない（末尾のみ除去）', () => {
    expect(formatTagDisplayName('全般の風景')).toBe('全般の風景')
  })

  it('単独「全般」(2 文字ぴったり) は除去しない（空文字回避）', () => {
    expect(formatTagDisplayName('全般')).toBe('全般')
  })

  it('空文字は空文字のまま返す', () => {
    expect(formatTagDisplayName('')).toBe('')
  })
})
