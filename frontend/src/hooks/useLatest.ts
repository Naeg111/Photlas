import { useLayoutEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

/**
 * 最新の値を持つ ref を返すカスタムフック。
 *
 * setInterval や、useEffect の依存に入る useCallback の中から値を読みたいが、
 * 値が変わるたびに関数を作り直したくない（タイマーを張り直したり、データを取り直したりしたくない）ときに使う。
 * 例: 翻訳関数 t を依存に入れると言語の切り替えで再取得が走るので、ref.current で今の t を読む。
 *
 * ref はイベントハンドラーやタイマー・非同期処理の中で読む前提。レンダー中には読まないこと。
 * effect の依存に入らない普通のイベントハンドラーでは、ref を使わずにそのまま値（t など）を使えばよい。
 *
 * ref の更新はレンダー中ではなく useLayoutEffect で行う。レンダーは確定せずに捨てられることがあるため
 * （並行レンダリング）、確定したレンダーの値だけを ref に入れる。useLayoutEffect は useEffect より先に
 * 動くので、同じコミットの useEffect から呼ばれる関数でも最新の値を読める。
 */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
