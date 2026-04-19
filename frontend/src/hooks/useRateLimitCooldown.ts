/**
 * Issue#96: 429 レート制限 cooldown カスタムフック
 *
 * 引数の `ApiError`（429 時に発行されたもの）を受け取り、
 * `retryAfterSeconds` に基づいたカウントダウン state を提供する。
 *
 * - `null` を渡すと常に `isOnCooldown: false / remainingSeconds: 0`
 * - 参照が同じ ApiError は再描画で cooldown をリセットしない
 * - 新しい ApiError が渡されたら cooldown を再スタート
 * - unmount 時にタイマーを確実にクリーンアップ
 *
 * フォーム系画面（パターンA）ではこのフックを呼んで、送信ボタンを
 * `disabled={isOnCooldown}` にし、ラベルに `remainingSeconds` を表示する。
 */

import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../utils/apiClient'
import { DEFAULT_RETRY_AFTER_SECONDS } from '../utils/fetchJson'

interface UseRateLimitCooldownResult {
  isOnCooldown: boolean
  remainingSeconds: number
}

export function useRateLimitCooldown(
  apiError: ApiError | null | undefined
): UseRateLimitCooldownResult {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    apiError ? apiError.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS : 0
  )
  const lastErrorRef = useRef<ApiError | null | undefined>(apiError)

  useEffect(() => {
    if (apiError !== lastErrorRef.current) {
      lastErrorRef.current = apiError
      if (!apiError) {
        setRemainingSeconds(0)
        return
      }
      setRemainingSeconds(apiError.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS)
    }
  }, [apiError])

  useEffect(() => {
    if (remainingSeconds <= 0) return
    const timerId = setInterval(() => {
      setRemainingSeconds(prev => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timerId)
  }, [remainingSeconds])

  return {
    isOnCooldown: remainingSeconds > 0,
    remainingSeconds,
  }
}
