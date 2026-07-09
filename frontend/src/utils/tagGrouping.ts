import type { KeywordTag } from '../components/KeywordSection'

/**
 * Issue#159: 複数タグ→1表示名グルーピング。
 * 同一カテゴリー内で同じ表示名を持つ同義タグ（例 Farm/Ranch/Pasture=「牧場」、
 * Lighting/Illumination=「イルミネーション」）を 1 グループに畳み込む。
 */
export interface TagGroup {
  /** 代表表示名（グループのラベル）。 */
  displayName: string
  /** 手動選択時に保存する正準タグ（sort_order 昇順→slug 昇順の先頭）。 */
  canonicalTagId: number
  /** グループに属する全 tagId（フィルタでは OR 対象、選択判定にも使う）。 */
  tagIds: number[]
  /** 並び順の代表値（グループ先頭の sort_order）。 */
  sortOrder: number
  /** 安定した React key 用（正準タグの slug）。 */
  slug: string
}

/**
 * タグ配列を表示名で畳み込む。入力の並び順（＝呼び出し側で sort 済み）を尊重し、
 * 各表示名グループの代表は sort_order 昇順→slug 昇順の先頭とする。
 *
 * @param tags 同一カテゴリー内のタグ（呼び出し側で sort_order 順に並んでいる前提）
 * @returns 表示名グループの配列（初出順）
 */
export function groupTagsByDisplayName(tags: KeywordTag[]): TagGroup[] {
  const order: string[] = []
  const byName = new Map<string, KeywordTag[]>()
  for (const tag of tags) {
    const existing = byName.get(tag.displayName)
    if (existing) {
      existing.push(tag)
    } else {
      byName.set(tag.displayName, [tag])
      order.push(tag.displayName)
    }
  }
  return order.map((displayName) => {
    const members = [...byName.get(displayName)!].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug)
    )
    const canonical = members[0]
    return {
      displayName,
      canonicalTagId: canonical.tagId,
      tagIds: members.map((m) => m.tagId),
      sortOrder: canonical.sortOrder,
      slug: canonical.slug,
    }
  })
}
