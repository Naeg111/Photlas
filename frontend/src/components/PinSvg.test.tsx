import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PinSvg } from './PinSvg'

/**
 * PinSvg コンポーネントのテスト
 * Issue#53: Mapbox移行に伴い共通化されたピンSVGの描画を検証する
 */
describe('PinSvg', () => {
  const defaultProps = {
    fill: '#FF0000',
    stroke: '#000000',
  }

  it('SVG要素がレンダリングされる', () => {
    const { container } = render(<PinSvg {...defaultProps} />)

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('viewBox', '-2 -2 36 40')
  })

  it('fill属性がピンパスに適用される', () => {
    const { container } = render(<PinSvg {...defaultProps} />)

    const paths = container.querySelectorAll('path')
    // 2番目のpathがメインのピン（1番目はシャドウ）
    const mainPath = paths[1]
    expect(mainPath).toHaveAttribute('fill', '#FF0000')
  })

  it('stroke属性がピンパスに適用される', () => {
    const { container } = render(<PinSvg {...defaultProps} />)

    const paths = container.querySelectorAll('path')
    const mainPath = paths[1]
    expect(mainPath).toHaveAttribute('stroke', '#000000')
  })

  it('デフォルトのstrokeWidthが1である', () => {
    const { container } = render(<PinSvg {...defaultProps} />)

    const paths = container.querySelectorAll('path')
    const mainPath = paths[1]
    expect(mainPath).toHaveAttribute('stroke-width', '1')
  })

  it('カスタムstrokeWidthが適用される', () => {
    const { container } = render(<PinSvg {...defaultProps} strokeWidth={2.5} />)

    const paths = container.querySelectorAll('path')
    const mainPath = paths[1]
    expect(mainPath).toHaveAttribute('stroke-width', '2.5')
  })

  it('childrenがSVG内にレンダリングされる', () => {
    const { container } = render(
      <PinSvg {...defaultProps}>
        <circle cx="16" cy="16" r="8" data-testid="inner-circle" />
      </PinSvg>,
    )

    const circle = container.querySelector('circle')
    expect(circle).toBeInTheDocument()
    expect(circle).toHaveAttribute('cx', '16')
  })

  it('シャドウ用のpath要素が存在する', () => {
    const { container } = render(<PinSvg {...defaultProps} />)

    const paths = container.querySelectorAll('path')
    // 1番目のpathがシャドウ（半透明で少しオフセット）
    const shadowPath = paths[0]
    expect(shadowPath).toHaveAttribute('fill', 'rgba(0,0,0,0.2)')
    expect(shadowPath).toHaveAttribute('stroke', 'none')
    expect(shadowPath).toHaveAttribute('transform', 'translate(0.4, 1.2)')
  })
})
