import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLatest } from './useLatest'

describe('useLatest', () => {
  it('最初の値を持つ', () => {
    const { result } = renderHook(() => useLatest('a'))

    expect(result.current.current).toBe('a')
  })

  it('再レンダーで値が変わると、同じ ref の中身が最新の値になる', () => {
    const { result, rerender } = renderHook(({ value }) => useLatest(value), {
      initialProps: { value: 'a' },
    })
    const firstRef = result.current

    rerender({ value: 'b' })

    expect(result.current).toBe(firstRef)
    expect(firstRef.current).toBe('b')
  })
})
