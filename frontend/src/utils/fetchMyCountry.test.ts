/**
 * Issue#106: IP国判定APIの呼び出し関数のテスト
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchMyCountry } from './fetchMyCountry'

describe('fetchMyCountry', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('Issue#106 - 200 OK + countryCode が返れば国コードを返す', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ countryCode: 'JP' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await fetchMyCountry()
    expect(result).toBe('JP')
  })

  it('Issue#106 - 200 OK + countryCode: null なら null を返す', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ countryCode: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await fetchMyCountry()
    expect(result).toBeNull()
  })

  it('Issue#106 - ネットワークエラー時は null を返す（例外を投げない）', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await fetchMyCountry()
    expect(result).toBeNull()
  })

  it('Issue#106 - 5xxエラー時は null を返す', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', { status: 500 })
    )

    const result = await fetchMyCountry()
    expect(result).toBeNull()
  })
})
