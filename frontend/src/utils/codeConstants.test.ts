import { describe, it, expect } from 'vitest'
import {
  CATEGORY_LABELS,
  CATEGORY_NAME_TO_ID,
  CATEGORY_NATURE,
  categoryNameI18nKey,
} from './codeConstants'
import { PHOTO_CATEGORIES } from './constants'
import ja from '../i18n/locales/ja.json'

describe('codeConstants - カテゴリ名の変換', () => {
  it('CATEGORY_NAME_TO_ID は CATEGORY_LABELS の逆引きになっている', () => {
    for (const [id, name] of Object.entries(CATEGORY_LABELS)) {
      expect(CATEGORY_NAME_TO_ID[name]).toBe(Number(id))
    }
  })

  it('categoryNameI18nKey は日本語名を翻訳キーに変換する', () => {
    expect(categoryNameI18nKey(CATEGORY_LABELS[CATEGORY_NATURE])).toBe('categories.nature')
  })

  it('画面に並べる全カテゴリーが翻訳キーを持ち、ja の翻訳は元の日本語名と同じ', () => {
    const jaCategories = ja.categories as Record<string, string>
    for (const name of PHOTO_CATEGORIES) {
      const key = categoryNameI18nKey(name)
      expect(key.startsWith('categories.')).toBe(true)
      expect(jaCategories[key.replace('categories.', '')]).toBe(name)
    }
  })

  it('知らない名前はそのまま返す', () => {
    expect(categoryNameI18nKey('未知のカテゴリー')).toBe('未知のカテゴリー')
  })
})
