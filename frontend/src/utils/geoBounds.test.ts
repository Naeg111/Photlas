import { describe, it, expect } from 'vitest'
import { computeBoundsForPins } from './geoBounds'

/**
 * Issue#145: 確認画面ミニマップの自動フィット用 bounds 計算
 * 2 点を内包する [[minLng, minLat], [maxLng, maxLat]] を返す純粋関数。
 */
describe('computeBoundsForPins', () => {
  it('2 点を内包する [[minLng,minLat],[maxLng,maxLat]] を返す', () => {
    const a = { lng: 139.70, lat: 35.65 }
    const b = { lng: 139.76, lat: 35.68 }
    expect(computeBoundsForPins(a, b)).toEqual([
      [139.70, 35.65],
      [139.76, 35.68],
    ])
  })

  it('引数の順序が逆でも min/max が正しく並ぶ', () => {
    const a = { lng: 139.76, lat: 35.68 }
    const b = { lng: 139.70, lat: 35.65 }
    expect(computeBoundsForPins(a, b)).toEqual([
      [139.70, 35.65],
      [139.76, 35.68],
    ])
  })

  it('経度・緯度が混在してずれていても各軸で min/max を取る', () => {
    const a = { lng: 139.76, lat: 35.65 }
    const b = { lng: 139.70, lat: 35.68 }
    expect(computeBoundsForPins(a, b)).toEqual([
      [139.70, 35.65],
      [139.76, 35.68],
    ])
  })

  it('同一座標なら同じ点が 2 回返る', () => {
    const a = { lng: 139.70, lat: 35.65 }
    expect(computeBoundsForPins(a, a)).toEqual([
      [139.70, 35.65],
      [139.70, 35.65],
    ])
  })
})
