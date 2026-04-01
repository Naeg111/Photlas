import { describe, it, expect } from 'vitest'
import { sortSuggestionsByRelevance } from './sortSuggestions'

/**
 * Issue#83: 場所検索の候補を入力文字列との一致度順にソート
 *
 * ソート優先順位:
 * 1. 完全一致（name === query）
 * 2. 前方一致（nameがqueryで始まる）
 * 3. 部分一致（nameがqueryを含む）
 * 4. その他（API返却順を維持）
 */

describe('sortSuggestionsByRelevance - Issue#83', () => {
  it('完全一致の候補が最上位に表示される', () => {
    const suggestions = [
      { name: '東京都', full_address: '日本' },
      { name: '東京駅', full_address: '東京都千���田区' },
    ]

    const sorted = sortSuggestionsByRelevance(suggestions, '東京駅')

    expect(sorted[0].name).toBe('東京駅')
  })

  it('前方一致が部分一致より上位に表示される', () => {
    const suggestions = [
      { name: '駅前本町', full_address: '兵庫県' },
      { name: '東京駅前', full_address: '東京都' },
    ]

    const sorted = sortSuggestionsByRelevance(suggestions, '東京')

    expect(sorted[0].name).toBe('東京駅前')
    expect(sorted[1].name).toBe('駅前本町')
  })

  it('完全一致 → 前方一致 → 部分一致 → その他 の優先順位でソートされる', () => {
    const suggestions = [
      { name: '東京都', full_address: '' },
      { name: '東京田', full_address: '' },
      { name: '東京社', full_address: '' },
      { name: '駅前本町', full_address: '' },
      { name: '駅元町', full_address: '' },
      { name: '東京駅', full_address: '' },
    ]

    const sorted = sortSuggestionsByRelevance(suggestions, '東京駅')

    // 完全一致
    expect(sorted[0].name).toBe('東京駅')
    // 前方一致（「東京駅」で始まるものはない。「東京」で始まるものは部分一致ではなくその他）
    // 部分一致（「東京駅」を含むもの → 完全一致のみ）
    // その他（残り）はAPI順を維持
    expect(sorted[1].name).toBe('東京都')
  })

  it('同一優先度内ではAPI返却順を維持する', () => {
    const suggestions = [
      { name: '東京タワー', full_address: '' },
      { name: '東京スカイツリー', full_address: '' },
      { name: '東京ドーム', full_address: '' },
    ]

    const sorted = sortSuggestionsByRelevance(suggestions, '東京')

    // すべて前方一致 → API順を維持
    expect(sorted[0].name).toBe('東京タワー')
    expect(sorted[1].name).toBe('東京スカイツリー')
    expect(sorted[2].name).toBe('東京ドーム')
  })

  it('大文字小文字を無視して比較する', () => {
    const suggestions = [
      { name: 'Shibuya Station', full_address: '' },
      { name: 'shibuya crossing', full_address: '' },
      { name: 'shibuya', full_address: '' },
    ]

    const sorted = sortSuggestionsByRelevance(suggestions, 'Shibuya')

    // 完全一致（大文字小文字無視）
    expect(sorted[0].name).toBe('shibuya')
  })

  it('空の検索文字列の場合はAPI順のまま返す', () => {
    const suggestions = [
      { name: 'A', full_address: '' },
      { name: 'B', full_address: '' },
    ]

    const sorted = sortSuggestionsByRelevance(suggestions, '')

    expect(sorted[0].name).toBe('A')
    expect(sorted[1].name).toBe('B')
  })

  it('空の候補配列の場合は空配列を返す', () => {
    const sorted = sortSuggestionsByRelevance([], '東京')

    expect(sorted).toEqual([])
  })
})
