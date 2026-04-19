/**
 * Issue#96: notifyIfRateLimited 共通ヘルパー関数のテスト
 *
 * 仕様（Issue#96 3.1-3）:
 *   - ApiError が 429（isRateLimited）かを判定
 *   - 429 ならトースト表示
 *   - 直前の表示から 1 秒以内なら連打抑制（PhotoDetailDialog の prev/current/next prefetch 対策）
 *   - 429 以外は何もしない
 *   - t は i18next の TFunction を想定
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError } from './apiClient'

// sonner をモック
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

import { toast } from 'sonner'
import {
  notifyIfRateLimited,
  _resetRateLimitNotifyDebounce,
  getRateLimitInlineMessage,
  notifyIfRateLimitedBurst,
  _resetRateLimitBurstTracker,
} from './notifyIfRateLimited'

const t = vi.fn((key: string, opts?: Record<string, unknown>) => {
  if (opts && typeof opts.seconds !== 'undefined') {
    return `${key}:${opts.seconds}`
  }
  return key
})

describe('notifyIfRateLimited', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(toast.error as any).mockClear()
    t.mockClear()
    _resetRateLimitNotifyDebounce()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('429 エラーでトーストを表示する', () => {
    const err = new ApiError('rate limited', 429, 60)
    notifyIfRateLimited(err, t)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(t).toHaveBeenCalledWith('errors.RATE_LIMIT_EXCEEDED_SHORT', { seconds: 60 })
  })

  it('retryAfterSeconds 欠落時は 60 秒で i18n キーを呼ぶ', () => {
    const err = new ApiError('rate limited', 429)
    notifyIfRateLimited(err, t)
    expect(t).toHaveBeenCalledWith('errors.RATE_LIMIT_EXCEEDED_SHORT', { seconds: 60 })
  })

  it('429 以外はトーストを出さない', () => {
    notifyIfRateLimited(new ApiError('not found', 404), t)
    notifyIfRateLimited(new ApiError('unauthorized', 401), t)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('ApiError でないエラーではトーストを出さない', () => {
    notifyIfRateLimited(new Error('generic') as unknown as ApiError, t)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('1 秒以内の連続呼び出しはデバウンスで 1 回のみ表示', () => {
    const err = new ApiError('rate limited', 429, 60)
    notifyIfRateLimited(err, t)
    notifyIfRateLimited(err, t)
    notifyIfRateLimited(err, t)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('1 秒経過後の呼び出しは再び表示される', () => {
    const err = new ApiError('rate limited', 429, 60)
    notifyIfRateLimited(err, t)
    expect(toast.error).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    notifyIfRateLimited(err, t)
    expect(toast.error).toHaveBeenCalledTimes(2)
  })

  it('1 秒未満では抑制、1 秒以上経過で解放', () => {
    const err = new ApiError('rate limited', 429, 60)
    notifyIfRateLimited(err, t)

    vi.advanceTimersByTime(500)
    notifyIfRateLimited(err, t)
    expect(toast.error).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(500) // 合計 1000ms
    notifyIfRateLimited(err, t)
    expect(toast.error).toHaveBeenCalledTimes(2)
  })
})

/**
 * Issue#96 PR3: notifyIfRateLimitedBurst（パターンC バックグラウンド系）
 *
 * 仕様（Issue#96 3.4 パターンC）:
 *   - 初回の 429 は **サイレント**（トーストすら出さない）
 *   - 一定時間内（デフォルト 1 分）に閾値回数（デフォルト 3 回）以上 429 が連続した場合のみトースト表示
 *   - 同一ウインドウ内で通知済みなら再通知しない
 *   - ウインドウ経過後にカウンタがリセットされ、再び閾値到達で通知可能になる
 *   - 429 以外や ApiError でないエラーはカウンタに影響しない
 *   - 戻り値: 429 を検出したら true（サイレント時も true）。非 429 / 非 ApiError は false
 */
