import { describe, it, expect } from 'vitest'
import {
  transformMonths,
  transformTimesOfDay,
  transformWeathers,
  transformCategories,
  categoryNamesToIds,
} from './filterTransform'

/**
 * filterTransform.ts ユニットテスト
 * Issue#16: フィルター機能 - UI表示値からAPI値への変換
 */

describe('filterTransform', () => {
  describe('transformMonths', () => {
    it('月文字列を数値に変換する', () => {
      expect(transformMonths(['1月', '12月'])).toEqual([1, 12])
    })

    it('全12ヶ月を正しく変換する', () => {
      const allMonths = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
      const expected = Array.from({ length: 12 }, (_, i) => i + 1)
      expect(transformMonths(allMonths)).toEqual(expected)
    })

    it('空配列で空配列を返す', () => {
      expect(transformMonths([])).toEqual([])
    })

    it('不正な月文字列をフィルタリングする', () => {
      expect(transformMonths(['13月', 'abc', '0月'])).toEqual([])
    })

    it('有効・無効が混在する場合、有効なもののみ返す', () => {
      expect(transformMonths(['1月', 'invalid', '6月'])).toEqual([1, 6])
    })
  })

  describe('transformTimesOfDay', () => {
    it('朝 を MORNING に変換する', () => {
      expect(transformTimesOfDay(['朝'])).toEqual(['MORNING'])
    })

    it('昼 を DAY に変換する', () => {
      expect(transformTimesOfDay(['昼'])).toEqual(['DAY'])
    })

    it('夕方 を EVENING に変換する', () => {
      expect(transformTimesOfDay(['夕方'])).toEqual(['EVENING'])
    })

    it('夜 を NIGHT に変換する', () => {
      expect(transformTimesOfDay(['夜'])).toEqual(['NIGHT'])
    })

    it('空配列で空配列を返す', () => {
      expect(transformTimesOfDay([])).toEqual([])
    })

    it('不正な値をフィルタリングする', () => {
      expect(transformTimesOfDay(['早朝', 'abc'])).toEqual([])
    })
  })

  describe('transformWeathers', () => {
    it('全4天気を正しく変換する', () => {
      expect(transformWeathers(['晴れ', '曇り', '雨', '雪'])).toEqual([
        'Sunny', 'Cloudy', 'Rain', 'Snow',
      ])
    })

    it('空配列で空配列を返す', () => {
      expect(transformWeathers([])).toEqual([])
    })

    it('不正な値をフィルタリングする', () => {
      expect(transformWeathers(['暴風', 'abc'])).toEqual([])
    })
  })

  describe('transformCategories', () => {
    it('Issue#63 - 全14ジャンルを正しく変換する', () => {
      const genres = [
        '自然風景', '街並み', '建造物', '夜景', 'グルメ', '植物', '動物',
        '野鳥', '自動車', 'バイク', '鉄道', '飛行機', '星空', 'その他',
      ]
      expect(transformCategories(genres)).toEqual(genres)
    })

    it('Issue#63 - 旧カテゴリ名（風景、食べ物、ポートレート）はフィルタリングされる', () => {
      expect(transformCategories(['風景', '食べ物', 'ポートレート'])).toEqual([])
    })

    it('空配列で空配列を返す', () => {
      expect(transformCategories([])).toEqual([])
    })

    it('未定義カテゴリをフィルタリングする', () => {
      expect(transformCategories(['自然風景', '未知のカテゴリ'])).toEqual(['自然風景'])
    })
  })

  describe('categoryNamesToIds', () => {
    it('カテゴリ名をIDに変換する', () => {
      const categoryMap = new Map<string, number>([
        ['風景', 1],
        ['街並み', 2],
      ])
      expect(categoryNamesToIds(['風景', '街並み'], categoryMap)).toEqual([1, 2])
    })

    it('マッピングにない名前をフィルタリングする', () => {
      const categoryMap = new Map<string, number>([['風景', 1]])
      expect(categoryNamesToIds(['風景', '未知'], categoryMap)).toEqual([1])
    })

    it('空配列で空配列を返す', () => {
      const categoryMap = new Map<string, number>([['風景', 1]])
      expect(categoryNamesToIds([], categoryMap)).toEqual([])
    })

    it('空マップで空配列を返す', () => {
      const categoryMap = new Map<string, number>()
      expect(categoryNamesToIds(['風景'], categoryMap)).toEqual([])
    })
  })
})
