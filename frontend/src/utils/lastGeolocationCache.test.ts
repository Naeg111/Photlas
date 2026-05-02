/**
 * Issue#111: ユーザーの最後の位置情報キャッシュのテスト
 *
 * 注意: テスト全体の setup（src/test/setup.ts）で localStorage を vi.fn() でモック化しているため、
 *       本テスト内では Map ベースの実用的なストア実装で localStorage を上書きする。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getLastGeolocationCache,
  setLastGeolocationCache,
  LAST_GEOLOCATION_CACHE_KEY,
  LAST_GEOLOCATION_CACHE_TTL_MS,
} from './lastGeolocationCache'

describe('lastGeolocationCache - Issue#111', () => {
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

  it('Issue#111 - キャッシュ保存後、同じ座標が読み出せる', () => {
    setLastGeolocationCache(35.6585, 139.7454)
    expect(getLastGeolocationCache()).toEqual({ lat: 35.6585, lng: 139.7454 })
  })

  it('Issue#111 - キャッシュが存在しない場合 null を返す', () => {
    expect(getLastGeolocationCache()).toBeNull()
  })

  it('Issue#111 - 24時間（TTL）以内のキャッシュは有効', () => {
    setLastGeolocationCache(35.6585, 139.7454)

    // 23時間59分後 → 有効
    vi.advanceTimersByTime(23 * 60 * 60 * 1000 + 59 * 60 * 1000)
    expect(getLastGeolocationCache()).toEqual({ lat: 35.6585, lng: 139.7454 })
  })

  it('Issue#111 - 24時間経過後のキャッシュは期限切れとして null を返す', () => {
    setLastGeolocationCache(35.6585, 139.7454)

    // 24時間1秒後 → 期限切れ
    vi.advanceTimersByTime(LAST_GEOLOCATION_CACHE_TTL_MS + 1000)
    expect(getLastGeolocationCache()).toBeNull()
  })

  it('Issue#111 - キャッシュキーが規約通り（photlas_last_geolocation）', () => {
    expect(LAST_GEOLOCATION_CACHE_KEY).toBe('photlas_last_geolocation')
  })

  it('Issue#111 - TTLが24時間（86400000ms）', () => {
    expect(LAST_GEOLOCATION_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000)
  })

  it('Issue#111 - 不正なJSONがキャッシュにある場合は null を返す（クラッシュしない）', () => {
    localStorage.setItem(LAST_GEOLOCATION_CACHE_KEY, 'invalid-json{{{')
    expect(getLastGeolocationCache()).toBeNull()
  })

  it('Issue#111 - lat/lng の型が壊れている場合は null を返す', () => {
    localStorage.setItem(
      LAST_GEOLOCATION_CACHE_KEY,
      JSON.stringify({ lat: 'oops', lng: 139.7454, timestamp: Date.now() }),
    )
    expect(getLastGeolocationCache()).toBeNull()
  })

  it('Issue#111 - localStorage 書き込みに失敗してもクラッシュしない', () => {
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

    expect(() => setLastGeolocationCache(35.6585, 139.7454)).not.toThrow()
  })

  it('Issue#111 - 後から保存した座標で上書きされる', () => {
    setLastGeolocationCache(35.6585, 139.7454)
    setLastGeolocationCache(34.6937, 135.5023) // 大阪
    expect(getLastGeolocationCache()).toEqual({ lat: 34.6937, lng: 135.5023 })
  })
})
