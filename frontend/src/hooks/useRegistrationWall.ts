/**
 * Issue#118: 登録壁の表示状態と写真閲覧カウントを一元管理するカスタムフック。
 *
 * App.tsx 側に分散していた以下のロジックを集約する:
 *   - useState 初期値で localStorage を同期評価して初回フリッカーを防ぐ
 *   - 認証状態変化時の表示判定の再計算
 *   - 写真詳細を開いた瞬間のカウント加算（ログイン中はスキップ）
 *
 * フック単位で凝集しているため、将来の閾値変更やトリガー追加が容易になる。
 */
import { useCallback, useEffect, useState } from 'react'
import { addViewedPhotoId, shouldShowRegistrationWall } from '../utils/registrationWall'

export interface UseRegistrationWallReturn {
  /** 登録壁を表示すべきかどうか（外側でダイアログ抑制等の追加条件と合成して使う） */
  isShown: boolean
  /** 写真詳細が開かれた瞬間に呼ぶ。未ログイン時のみ閲覧履歴に加算する */
  recordPhotoView: (photoId: number) => void
}

export function useRegistrationWall(isAuthenticated: boolean): UseRegistrationWallReturn {
  // useState の遅延初期化で localStorage を同期読み取り、初回レンダリング時点から
  // 正しい値を返す（useEffect だとフリッカーが発生する）。
  const [isShown, setIsShown] = useState(() => shouldShowRegistrationWall(isAuthenticated))

  useEffect(() => {
    setIsShown(shouldShowRegistrationWall(isAuthenticated))
  }, [isAuthenticated])

  const recordPhotoView = useCallback(
    (photoId: number) => {
      if (isAuthenticated) return
      addViewedPhotoId(photoId)
      setIsShown(shouldShowRegistrationWall(false))
    },
    [isAuthenticated],
  )

  return { isShown, recordPhotoView }
}
