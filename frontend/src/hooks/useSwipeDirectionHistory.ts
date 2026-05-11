import { useEffect, useRef, useState } from 'react'

/**
 * Issue#128: スワイプ方向に応じた非対称 prefetch のための履歴管理 hook。
 *
 * 直近 N 回のスワイプ方向（前へ -1 / 次へ +1）を ref で保持し、
 * 合計の絶対値が閾値以上なら「進行方向」を判定する。
 * 一定時間スワイプが止まったら履歴をクリアして対称（中立）に戻す。
 */

export interface SwipeDirectionHistoryOptions {
  /** 履歴に保持するスワイプ回数 */
  historySize?: number
  /** 進行方向側に prefetch する枚数 */
  forwardCount?: number
  /** 逆方向側に prefetch する枚数（最低限残しておく値） */
  backwardCount?: number
  /** 中立時の prefetch 枚数（左右対称） */
  defaultCount?: number
  /** sum の絶対値がこの値以上で進行方向確定 */
  dominantThreshold?: number
  /** 切替が止まってから履歴をリセットするまでのミリ秒 */
  resetMs?: number
}

export interface SwipeDirectionHistoryResult {
  /** 進行方向側 (currentIndex より大きい index) の prefetch 枚数 */
  forwardCount: number
  /** 逆方向側 (currentIndex より小さい index) の prefetch 枚数 */
  backwardCount: number
}

const DEFAULTS = {
  historySize: 3,
  forwardCount: 3,
  backwardCount: 1,
  defaultCount: 2,
  dominantThreshold: 2,
  resetMs: 3000,
} as const

/**
 * currentIndex の変化を監視してスワイプ方向の履歴を管理し、
 * 現在の偏重状況に応じた forward / backward の prefetch 枚数を返す。
 *
 * @param currentIndex 監視対象のインデックス（state または props）
 * @param options 各種定数の上書き
 */
export function useSwipeDirectionHistory(
  currentIndex: number,
  options?: SwipeDirectionHistoryOptions
): SwipeDirectionHistoryResult {
  const historySize = options?.historySize ?? DEFAULTS.historySize
  const forwardN = options?.forwardCount ?? DEFAULTS.forwardCount
  const backwardN = options?.backwardCount ?? DEFAULTS.backwardCount
  const defaultN = options?.defaultCount ?? DEFAULTS.defaultCount
  const threshold = options?.dominantThreshold ?? DEFAULTS.dominantThreshold
  const resetMs = options?.resetMs ?? DEFAULTS.resetMs

  const historyRef = useRef<Array<-1 | 1>>([])
  const previousIndexRef = useRef<number>(currentIndex)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 履歴更新を React の再 render に反映させるためのカウンタ
  const [historyVersion, setHistoryVersion] = useState(0)

  useEffect(() => {
    const prev = previousIndexRef.current
    if (currentIndex !== prev) {
      const direction: -1 | 1 = currentIndex > prev ? 1 : -1
      historyRef.current.push(direction)
      if (historyRef.current.length > historySize) {
        historyRef.current.shift()
      }
      previousIndexRef.current = currentIndex
      setHistoryVersion((v) => v + 1)

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => {
        historyRef.current = []
        setHistoryVersion((v) => v + 1)
      }, resetMs)
    }
  }, [currentIndex, historySize, resetMs])

  // unmount でタイマーと履歴をクリーンアップ
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
      historyRef.current = []
      previousIndexRef.current = 0
    }
  }, [])

  // 現在の履歴から forward / backward を算出
  // historyVersion を依存にしてレンダリングごとの再計算を保証
  void historyVersion
  const sum = historyRef.current.reduce<number>((a, b) => a + b, 0)
  if (sum >= threshold) {
    return { forwardCount: forwardN, backwardCount: backwardN }
  }
  if (sum <= -threshold) {
    return { forwardCount: backwardN, backwardCount: forwardN }
  }
  return { forwardCount: defaultN, backwardCount: defaultN }
}
