import { useEffect } from 'react'

/**
 * Search Console SEO 改善: ページごとの canonical URL（正規URL）を <link rel="canonical"> として設定する。
 *
 * SPA は CloudFront/S3 から index.html が全てのパスで配信されるため、何もしないと
 * Google から見て「複数 URL が同じ HTML を返す」状態になり、リダイレクト警告や
 * インデックス重複の原因になる。
 *
 * 各ページコンポーネント側で `useCanonicalUrl()` を呼び出すと、対応するページの
 * canonical URL がドキュメントに反映される。アンマウント時は削除する（次のページ側で
 * 再度設定するか、設定しなければ canonical なしになる）。
 *
 * @param path canonical のパス（例: '/terms-of-service'）。省略すると現在の location.pathname を使用。
 */
export function useCanonicalUrl(path?: string) {
  useEffect(() => {
    const targetPath = path ?? window.location.pathname
    const origin = window.location.origin
    const canonicalUrl = `${origin}${targetPath}`

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const isCreated = link === null
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = canonicalUrl

    return () => {
      // 自分が作成した <link> のみ削除（既存のものは残す）
      if (isCreated && link?.parentNode) {
        link.parentNode.removeChild(link)
      }
    }
  }, [path])
}
