/**
 * Issue#96: fetchJson<T> 共通ラッパーのテスト
 *
 * 仕様（Issue#96 3.1-2）:
 *   - non-OK で ApiError を throw（responseData と retryAfterSeconds を埋める）
 *   - 429 の場合は Retry-After ヘッダを解析、欠落時は 60 秒デフォルト
 *   - Content-Type application/json なら JSON.parse、失敗なら生テキスト、text/* なら生テキスト
 *   - 204 No Content はボディなし（responseData=undefined、戻り値=undefined）
 *   - 200 OK の JSON を型付きで返す
 *   - requireAuth: true で Authorization ヘッダを自動付与
 *   - FormData ボディは Content-Type を自動設定しない（ブラウザに委ねる）
 *   - object ボディは JSON.stringify + Content-Type: application/json
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError } from './apiClient'
import { fetchJson, DEFAULT_RETRY_AFTER_SECONDS } from './fetchJson'

// localStorage.getItem は test/setup.ts でモック済み
const mockLocalGet = localStorage.getItem as unknown as ReturnType<typeof vi.fn>

describe('fetchJson', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    mockLocalGet.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('DEFAULT_RETRY_AFTER_SECONDS', () => {
    it('60 で定義されている', () => {
      expect(DEFAULT_RETRY_AFTER_SECONDS).toBe(60)
    })
  })

  describe('正常系レスポンス', () => {
    it('200 OK の JSON ボディをパースして返す', async () => {
      const payload = { id: 1, name: 'foo' }
      ;(global.fetch as any).mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await fetchJson<typeof payload>('https://example.com/api/v1/foo')
      expect(result).toEqual(payload)
    })

    it('204 No Content は undefined を返す', async () => {
      ;(global.fetch as any).mockResolvedValue(new Response(null, { status: 204 }))

      const result = await fetchJson('https://example.com/api/v1/foo', { method: 'DELETE' })
      expect(result).toBeUndefined()
    })

    it('デフォルトメソッドは GET', async () => {
      ;(global.fetch as any).mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      )
      await fetchJson('https://example.com/api/v1/foo')
      const call = (global.fetch as any).mock.calls[0]
      const init = call[1] ?? {}
      expect(init.method ?? 'GET').toBe('GET')
    })
  })

  describe('ボディシリアライズ', () => {
    it('object ボディは JSON.stringify され Content-Type: application/json が付く', async () => {
      ;(global.fetch as any).mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      )
      await fetchJson('https://example.com/api/v1/foo', {
        method: 'POST',
        body: { email: 'a@example.com' },
      })

      const [, init] = (global.fetch as any).mock.calls[0]
      expect(init.body).toBe(JSON.stringify({ email: 'a@example.com' }))
      const headers = new Headers(init.headers)
      expect(headers.get('Content-Type')).toBe('application/json')
    })

    it('FormData ボディは Content-Type を自動設定しない', async () => {
      ;(global.fetch as any).mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      )
      const fd = new FormData()
      fd.append('file', new Blob(['x']), 'a.bin')
      await fetchJson('https://example.com/api/v1/upload', { method: 'POST', body: fd })

      const [, init] = (global.fetch as any).mock.calls[0]
      expect(init.body).toBe(fd)
      const headers = new Headers(init.headers)
      expect(headers.get('Content-Type')).toBeNull()
    })

    it('string ボディはそのまま渡す（JSON.stringify しない）', async () => {
      ;(global.fetch as any).mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      )
      await fetchJson('https://example.com/api/v1/foo', {
        method: 'POST',
        body: 'raw-string',
      })

      const [, init] = (global.fetch as any).mock.calls[0]
      expect(init.body).toBe('raw-string')
    })
  })

  describe('認証ヘッダ', () => {
    it('requireAuth: true のとき auth_token を Authorization ヘッダに付与', async () => {
      mockLocalGet.mockImplementation((k: string) =>
        k === 'auth_token' ? 'jwt-abc' : null
      )
      ;(global.fetch as any).mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      )

      await fetchJson('https://example.com/api/v1/me', { requireAuth: true })

      const [, init] = (global.fetch as any).mock.calls[0]
      const headers = new Headers(init.headers)
      expect(headers.get('Authorization')).toBe('Bearer jwt-abc')
    })

    it('requireAuth: false（デフォルト）のとき Authorization を付けない', async () => {
      mockLocalGet.mockImplementation((k: string) =>
        k === 'auth_token' ? 'jwt-abc' : null
      )
      ;(global.fetch as any).mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      )

      await fetchJson('https://example.com/api/v1/public')

      const [, init] = (global.fetch as any).mock.calls[0]
      const headers = new Headers(init.headers)
      expect(headers.get('Authorization')).toBeNull()
    })
  })

  describe('non-OK レスポンス', () => {
    it('404 で ApiError を throw し status を保持する', async () => {
      ;(global.fetch as any).mockResolvedValue(
        new Response('not found', {
          status: 404,
          headers: { 'Content-Type': 'text/plain' },
        })
      )

      try {
        await fetchJson('https://example.com/api/v1/missing')
        throw new Error('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).status).toBe(404)
        expect((err as ApiError).responseData).toBe('not found')
      }
    })

    it('500 で JSON エラーボディを responseData に格納', async () => {
      const body = { error: 'Internal Server Error', code: 'SERVER_ERROR' }
      ;(global.fetch as any).mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      try {
        await fetchJson('https://example.com/api/v1/foo')
        throw new Error('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).responseData).toEqual(body)
      }
    })
  })

  describe('429 Retry-After ヘッダ解析', () => {
    it('Retry-After ヘッダから retryAfterSeconds を設定', async () => {
      ;(global.fetch as any).mockResolvedValue(
        new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '45' },
        })
      )

      try {
        await fetchJson('https://example.com/api/v1/auth/login', { method: 'POST' })
        throw new Error('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).isRateLimited).toBe(true)
        expect((err as ApiError).retryAfterSeconds).toBe(45)
      }
    })

    it('Retry-After ヘッダ欠落時は DEFAULT_RETRY_AFTER_SECONDS (60) を使う', async () => {
      ;(global.fetch as any).mockResolvedValue(
        new Response('too many', {
          status: 429,
          headers: { 'Content-Type': 'text/plain' },
        })
      )

      try {
        await fetchJson('https://example.com/api/v1/auth/login', { method: 'POST' })
        throw new Error('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).retryAfterSeconds).toBe(60)
      }
    })

    it('Retry-After が数値として不正な場合もデフォルト 60 を使う', async () => {
      ;(global.fetch as any).mockResolvedValue(
        new Response('', {
          status: 429,
          headers: { 'Retry-After': 'not-a-number' },
        })
      )

      try {
        await fetchJson('https://example.com/api/v1/foo')
        throw new Error('should have thrown')
      } catch (err) {
        expect((err as ApiError).retryAfterSeconds).toBe(60)
      }
    })
  })

  describe('ボディ解析ルール', () => {
    it('Content-Type application/json でマルファームドなら生テキストを responseData に格納', async () => {
      ;(global.fetch as any).mockResolvedValue(
        new Response('{not json', {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      try {
        await fetchJson('https://example.com/api/v1/foo')
        throw new Error('should have thrown')
      } catch (err) {
        expect((err as ApiError).responseData).toBe('{not json')
      }
    })

    it('空ボディ + non-OK は responseData = undefined', async () => {
      ;(global.fetch as any).mockResolvedValue(
        new Response('', { status: 500, headers: { 'Content-Type': 'application/json' } })
      )

      try {
        await fetchJson('https://example.com/api/v1/foo')
        throw new Error('should have thrown')
      } catch (err) {
        expect((err as ApiError).responseData).toBeUndefined()
      }
    })
  })

  describe('AbortSignal 対応', () => {
    it('signal オプションが fetch の init に渡る', async () => {
      ;(global.fetch as any).mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      )
      const controller = new AbortController()
      await fetchJson('https://example.com/api/v1/foo', { signal: controller.signal })

      const [, init] = (global.fetch as any).mock.calls[0]
      expect(init.signal).toBe(controller.signal)
    })
  })
})
