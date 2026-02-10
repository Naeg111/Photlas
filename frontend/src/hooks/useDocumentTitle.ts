import { useEffect } from 'react'

const DEFAULT_TITLE = 'Photlas - 写真で撮影スポットを共有・発見'

/**
 * document.titleを設定するカスタムフック
 * アンマウント時にデフォルトタイトルに戻す
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title])
}
