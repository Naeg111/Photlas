import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSwipeDirectionHistory } from './useSwipeDirectionHistory'

describe('useSwipeDirectionHistory - Issue#128', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初期状態では中立 (defaultCount=2 が両側に返る)', () => {
    const { result } = renderHook(() => useSwipeDirectionHistory(0))
    expect(result.current.forwardCount).toBe(2)
    expect(result.current.backwardCount).toBe(2)
  })

  it('インデックスが 1 回だけ進むと、まだ閾値未達で中立のまま', () => {
    const { result, rerender } = renderHook(({ idx }) => useSwipeDirectionHistory(idx), {
      initialProps: { idx: 0 },
    })
    rerender({ idx: 1 })
    expect(result.current.forwardCount).toBe(2)
    expect(result.current.backwardCount).toBe(2)
  })

  it('インデックスが連続 2 回進むと、forward 偏重 (forward=3 / backward=1) になる', () => {
    const { result, rerender } = renderHook(({ idx }) => useSwipeDirectionHistory(idx), {
      initialProps: { idx: 0 },
    })
    rerender({ idx: 1 })
    rerender({ idx: 2 })
    expect(result.current.forwardCount).toBe(3)
    expect(result.current.backwardCount).toBe(1)
  })

  it('インデックスが連続 2 回戻ると、backward 偏重 (forward=1 / backward=3) になる', () => {
    const { result, rerender } = renderHook(({ idx }) => useSwipeDirectionHistory(idx), {
      initialProps: { idx: 5 },
    })
    rerender({ idx: 4 })
    rerender({ idx: 3 })
    expect(result.current.forwardCount).toBe(1)
    expect(result.current.backwardCount).toBe(3)
  })

  it('forward 偏重後に 1 回逆方向に振ると、sum=1 で中立に戻る', () => {
    const { result, rerender } = renderHook(({ idx }) => useSwipeDirectionHistory(idx), {
      initialProps: { idx: 0 },
    })
    rerender({ idx: 1 })
    rerender({ idx: 2 }) // history = [+1, +1] sum=2 forward 偏重
    expect(result.current.forwardCount).toBe(3)
    rerender({ idx: 1 }) // history = [+1, +1, -1] sum=1 中立
    expect(result.current.forwardCount).toBe(2)
    expect(result.current.backwardCount).toBe(2)
  })

  it('リセットタイマー (3 秒) 経過後は履歴がクリアされて中立に戻る', () => {
    const { result, rerender } = renderHook(({ idx }) => useSwipeDirectionHistory(idx), {
      initialProps: { idx: 0 },
    })
    rerender({ idx: 1 })
    rerender({ idx: 2 }) // forward 偏重
    expect(result.current.forwardCount).toBe(3)

    act(() => {
      vi.advanceTimersByTime(3500)
    })

    // タイマー発火後、ref はクリアされたが React の再 render が必要
    // hook 内で setHistoryVersion を呼んでいるので、再 render で中立になる
    expect(result.current.forwardCount).toBe(2)
    expect(result.current.backwardCount).toBe(2)
  })

  it('リセット前に新しいスワイプが起きると、タイマーは再設定される', () => {
    const { result, rerender } = renderHook(({ idx }) => useSwipeDirectionHistory(idx), {
      initialProps: { idx: 0 },
    })
    rerender({ idx: 1 })
    rerender({ idx: 2 }) // forward 偏重

    act(() => {
      vi.advanceTimersByTime(2000) // まだ 2 秒 (< 3 秒)
    })
    rerender({ idx: 3 }) // 新しいスワイプ、タイマー再設定
    expect(result.current.forwardCount).toBe(3) // 偏重維持

    act(() => {
      vi.advanceTimersByTime(2000) // また 2 秒（前回再設定からは 2 秒）
    })
    expect(result.current.forwardCount).toBe(3) // まだリセットされていない
  })

  it('historySize=3 を超える履歴は古いものから破棄される', () => {
    const { result, rerender } = renderHook(({ idx }) => useSwipeDirectionHistory(idx), {
      initialProps: { idx: 0 },
    })
    // forward 3 回
    rerender({ idx: 1 })
    rerender({ idx: 2 })
    rerender({ idx: 3 })
    expect(result.current.forwardCount).toBe(3) // history=[+1,+1,+1] sum=3

    // backward 1 回（古い +1 が破棄され history=[+1,+1,-1] sum=1 中立）
    rerender({ idx: 2 })
    expect(result.current.forwardCount).toBe(2)
  })

  it('options で各定数を上書きできる', () => {
    const { result, rerender } = renderHook(
      ({ idx }) =>
        useSwipeDirectionHistory(idx, {
          forwardCount: 5,
          backwardCount: 0,
          defaultCount: 1,
        }),
      { initialProps: { idx: 0 } }
    )
    expect(result.current.forwardCount).toBe(1)
    rerender({ idx: 1 })
    rerender({ idx: 2 })
    expect(result.current.forwardCount).toBe(5)
    expect(result.current.backwardCount).toBe(0)
  })
})
