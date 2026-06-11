/**
 * Issue#143: staging（test.photlas.jp）サイト全体を検索インデックスから除外するための
 * build 時注入ヘルパー。
 *
 * 本番のほぼ複製である staging が重複コンテンツとしてインデックスされるのを防ぐため、
 * staging ビルドだけ index.html の `<head>` に静的な `<meta name="robots" content="noindex">`
 * を焼き込む（JS 非実行クローラにも効く）。`vite.config.ts` の `transformIndexHtml` から呼ぶ。
 *
 * - 非コンテンツページ用の {@link useRobotsNoindex}（JS 注入・本番）とは別機構。
 * - サイト全体除外なので follow は付けない（`content="noindex"` のみ）。
 */
export const SITE_NOINDEX_META = '<meta name="robots" content="noindex" />'

/**
 * `enabled` が true のとき index.html の `</head>` 直前に noindex メタを注入する。
 * false のとき、または既に注入済みのときは HTML をそのまま返す。
 */
export function injectSiteNoindex(html: string, enabled: boolean): string {
  if (!enabled) {
    return html
  }
  if (html.includes(SITE_NOINDEX_META)) {
    return html // 二重注入防止（冪等）
  }
  return html.replace('</head>', `  ${SITE_NOINDEX_META}\n  </head>`)
}
