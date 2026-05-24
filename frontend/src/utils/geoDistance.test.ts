import { describe, it, expect } from 'vitest'
import { geoDistance } from './geoDistance'

/**
 * Issue#146: 2 点間の距離（メートル）を返す haversine 純粋関数。
 * 撮影場所指摘の距離バリデーション（30m 下限・1km 上限）に使う。
 * バックエンド（SpotRepository）と同じ地球半径 6371000m を用いる。
 */
describe('geoDistance', () => {
  const TOKYO_LAT = 35.658581
  const TOKYO_LNG = 139.745433

  it('同一座標は 0 を返す', () => {
    expect(geoDistance(TOKYO_LAT, TOKYO_LNG, TOKYO_LAT, TOKYO_LNG)).toBe(0)
  })

  it('緯度のみ 0.001 度離れた点は約 111.19m', () => {
    const d = geoDistance(TOKYO_LAT, TOKYO_LNG, TOKYO_LAT + 0.001, TOKYO_LNG)
    expect(d).toBeCloseTo(111.19, 1)
  })

  it('赤道上で経度のみ 0.001 度離れた点は約 111.19m（球体 6371000m 基準）', () => {
    const d = geoDistance(0, 0, 0, 0.001)
    expect(d).toBeCloseTo(111.19, 1)
  })

  it('緯度を約 1000m 分ずらした点は約 1000m を返す', () => {
    // 6371000 * PI / 180 = 緯度 1 度あたりのメートル数
    const metersPerDegree = (6371000 * Math.PI) / 180
    const offsetLat = TOKYO_LAT + 1000 / metersPerDegree
    const d = geoDistance(TOKYO_LAT, TOKYO_LNG, offsetLat, TOKYO_LNG)
    expect(d).toBeCloseTo(1000, 0)
  })

  it('東京駅〜東京タワー間はおよそ 3.1〜3.3km の範囲に収まる', () => {
    // 東京駅(35.681236, 139.767125) と東京タワー(35.658581, 139.745433)
    const d = geoDistance(35.681236, 139.767125, 35.658581, 139.745433)
    expect(d).toBeGreaterThan(3100)
    expect(d).toBeLessThan(3300)
  })
})