describe('notifyIfRateLimitedBurst', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(toast.error as any).mockClear()
    t.mockClear()
    _resetRateLimitBurstTracker()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初回の 429 はサイレント（トーストを表示しない）', () => {
    const err = new ApiError('rate limited', 429, 60)
    const detected = notifyIfRateLimitedBurst(err, t)
    expect(toast.error).not.toHaveBeenCalled()
    expect(detected).toBe(true)
  })

  it('2 回目の 429 もサイレント', () => {
    const err = new ApiError('rate limited', 429, 60)
    notifyIfRateLimitedBurst(err, t)
    notifyIfRateLimitedBurst(err, t)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('1 分以内に 3 回目の 429 でトーストが 1 回だけ表示される', () => {
    const err = new ApiError('rate limited', 429, 60)
    notifyIfRateLimitedBurst(err, t)
    notifyIfRateLimitedBurst(err, t)
    notifyIfRateLimitedBurst(err, t)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(t).toHaveBeenCalledWith('errors.RATE_LIMIT_BURST')
  })

  it('同一ウインドウ内で 4 回目以降は再通知しない', () => {
    const err = new ApiError('rate limited', 429, 60)
    notifyIfRateLimitedBurst(err, t)
    notifyIfRateLimitedBurst(err, t)
    notifyIfRateLimitedBurst(err, t)
    notifyIfRateLimitedBurst(err, t)
    notifyIfRateLimitedBurst(err, t)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('1 分経過後にカウンタがリセットされ、新たに閾値到達で再通知される', () => {
    const err = new ApiError('rate limited', 429, 60)
    notifyIfRateLimitedBurst(err, t)
    notifyIfRateLimitedBurst(err, t)
    notifyIfRateLimitedBurst(err, t)
    expect(toast.error).toHaveBeenCalledTimes(1)

    // 1 分経過（ウインドウ外）
    vi.advanceTimersByTime(60_001)

    // カウンタがリセットされるので 1〜2 回目は再びサイレント
    notifyIfRateLimitedBurst(err, t)
    expect(toast.error).toHaveBeenCalledTimes(1)
    notifyIfRateLimitedBurst(err, t)
    expect(toast.error).toHaveBeenCalledTimes(1)
    // 3 回目で再通知
    notifyIfRateLimitedBurst(err, t)
    expect(toast.error).toHaveBeenCalledTimes(2)
  })

  it('429 以外の ApiError ではカウンタに加算せず false を返す', () => {
    const err429 = new ApiError('rate limited', 429, 60)
    notifyIfRateLimitedBurst(err429, t)
    notifyIfRateLimitedBurst(new ApiError('not found', 404), t)
    notifyIfRateLimitedBurst(new ApiError('server error', 500), t)
    // 3 回呼んだが 429 は 1 回のみなので通知されない
    expect(toast.error).not.toHaveBeenCalled()
    expect(notifyIfRateLimitedBurst(new ApiError('not found', 404), t)).toBe(false)
  })

  it('ApiError でないエラーは false を返しカウンタに影響しない', () => {
    const err = new ApiError('rate limited', 429, 60)
    notifyIfRateLimitedBurst(err, t)
    notifyIfRateLimitedBurst(err, t)
    const detected = notifyIfRateLimitedBurst(new Error('generic') as unknown as ApiError, t)
    expect(detected).toBe(false)
    expect(toast.error).not.toHaveBeenCalled()
    // 3 回目の 429 でやっと通知
    notifyIfRateLimitedBurst(err, t)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })
})

describe('getRateLimitInlineMessage', () => {
  beforeEach(() => {
    t.mockClear()
  })

  it('retryAfterSeconds を使って RATE_LIMIT_EXCEEDED キーを返す', () => {
    const err = new ApiError('rate limited', 429, 45)
    const message = getRateLimitInlineMessage(err, t)
    expect(t).toHaveBeenCalledWith('errors.RATE_LIMIT_EXCEEDED', { seconds: 45 })
    expect(message).toBe('errors.RATE_LIMIT_EXCEEDED:45')
  })

  it('retryAfterSeconds 欠落時は既定 60 秒で補間する', () => {
    const err = new ApiError('rate limited', 429)
    getRateLimitInlineMessage(err, t)
    expect(t).toHaveBeenCalledWith('errors.RATE_LIMIT_EXCEEDED', { seconds: 60 })
  })
})
