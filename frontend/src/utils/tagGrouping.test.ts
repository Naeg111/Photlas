import { describe, it, expect } from 'vitest'
import { groupTagsByDisplayName } from './tagGrouping'
import type { KeywordTag } from '../components/KeywordSection'

function tag(tagId: number, slug: string, displayName: string, sortOrder: number): KeywordTag {
  return { tagId, slug, displayName, categoryCodes: [215], sortOrder }
}

describe('groupTagsByDisplayName (Issue#159 複数タグ→1表示名)', () => {
  it('同じ表示名の同義タグを 1 グループに畳み込む（牧場=Farm/Ranch/Pasture）', () => {
    const groups = groupTagsByDisplayName([
      tag(1, 'farm', '牧場', 60),
      tag(2, 'ranch', '牧場', 60),
      tag(3, 'pasture', '牧場', 60),
      tag(4, 'zoo', '動物園', 40),
    ])
    expect(groups).toHaveLength(2)
    const ranchGroup = groups.find((g) => g.displayName === '牧場')!
    expect([...ranchGroup.tagIds].sort((a, b) => a - b)).toEqual([1, 2, 3])
    // 正準は sort_order 昇順→slug 昇順の先頭（farm < pasture < ranch）
    expect(ranchGroup.canonicalTagId).toBe(1)
    const zooGroup = groups.find((g) => g.displayName === '動物園')!
    expect(zooGroup.tagIds).toEqual([4])
    expect(zooGroup.canonicalTagId).toBe(4)
  })

  it('入力の初出順を保持する', () => {
    const groups = groupTagsByDisplayName([
      tag(4, 'zoo', '動物園', 40),
      tag(1, 'farm', '牧場', 60),
      tag(2, 'ranch', '牧場', 60),
    ])
    expect(groups.map((g) => g.displayName)).toEqual(['動物園', '牧場'])
  })

  it('正準は sort_order 昇順を優先（sort_order が異なる場合）', () => {
    const groups = groupTagsByDisplayName([
      tag(2, 'neon', 'ネオン', 100),
      tag(1, 'nightlife', 'ネオン', 50),
    ])
    expect(groups[0].tagIds).toEqual([1, 2])
    expect(groups[0].canonicalTagId).toBe(1) // sort_order 50 の nightlife が先頭
  })

  it('空配列は空グループ', () => {
    expect(groupTagsByDisplayName([])).toEqual([])
  })
})
