import { useEffect } from 'react'

/**
 * Issue#143: 非コンテンツページ（404 / 認証・確認系 / 管理画面）に
 * `<meta name="robots" content="noindex, follow">` を設定する。
 *
 * - noindex: 検索インデックスに載せない
 * - follow: ページ内リンク（例: トップへ戻る）はクローラに辿らせてよい
 *
 * SPA は全パスで同じ index.html が配信されるため、ページ側で本フックを呼んで
 * 動的に robots メタを差し込む（{@link useCanonicalUrl} と同じ DOM 注入方式）。
 *
 * staging では build 時に静的な `<meta name="robots" content="noindex">` が
 * 注入される（`vite.config.ts`）。その場合 isCreated=false 経路となり、本フックは
 * 値を上書きし、アンマウントで元の値（noindex）へ復元する（既存メタは消さない）。
 *
 * @param content robots メタの content 値（既定: 'noindex, follow'）
 */
export function useRobotsNoindex(content: string = 'noindex, follow') {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const isCreated = meta === null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      document.head.appendChild(meta)
    }
    const prev = meta.content
    meta.content = content

    return () => {
      if (isCreated && meta?.parentNode) {
        // 自分が作成したメタのみ削除（既存メタは残す）
        meta.parentNode.removeChild(meta)
      } else if (meta) {
        // 既存メタ（例: staging の静的注入）は元の値へ戻す
        meta.content = prev
      }
    }
  }, [content])
}
