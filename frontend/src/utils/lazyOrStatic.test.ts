import { describe, it, expect } from 'vitest'
import { lazyOrStatic } from './lazyOrStatic'

describe('lazyOrStatic', () => {
  it('Issue#130 - テスト環境では staticFallback をそのまま返す', () => {
    const StaticComponent = () => null
    const result = lazyOrStatic(
      () => Promise.resolve({ default: StaticComponent }),
      StaticComponent
    )
    // テスト実行時は MODE === 'test' なので staticFallback がそのまま返る
    expect(result).toBe(StaticComponent)
  })

  it('Issue#130 - factory は呼ばれない（テスト環境では同期分岐に入るため）', () => {
    let factoryCalled = false
    const StaticComponent = () => null
    lazyOrStatic(
      () => {
        factoryCalled = true
        return Promise.resolve({ default: StaticComponent })
      },
      StaticComponent
    )
    expect(factoryCalled).toBe(false)
  })
})
