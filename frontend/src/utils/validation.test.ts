import { describe, it, expect } from 'vitest'
import {
  getPasswordStrength,
  validatePassword,
  validateEmail,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_STRONG_MIN_LENGTH,
  PASSWORD_REGEX,
  EMAIL_REGEX,
  MAX_SNS_LINKS,
} from './validation'

/**
 * validation.ts ユニットテスト
 * Issue#21: パスワードバリデーション統一
 * Issue#26: 認証ダイアログ用バリデーション
 */

describe('validation', () => {
  describe('定数', () => {
    it('PASSWORD_MIN_LENGTH は 8', () => {
      expect(PASSWORD_MIN_LENGTH).toBe(8)
    })

    it('PASSWORD_MAX_LENGTH は 20', () => {
      expect(PASSWORD_MAX_LENGTH).toBe(20)
    })

    it('PASSWORD_STRONG_MIN_LENGTH は 12', () => {
      expect(PASSWORD_STRONG_MIN_LENGTH).toBe(12)
    })

    it('MAX_SNS_LINKS は 3', () => {
      expect(MAX_SNS_LINKS).toBe(3)
    })

    it('PASSWORD_REGEX が有効なパスワードにマッチする', () => {
      expect(PASSWORD_REGEX.test('Password1')).toBe(true)
    })

    it('EMAIL_REGEX が有効なメールにマッチする', () => {
      expect(EMAIL_REGEX.test('user@example.com')).toBe(true)
    })
  })

  describe('getPasswordStrength', () => {
    it('8文字未満は weak を返す', () => {
      expect(getPasswordStrength('Pass1')).toBe('weak')
    })

    it('空文字は weak を返す', () => {
      expect(getPasswordStrength('')).toBe('weak')
    })

    it('1種類の文字のみ（小文字のみ）は weak を返す', () => {
      expect(getPasswordStrength('abcdefgh')).toBe('weak')
    })

    it('2種類の文字を含む8文字は medium を返す', () => {
      expect(getPasswordStrength('abcdefg1')).toBe('medium')
    })

    it('3種類の文字を含む8文字は medium を返す（12文字未満のため）', () => {
      expect(getPasswordStrength('Abcdefg1')).toBe('medium')
    })

    it('3種類の文字を含む12文字以上は strong を返す', () => {
      expect(getPasswordStrength('Abcdefghij1k')).toBe('strong')
    })

    it('境界値: ちょうど12文字で3条件満たすと strong', () => {
      expect(getPasswordStrength('Abcdefghij1k')).toBe('strong')
      expect(getPasswordStrength('Abcdefghij1k').length).toBeUndefined // 関数の戻り値チェック
    })

    it('境界値: 11文字で3条件満たすと medium', () => {
      expect(getPasswordStrength('Abcdefghi1k')).toBe('medium')
    })
  })

  describe('validatePassword', () => {
    it('空文字でエラーを返す', () => {
      const result = validatePassword('')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('パスワードを入力してください')
    })

    it('8文字未満でエラーを返す', () => {
      const result = validatePassword('Pass1a')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('8文字以上')
    })

    it('境界値: 7文字でエラーを返す', () => {
      const result = validatePassword('Passwor')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('8文字以上')
    })

    it('21文字以上でエラーを返す', () => {
      const result = validatePassword('Abcdefghij1234567890k')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('20文字以内')
    })

    it('数字なしでエラーを返す', () => {
      const result = validatePassword('Abcdefgh')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('数字を1文字以上')
    })

    it('小文字なしでエラーを返す', () => {
      const result = validatePassword('ABCDEFG1')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('ローマ字小文字を1文字以上')
    })

    it('大文字なしでエラーを返す', () => {
      const result = validatePassword('abcdefg1')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('ローマ字大文字を1文字以上')
    })

    it('記号を含むとエラーを返す', () => {
      const result = validatePassword('Passwo1!')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('記号を含めることはできません')
    })

    it('有効なパスワードで成功を返す', () => {
      const result = validatePassword('Password1')
      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBeNull()
    })

    it('境界値: ちょうど8文字の有効パスワードで成功', () => {
      const result = validatePassword('Abcdef1g')
      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBeNull()
    })

    it('境界値: ちょうど20文字の有効パスワードで成功', () => {
      const result = validatePassword('AbcDef1ghijklmnopqrs')
      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBeNull()
    })
  })

  describe('validateEmail', () => {
    it('空文字でエラーを返す', () => {
      const result = validateEmail('')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('メールアドレスを入力してください')
    })

    it('空白のみでエラーを返す', () => {
      const result = validateEmail('   ')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('メールアドレスを入力してください')
    })

    it('@なしでエラーを返す', () => {
      const result = validateEmail('userexample.com')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('正しいメールアドレスの形式')
    })

    it('ドメインなしでエラーを返す', () => {
      const result = validateEmail('user@')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('正しいメールアドレスの形式')
    })

    it('ローカルパートなしでエラーを返す', () => {
      const result = validateEmail('@domain.com')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('正しいメールアドレスの形式')
    })

    it('有効なメールアドレスで成功を返す', () => {
      const result = validateEmail('user@example.com')
      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBeNull()
    })

    it('サブドメイン付きメールで成功を返す', () => {
      const result = validateEmail('user@mail.example.co.jp')
      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBeNull()
    })
  })
})
