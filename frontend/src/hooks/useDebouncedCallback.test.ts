import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDebouncedCallback } from './useDebouncedCallback'

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call the callback immediately', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 500))

    act(() => { result.current() })

    expect(callback).not.toHaveBeenCalled()
  })

  it('calls the callback after the delay', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 500))

    act(() => { result.current() })
    act(() => { vi.advanceTimersByTime(500) })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('resets the timer when called again within the delay', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 500))

    act(() => { result.current() })
    act(() => { vi.advanceTimersByTime(300) })
    act(() => { result.current() }) // reset
    act(() => { vi.advanceTimersByTime(300) })

    expect(callback).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(200) })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('passes arguments to the callback', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 500))

    act(() => { result.current('arg1', 'arg2') })
    act(() => { vi.advanceTimersByTime(500) })

    expect(callback).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('only calls the callback once for multiple rapid calls', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 500))

    act(() => {
      result.current()
      result.current()
      result.current()
      result.current()
    })
    act(() => { vi.advanceTimersByTime(500) })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('cleans up timer on unmount', () => {
    const callback = vi.fn()
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 500))

    act(() => { result.current() })
    unmount()
    act(() => { vi.advanceTimersByTime(500) })

    expect(callback).not.toHaveBeenCalled()
  })
})
