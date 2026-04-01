/**
 * Issue#83: 検索候補を入力文字列との一致度順にソート
 *
 * 優先順位:
 * 1. 完全一致（name === query）
 * 2. 前方一致（nameがqueryで始まる）
 * 3. 部分一致（nameがqueryを含む）
 * 4. その他（API返却順を維持）
 */
export function sortSuggestionsByRelevance<T extends { name: string }>(
  suggestions: T[],
  query: string,
): T[] {
  if (!query) return suggestions

  const q = query.toLowerCase()

  return [...suggestions].sort((a, b) => {
    return getRelevanceScore(a.name, q) - getRelevanceScore(b.name, q)
  })
}

function getRelevanceScore(name: string, query: string): number {
  const n = name.toLowerCase()
  if (n === query) return 0       // 完全一致
  if (n.startsWith(query)) return 1 // 前方一致
  if (n.includes(query)) return 2   // 部分一致
  return 3                          // その他
}
