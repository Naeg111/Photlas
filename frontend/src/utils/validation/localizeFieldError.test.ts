/**
 * localizeFieldError のテスト
 * Issue#98 4.10.2
 */

import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { localizeFieldError } from './localizeFieldError'

describe('localizeFieldError (Issue#98)', () => {
  const mockT = vi.fn((key: string) => `[translated:${key}]`) as unknown as TFunction

  it('"errors." 始まりのキーは t() で翻訳される', () => {
    const result = localizeFieldError('errors.USERNAME_RESERVED', mockT)
    expect(result).toBe('[translated:errors.USERNAME_RESERVED]')
  })

  it('"errors.USERNAME_REQUIRED" は t() を通る', () => {
    const result = localizeFieldError('errors.USERNAME_REQUIRED', mockT)
    expect(result).toBe('[translated:errors.USERNAME_REQUIRED]')
  })

  it('"errors." 始まりでない固定メッセージはそのまま返される', () => {
    const result = localizeFieldError('メールアドレスは必須です', mockT)
    expect(result).toBe('メールアドレスは必須です')
  })

  it('"errors." 始まりでない固定メッセージは t() を呼ばない', () => {
    const t = vi.fn() as unknown as TFunction
    localizeFieldError('入力内容が無効です。', t)
    expect(t).not.toHaveBeenCalled()
  })

  it('英語固定メッセージもそのまま返される', () => {
    const result = localizeFieldError('Email is required', mockT)
    expect(result).toBe('Email is required')
  })

  it('空文字列はそのまま空文字列を返す', () => {
    const result = localizeFieldError('', mockT)
    expect(result).toBe('')
  })
})
