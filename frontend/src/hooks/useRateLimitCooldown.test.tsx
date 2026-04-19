/**
 * Issue#96: useRateLimitCooldown フックのテスト
 *
 * 仕様（Issue#96 3.1-4）:
 *   - ApiError の retryAfterSeconds からカウントダウン state を生成
 *   - null を渡した場合は常に isOnCooldown: false / remainingSeconds: 0
 *   - 秒数経過後に isOnCooldown が false に戻る
 *   - コンポーネント unmount 時にタイマーをクリーンアップ
 *   - 同じ ApiError を再度渡してもリセットしない（参照同一性で判定）
 *   - 新しい ApiError を渡すと cooldown を再スタート
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError } from '../utils/apiClient'
import { useRateLimitCooldown } from './useRateLimitCooldown'

describe('useRateLimitCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('null を渡したとき isOnCooldown=false / remainingSeconds=0', () => {
    const { result } = renderHook(() => useRateLimitCooldown(null))
    expect(result.current.isOnCooldown).toBe(false)
    expect(result.current.remainingSeconds).toBe(0)
  })

  it('ApiError を渡すと retryAfterSeconds からカウントダウンが始まる', () => {
    const err = new ApiError('rate limited', 429, 5)
    const { result } = renderHook(() => useRateLimitCooldown(err))

    expect(result.current.isOnCooldown).toBe(true)
    expect(result.current.remainingSeconds).toBe(5)
  })

  it('retryAfterSeconds 欠落時はデフォルト 60 秒を使う', () => {
    const err = new ApiError('rate limited', 429)
    const { result } = renderHook(() => useRateLimitCooldown(err))

    expect(result.current.isOnCooldown).toBe(true)
    expect(result.current.remainingSeconds).toBe(60)
  })

  it('1 秒経過ごとに remainingSeconds が減る', () => {
    const err = new ApiError('rate limited', 429, 3)
    const { result } = renderHook(() => useRateLimitCooldown(err))

    expect(result.current.remainingSeconds).toBe(3)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.remainingSeconds).toBe(2)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.remainingSeconds).toBe(1)
  })

  it('秒数経過後に isOnCooldown が false に戻る', () => {
    const err = new ApiError('rate limited', 429, 2)
    const { result } = renderHook(() => useRateLimitCooldown(err))

    expect(result.current.isOnCooldown).toBe(true)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.isOnCooldown).toBe(false)
    expect(result.current.remainingSeconds).toBe(0)
  })

  it('unmount 時にタイマーがクリーンアップされ、warning が出ない', () => {
    const err = new ApiError('rate limited', 429, 10)
    const { unmount } = renderHook(() => useRateLimitCooldown(err))

    unmount()

    // タイマーが残っていないことを確認（unmount 後の進行で例外・警告が出ない）
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(10000)
      })
    }).not.toThrow()
  })

  it('同じ ApiError 参照を再描画しても cooldown はリセットされない', () => {
    const err = new ApiError('rate limited', 429, 5)
    const { result, rerender } = renderHook(
      ({ e }: { e: ApiError | null }) => useRateLimitCooldown(e),
      { initialProps: { e: err } }
    )

    expect(result.current.remainingSeconds).toBe(5)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.remainingSeconds).toBe(3)

    rerender({ e: err })

    // 参照が同じなら残り秒数はそのまま
    expect(result.current.remainingSeconds).toBe(3)
  })

  it('新しい ApiError を渡すと cooldown を再スタートする', () => {
    const err1 = new ApiError('rate limited', 429, 5)
    const { result, rerender } = renderHook(
      ({ e }: { e: ApiError | null }) => useRateLimitCooldown(e),
      { initialProps: { e: err1 as ApiError | null } }
    )

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.remainingSeconds).toBe(2)

    const err2 = new ApiError('rate limited', 429, 8)
    rerender({ e: err2 })

    expect(result.current.remainingSeconds).toBe(8)
    expect(result.current.isOnCooldown).toBe(true)
  })

  it('ApiError → null に変わると cooldown を解除する', () => {
    const err = new ApiError('rate limited', 429, 10)
    const { result, rerender } = renderHook(
      ({ e }: { e: ApiError | null }) => useRateLimitCooldown(e),
      { initialProps: { e: err as ApiError | null } }
    )

    expect(result.current.isOnCooldown).toBe(true)

    rerender({ e: null })

    expect(result.current.isOnCooldown).toBe(false)
    expect(result.current.remainingSeconds).toBe(0)
  })
})
