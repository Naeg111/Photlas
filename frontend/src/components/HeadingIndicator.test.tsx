import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { HeadingIndicator, computeRotationAngle } from './HeadingIndicator'

/**
 * Issue#115: 方角インジケーター（扇形）コンポーネント
 * Phase3 Red段階
 */
describe('HeadingIndicator', () => {
  describe('computeRotationAngle (heading - mapBearing 補正)', () => {
    it('mapBearing=0 のとき、heading がそのまま回転角になる', () => {
      expect(computeRotationAngle(0, 0)).toBe(0)
      expect(computeRotationAngle(90, 0)).toBe(90)
      expect(computeRotationAngle(180, 0)).toBe(180)
      expect(computeRotationAngle(270, 0)).toBe(270)
    })

    it('mapBearing=90（東を上に回転）のとき、heading=90 → 回転角=0', () => {
      expect(computeRotationAngle(90, 90)).toBe(0)
    })

    it('mapBearing=180 のとき、heading=0 → 回転角=-180（または 180）', () => {
      // -180 と 180 は視覚的に同じ。0〜360 で正規化
      const result = computeRotationAngle(0, 180)
      expect(((result % 360) + 360) % 360).toBe(180)
    })

    it('負の差分は 0〜360 に正規化される', () => {
      // heading=10, mapBearing=350 → -340 → +20
      expect(computeRotationAngle(10, 350)).toBe(20)
    })

    it('360 を超える値は 0〜360 に正規化される', () => {
      // heading=10, mapBearing=-350 → +360 → 0 (実態としてはあり得ないが仕様上の正規化)
      expect(computeRotationAngle(10, -350)).toBe(0)
    })
  })

  describe('レンダリング', () => {
    it('heading=null の場合、何もレンダリングしない', () => {
      const { container } = render(<HeadingIndicator heading={null} mapBearing={0} />)
      expect(container.querySelector('svg')).toBeNull()
    })

    it('heading=数値 の場合、SVG をレンダリングする', () => {
      const { container } = render(<HeadingIndicator heading={45} mapBearing={0} />)
      expect(container.querySelector('svg')).not.toBeNull()
    })

    it('扇形 path 要素を含む', () => {
      const { container } = render(<HeadingIndicator heading={0} mapBearing={0} />)
      expect(container.querySelector('svg path')).not.toBeNull()
    })

    it('rotate transform に正しい角度が反映される', () => {
      const { container } = render(<HeadingIndicator heading={45} mapBearing={0} />)
      const path = container.querySelector('svg path') as SVGPathElement | null
      expect(path?.getAttribute('transform')).toContain('rotate(45)')
    })

    it('mapBearing が反映される（heading=90, mapBearing=90 → rotate(0)）', () => {
      const { container } = render(<HeadingIndicator heading={90} mapBearing={90} />)
      const path = container.querySelector('svg path') as SVGPathElement | null
      expect(path?.getAttribute('transform')).toContain('rotate(0)')
    })
  })
})
