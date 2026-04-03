import { useCallback, useEffect, useRef } from 'react'

/**
 * コールバック関数をデバウンスするカスタムフック
 *
 * 返却された関数が呼ばれるたびにタイマーをリセットし、
 * 最後の呼び出しから指定ミリ秒経過後にコールバックを実行する。
 *
 * @param callback 実行するコールバック関数
 * @param delay デバウンスの遅延時間（ミリ秒）
 * @returns デバウンスされたコールバック関数
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  callbackRef.current = callback

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      callbackRef.current(...args)
    }, delay)
  }, [delay])
}
