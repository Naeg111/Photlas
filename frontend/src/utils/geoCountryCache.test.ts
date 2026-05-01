/**
 * Issue#106: IP国判定キャッシュのテスト
 *
 * 注意: テスト全体の setup（src/test/setup.ts）で localStorage を vi.fn() でモック化しているため、
 *       本テスト内では Map ベースの実用的なストア実装で localStorage を上書きする。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getGeoCountryCache,
  setGeoCountryCache,
  GEO_COUNTRY_CACHE_KEY,
  GEO_COUNTRY_CACHE_TTL_MS,
} from './geoCountryCache'

describe('geoCountryCache', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map()
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => store.clear(),
        get length() {
          return store.size
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
      },
      configurable: true,
      writable: true,
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Issue#106 - キャッシュ保存後、同じ国コードが読み出せる', () => {
    setGeoCountryCache('JP')
    expect(getGeoCountryCache()).toBe('JP')
  })

  it('Issue#106 - キャッシュが存在しない場合 null を返す', () => {
    expect(getGeoCountryCache()).toBeNull()
  })

  it('Issue#106 - 24時間（TTL）以内のキャッシュは有効', () => {
    setGeoCountryCache('JP')

    // 23時間59分後 → 有効
    vi.advanceTimersByTime(23 * 60 * 60 * 1000 + 59 * 60 * 1000)
    expect(getGeoCountryCache()).toBe('JP')
  })

  it('Issue#106 - 24時間経過後のキャッシュは期限切れとして null を返す', () => {
    setGeoCountryCache('JP')

    // 24時間1秒後 → 期限切れ
    vi.advanceTimersByTime(GEO_COUNTRY_CACHE_TTL_MS + 1000)
    expect(getGeoCountryCache()).toBeNull()
  })

  it('Issue#106 - キャッシュキーが規約通り（photlas_geo_country）', () => {
    expect(GEO_COUNTRY_CACHE_KEY).toBe('photlas_geo_country')
  })

  it('Issue#106 - TTLが24時間（86400000ms）', () => {
    expect(GEO_COUNTRY_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000)
  })

  it('Issue#106 - 不正なJSONがキャッシュにある場合は null を返す（クラッシュしない）', () => {
    localStorage.setItem(GEO_COUNTRY_CACHE_KEY, 'invalid-json{{{')
    expect(getGeoCountryCache()).toBeNull()
  })

  it('Issue#106 - localStorage 書き込みに失敗してもクラッシュしない', () => {
    // localStorage.setItem を一時的に投げるように差し替え
    const original = (global as unknown as { localStorage: Storage }).localStorage
    Object.defineProperty(global, 'localStorage', {
      value: {
        ...original,
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      },
      configurable: true,
      writable: true,
    })

    // 例外を投げない
    expect(() => setGeoCountryCache('JP')).not.toThrow()
  })
})
