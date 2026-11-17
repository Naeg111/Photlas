/**
 * Issue#93: バックエンドのエラーコードを表示言語の文言にするヘルパーのテスト
 */
import { describe, it, expect } from 'vitest'
import i18n from '../i18n'
import { getErrorCode, translateErrorCode } from './apiErrorMessage'

describe('getErrorCode', () => {
  it('本文の code を返す', () => {
    expect(getErrorCode({ code: 'INVALID_TOKEN', message: '無効' })).toBe('INVALID_TOKEN')
  })

  it('code が無い・文字列でない・本文がオブジェクトでない場合は undefined', () => {
    expect(getErrorCode({ message: '無効' })).toBeUndefined()
    expect(getErrorCode({ code: 123 })).toBeUndefined()
    expect(getErrorCode({ code: '' })).toBeUndefined()
    expect(getErrorCode('text')).toBeUndefined()
    expect(getErrorCode(null)).toBeUndefined()
    expect(getErrorCode(undefined)).toBeUndefined()
  })
})

describe('translateErrorCode', () => {
  const t = i18n.t.bind(i18n)

  it('errors.<code> の翻訳があればその文言を返す', () => {
    expect(translateErrorCode('ALREADY_REPORTED', t, 'auth.errorOccurred')).toBe('すでに通報済みです')
  })

  it('翻訳が無いコード・コード無しは fallbackKey の文言を返す', () => {
    expect(translateErrorCode('VALIDATION_ERROR', t, 'auth.errorOccurred')).toBe('エラーが発生しました')
    expect(translateErrorCode('INTERNAL_ERROR', t, 'photo.suggestionFailed')).toBe('指摘の送信に失敗しました')
    expect(translateErrorCode(undefined, t, 'auth.errorOccurred')).toBe('エラーが発生しました')
  })

  it('英語の設定では英語の文言を返す', async () => {
    await i18n.changeLanguage('en')
    try {
      expect(translateErrorCode('INVALID_TOKEN', t, 'auth.errorOccurred')).toBe(
        'This link is invalid or has expired. Please try again.'
      )
      expect(translateErrorCode('BAD_REQUEST', t, 'auth.errorOccurred')).toBe('An error occurred')
    } finally {
      await i18n.changeLanguage('ja')
    }
  })
})
