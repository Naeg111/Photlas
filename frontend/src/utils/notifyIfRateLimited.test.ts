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
import { notifyIfRateLimited, _resetRateLimitNotifyDebounce, getRateLimitInlineMessage } from './notifyIfRateLimited'

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
