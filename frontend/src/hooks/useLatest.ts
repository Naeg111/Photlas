import { useRef } from 'react'
import type { MutableRefObject } from 'react'

/**
 * 最新の値を持つ ref を返すカスタムフック。
 *
 * setInterval や、useEffect の依存に入る useCallback の中から値を読みたいが、
 * 値が変わるたびに関数を作り直したくない（タイマーを張り直したり、データを取り直したりしたくない）ときに使う。
 * 例: 翻訳関数 t を依存に入れると言語の切り替えで再取得が走るので、ref.current で今の t を読む。
 */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  ref.current = value
  return ref
}
