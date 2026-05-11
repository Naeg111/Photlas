import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RouteFallback } from './RouteFallback'

describe('RouteFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Issue#130 - 初期表示は何も出ない（ちらつき防止の delay）', () => {
    const { container } = render(<RouteFallback />)
    expect(container).toBeEmptyDOMElement()
  })

  it('Issue#130 - delay 経過後にローディングインジケータが表示される', () => {
    render(<RouteFallback />)

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
