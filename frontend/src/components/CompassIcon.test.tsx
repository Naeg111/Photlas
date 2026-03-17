import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CompassIcon } from './CompassIcon'

/**
 * CompassIcon コンポーネントのテスト
 * TDD Red-Green-Refactor サイクルでの開発
 *
 * Issue#64 要件:
 * - 方位磁針アイコン（N極=赤、S極=青）
 * - classNameを受け取れる
 */
describe('CompassIcon', () => {
  it('should render an SVG element', () => {
    const { container } = render(<CompassIcon />)

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('should have a north pole (red) and south pole (blue)', () => {
    const { container } = render(<CompassIcon />)

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()

    // N極（赤）とS極（青）の2つの要素がある
    const paths = svg!.querySelectorAll('polygon, path')
    expect(paths.length).toBeGreaterThanOrEqual(2)

    // 赤色（N極）の要素が存在する
    const redElement = Array.from(paths).find(
      (el) => el.getAttribute('fill')?.includes('#EF4444') || el.getAttribute('fill')?.includes('#ef4444')
    )
    expect(redElement).toBeTruthy()

    // 青色（S極）の要素が存在する
    const blueElement = Array.from(paths).find(
      (el) => el.getAttribute('fill')?.includes('#3B82F6') || el.getAttribute('fill')?.includes('#3b82f6')
    )
    expect(blueElement).toBeTruthy()
  })

  it('should accept className prop', () => {
    const { container } = render(<CompassIcon className="w-5 h-5" />)

    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('w-5', 'h-5')
  })
})
