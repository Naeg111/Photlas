/**
 * Issue#96: 429 を受けたときに sonner トーストを出す共通ヘルパー。
 *
 * - `ApiError.isRateLimited` が true のときだけ表示
 * - 直前の表示から 1 秒以内の連続呼び出しは抑制（デバウンス）
 *   ＊ `PhotoDetailDialog` が prev/current/next を並行 prefetch する際、
 *     3 連続で 429 を受け取って 3 回トーストが重なるのを防ぐ
 * - 429 以外や ApiError でないエラーは何もしない（各画面側で個別処理）
 */

import { toast } from 'sonner'
import { ApiError } from './apiClient'
import { DEFAULT_RETRY_AFTER_SECONDS } from './fetchJson'

/** デバウンス窓（ms） */
const NOTIFY_DEBOUNCE_MS = 1000

/** i18next TFunction の最小シグネチャ（テストで vi.fn() を渡せる形に留める） */
type TranslateFn = (key: string, options?: Record<string, unknown>) => string

let lastNotifiedAt = 0

export function notifyIfRateLimited(error: unknown, t: TranslateFn): void {
  if (!(error instanceof ApiError) || !error.isRateLimited) {
    return
  }

  const now = Date.now()
  if (now - lastNotifiedAt < NOTIFY_DEBOUNCE_MS) {
    return
  }
  lastNotifiedAt = now

  const seconds = error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS
  toast.error(t('errors.RATE_LIMIT_EXCEEDED_SHORT', { seconds }))
}

/**
 * テスト専用: デバウンス状態をリセットする。
 * 本体コードから呼ばれることは想定していない。
 */
export function _resetRateLimitNotifyDebounce(): void {
  lastNotifiedAt = 0
}

/**
 * 429 インラインエラー（パターンA）用の i18n メッセージ生成ヘルパー。
 *
 * `errors.RATE_LIMIT_EXCEEDED` キーを `retryAfterSeconds`（欠落時は既定値）で補間する。
 * 呼び出し側ではこの戻り値を `setError()` / `setErrors({ general: ... })` 等に渡す。
 */
export function getRateLimitInlineMessage(error: ApiError, t: TranslateFn): string {
  const seconds = error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS
  return t('errors.RATE_LIMIT_EXCEEDED', { seconds })
}
