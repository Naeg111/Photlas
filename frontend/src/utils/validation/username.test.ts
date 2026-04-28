/**
 * 表示名軽量バリデーションのテスト
 * Issue#98 4.9.8 想定テストケース T53-T58 + 追加カバレッジ
 */

import { describe, it, expect } from 'vitest'
import { validateUsername } from './username'

describe('validateUsername (Issue#98 軽量バリデーション)', () => {
  describe('長さ違反', () => {
    it('Issue#98 T53 - 1文字 "a" は USERNAME_LENGTH_INVALID', () => {
      expect(validateUsername('a')).toBe('USERNAME_LENGTH_INVALID')
    })

    it('13文字は USERNAME_LENGTH_INVALID', () => {
      expect(validateUsername('abcdefghijklm')).toBe('USERNAME_LENGTH_INVALID')
    })

    it('null は USERNAME_REQUIRED', () => {
      expect(validateUsername(null)).toBe('USERNAME_REQUIRED')
    })

    it('undefined は USERNAME_REQUIRED', () => {
      expect(validateUsername(undefined)).toBe('USERNAME_REQUIRED')
    })

    it('空文字は USERNAME_REQUIRED', () => {
      expect(validateUsername('')).toBe('USERNAME_REQUIRED')
    })

    it('空白のみは USERNAME_REQUIRED', () => {
      expect(validateUsername('   ')).toBe('USERNAME_REQUIRED')
    })
  })

  describe('文字種違反', () => {
    it('Issue#98 T54 - 記号 "abc@def" は USERNAME_INVALID_CHARACTER_SYMBOL', () => {
      expect(validateUsername('abc@def')).toBe('USERNAME_INVALID_CHARACTER_SYMBOL')
    })

    it('Issue#98 T55 - 絵文字 "abc😀" は USERNAME_INVALID_CHARACTER_EMOJI', () => {
      expect(validateUsername('abc😀')).toBe('USERNAME_INVALID_CHARACTER_EMOJI')
    })

    it('Issue#98 T56 - 全角英字 "Ａbc" は USERNAME_INVALID_CHARACTER_FULLWIDTH', () => {
      expect(validateUsername('Ａbc')).toBe('USERNAME_INVALID_CHARACTER_FULLWIDTH')
    })

    it('Issue#98 T57 - 半角カタカナ "ｱｲｳ" は USERNAME_INVALID_CHARACTER_HALFWIDTH_KATAKANA', () => {
      expect(validateUsername('ｱｲｳ')).toBe('USERNAME_INVALID_CHARACTER_HALFWIDTH_KATAKANA')
    })

    it('全角数字 "abc１２" は USERNAME_INVALID_CHARACTER_FULLWIDTH', () => {
      expect(validateUsername('abc１２')).toBe('USERNAME_INVALID_CHARACTER_FULLWIDTH')
    })
  })

  describe('優先順位', () => {
    it('記号 + 絵文字 → SYMBOL が最優先', () => {
      expect(validateUsername('@😀abc')).toBe('USERNAME_INVALID_CHARACTER_SYMBOL')
    })

    it('絵文字 + 全角 → EMOJI が FULLWIDTH に優先', () => {
      expect(validateUsername('😀Ａbc')).toBe('USERNAME_INVALID_CHARACTER_EMOJI')
    })

    it('全角 + 半角カナ → FULLWIDTH が HALFWIDTH_KATAKANA に優先', () => {
      expect(validateUsername('Ａbcｱ')).toBe('USERNAME_INVALID_CHARACTER_FULLWIDTH')
    })
  })

  describe('許可される入力（パス）', () => {
    it('Issue#98 T58 - "admin" は予約語だが軽量バリデーションでは null（サーバー判定に委ねる）', () => {
      expect(validateUsername('admin')).toBeNull()
    })

    it('"tanaka" は null（パス）', () => {
      expect(validateUsername('tanaka')).toBeNull()
    })

    it('"Tanaka" は null（パス）', () => {
      expect(validateUsername('Tanaka')).toBeNull()
    })

    it('"tanaka_01" は null（パス）', () => {
      expect(validateUsername('tanaka_01')).toBeNull()
    })

    it('"tanaka-01" は null（パス）', () => {
      expect(validateUsername('tanaka-01')).toBeNull()
    })

    it('"田中太郎" は null（パス）', () => {
      expect(validateUsername('田中太郎')).toBeNull()
    })

    it('"カタカナ"（全角）は null（パス）', () => {
      expect(validateUsername('カタカナ')).toBeNull()
    })

    it('"ab"（2文字、最小境界）は null（パス）', () => {
      expect(validateUsername('ab')).toBeNull()
    })

    it('"abcdefghijkl"（12文字、最大境界）は null（パス）', () => {
      expect(validateUsername('abcdefghijkl')).toBeNull()
    })
  })
})
