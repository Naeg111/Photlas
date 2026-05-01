/**
 * Issue#106: 国コード → 座標マップのテスト
 */
import { describe, it, expect } from 'vitest'
import { COUNTRY_COORDINATES, getCountryCoordinates } from './countryCoordinates'

describe('COUNTRY_COORDINATES', () => {
  it('Issue#106 - 主要国（JP, US, GB, FR, DE, KR, CN, AU）に対して有効な座標を持つ', () => {
    const requiredCountries = ['JP', 'US', 'GB', 'FR', 'DE', 'KR', 'CN', 'AU']
    for (const code of requiredCountries) {
      const entry = COUNTRY_COORDINATES[code]
      expect(entry, `Country ${code} should be defined`).toBeDefined()
      expect(typeof entry.lat).toBe('number')
      expect(typeof entry.lng).toBe('number')
      expect(typeof entry.zoom).toBe('number')
      expect(entry.lat).toBeGreaterThanOrEqual(-90)
      expect(entry.lat).toBeLessThanOrEqual(90)
      expect(entry.lng).toBeGreaterThanOrEqual(-180)
      expect(entry.lng).toBeLessThanOrEqual(180)
      expect(entry.zoom).toBeGreaterThanOrEqual(4)
      expect(entry.zoom).toBeLessThanOrEqual(8)
    }
  })

  it('Issue#106 - 大規模国（US, CN, AU）はズーム4を使う', () => {
    expect(COUNTRY_COORDINATES.US.zoom).toBe(4)
    expect(COUNTRY_COORDINATES.CN.zoom).toBe(4)
    expect(COUNTRY_COORDINATES.AU.zoom).toBe(4)
  })

  it('Issue#106 - 200カ国前後のエントリを持つ（最低150）', () => {
    const count = Object.keys(COUNTRY_COORDINATES).length
    expect(count).toBeGreaterThanOrEqual(150)
  })
})

describe('getCountryCoordinates', () => {
  it('Issue#106 - 存在する国コードに対して座標を返す', () => {
    const result = getCountryCoordinates('JP')
    expect(result).toBeDefined()
    expect(result?.lat).toBeCloseTo(36.2, 1)
    expect(result?.lng).toBeCloseTo(138.3, 1)
  })

  it('Issue#106 - 存在しない国コードに対して undefined を返す', () => {
    const result = getCountryCoordinates('XX')
    expect(result).toBeUndefined()
  })

  it('Issue#106 - null/空文字に対して undefined を返す', () => {
    expect(getCountryCoordinates(null)).toBeUndefined()
    expect(getCountryCoordinates('')).toBeUndefined()
  })
})
