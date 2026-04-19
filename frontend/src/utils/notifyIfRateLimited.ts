/**
 * Issue#96: 429 を受けたときに sonner トーストを出す共通ヘルパー。
 *
 * - `ApiError.isRateLimited` が true のときだけ表示
 * - 直前の表示から 1 秒以内の連続呼び出しは抑制（デバウンス）
 *   ＊ `PhotoDetailDialog` が prev/current/next を並行 prefetch する際、
 *     3 連続で 429 を受け取って 3 回トーストが重なるのを防ぐ
 * - 429 以外や ApiError でないエラーは何もしない（各画面側で個別処理）
 *
 * 戻り値: 429 を検出したかどうか。呼び出し側は `if (!notifyIfRateLimited(e, t)) toast.error(fallback)`
 * のように書くことで、429 時にフォールバックトーストを出さない分岐を簡潔に書ける。
 * デバウンス抑制時も `true` を返す（ユーザーへはすでに別の呼び出しで通知済みのため）。
 */

import { toast } from 'sonner'
import { ApiError } from './apiClient'
import { DEFAULT_RETRY_AFTER_SECONDS } from './fetchJson'

/** デバウンス窓（ms） */
const NOTIFY_DEBOUNCE_MS = 1000

/** i18next TFunction の最小シグネチャ（テストで vi.fn() を渡せる形に留める） */
type TranslateFn = (key: string, options?: Record<string, unknown>) => string

let lastNotifiedAt = 0

export function notifyIfRateLimited(error: unknown, t: TranslateFn): boolean {
  if (!(error instanceof ApiError) || !error.isRateLimited) {
    return false
  }

  const now = Date.now()
  if (now - lastNotifiedAt < NOTIFY_DEBOUNCE_MS) {
    return true
  }
  lastNotifiedAt = now

  const seconds = error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS
  toast.error(t('errors.RATE_LIMIT_EXCEEDED_SHORT', { seconds }))
  return true
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

/**
 * Issue#96 パターンC: バックグラウンド系（地図タイル等）の 429 頻度制御通知。
 *
 * - 初回の 429 は **サイレント**（トーストすら出さない）
 * - 一定時間内（既定 1 分）に閾値（既定 3 回）以上 429 が連続した場合のみ 1 回トースト表示
 * - 同一ウインドウ内で通知済みなら再通知しない
 * - ウインドウ経過後にカウンタがリセットされ、再び閾値到達で通知可能になる
 * - 429 以外 / 非 ApiError はカウンタに影響しない
 *
 * 戻り値: 429 を検出したら true（サイレント時も true）。非 429 / 非 ApiError は false。
 */

/** バースト検知ウインドウ（ms） */
const BURST_WINDOW_MS = 60_000
/** バースト閾値（回） */
const BURST_THRESHOLD = 3

let burstTimestamps: number[] = []
let burstNotifiedInWindow = false

export function notifyIfRateLimitedBurst(error: unknown, t: TranslateFn): boolean {
  if (!(error instanceof ApiError) || !error.isRateLimited) {
    return false
  }

  const now = Date.now()
  burstTimestamps = burstTimestamps.filter((ts) => now - ts < BURST_WINDOW_MS)
  if (burstTimestamps.length === 0) {
    burstNotifiedInWindow = false
  }
  burstTimestamps.push(now)

  if (burstTimestamps.length >= BURST_THRESHOLD && !burstNotifiedInWindow) {
    toast.error(t('errors.RATE_LIMIT_BURST'))
    burstNotifiedInWindow = true
  }

  return true
}

/**
 * テスト専用: バースト検知状態をリセットする。
 */
export function _resetRateLimitBurstTracker(): void {
  burstTimestamps = []
  burstNotifiedInWindow = false
}
