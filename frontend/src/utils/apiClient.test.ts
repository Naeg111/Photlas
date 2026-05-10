/**
 * Issue#96: ApiError 拡張のテスト
 * - retryAfterSeconds / responseData をコンストラクタで受け取れる
 * - isRateLimited ゲッター（status === 429）
 * - 既存コンストラクタ呼び出し (message, status) は後方互換で動作
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ApiError,
  uploadFileToS3,
  S3_TAG_HEADER_NAME,
  S3_TAG_HEADER_VALUE_PENDING,
  S3_CACHE_CONTROL_VALUE,
} from './apiClient'

describe('ApiError (Issue#96 拡張)', () => {
  describe('コンストラクタ', () => {
    it('既存の 2 引数呼び出しで動作する（後方互換）', () => {
      const err = new ApiError('not found', 404)
      expect(err.message).toBe('not found')
      expect(err.status).toBe(404)
      expect(err.name).toBe('ApiError')
      expect(err.retryAfterSeconds).toBeUndefined()
      expect(err.responseData).toBeUndefined()
    })

    it('retryAfterSeconds を 3 番目の引数で受け取れる', () => {
      const err = new ApiError('rate limited', 429, 60)
      expect(err.retryAfterSeconds).toBe(60)
    })

    it('responseData を 4 番目の引数で受け取れる', () => {
      const body = { error: 'Too Many Requests', code: 'RATE_LIMIT_EXCEEDED' }
      const err = new ApiError('rate limited', 429, 60, body)
      expect(err.responseData).toEqual(body)
    })
  })

  describe('isUnauthorized ゲッター', () => {
    it('status が 401 のとき true を返す', () => {
      const err = new ApiError('unauthorized', 401)
      expect(err.isUnauthorized).toBe(true)
    })

    it('status が 401 以外のとき false を返す', () => {
      const err = new ApiError('forbidden', 403)
      expect(err.isUnauthorized).toBe(false)
    })
  })

  describe('isRateLimited ゲッター', () => {
    it('status が 429 のとき true を返す', () => {
      const err = new ApiError('rate limited', 429, 60)
      expect(err.isRateLimited).toBe(true)
    })

    it('status が 429 以外のとき false を返す', () => {
      const err401 = new ApiError('unauthorized', 401)
      const err500 = new ApiError('server error', 500)
      expect(err401.isRateLimited).toBe(false)
      expect(err500.isRateLimited).toBe(false)
    })
  })

  describe('既存エラーハンドラが拡張フィールド未指定でも throw できる', () => {
    it('getPhotoUploadUrl 系の呼び出しパターン（message, status のみ）', () => {
      expect(() => {
        throw new ApiError('Failed to upload: 500', 500)
      }).toThrow(ApiError)
    })
  })

  describe('getFieldErrorMessage (Issue#98)', () => {
    it('responseData に errors 配列があり指定フィールドが存在する場合、そのメッセージを返す', () => {
      const body = {
        message: '入力内容が無効です。',
        errors: [
          { field: 'username', rejectedValue: 'admin', message: 'errors.USERNAME_RESERVED' },
          { field: 'email', rejectedValue: 'foo', message: 'メールアドレスの形式が不正です' },
        ],
      }
      const err = new ApiError('Bad Request', 400, undefined, body)
      expect(err.getFieldErrorMessage('username')).toBe('errors.USERNAME_RESERVED')
    })

    it('email フィールドの固定日本語メッセージも取り出せる', () => {
      const body = {
        message: '入力内容が無効です。',
        errors: [
          { field: 'email', rejectedValue: 'foo', message: 'メールアドレスの形式が不正です' },
        ],
      }
      const err = new ApiError('Bad Request', 400, undefined, body)
      expect(err.getFieldErrorMessage('email')).toBe('メールアドレスの形式が不正です')
    })

    it('指定フィールドが errors 配列に存在しない場合は undefined', () => {
      const body = {
        message: '入力内容が無効です。',
        errors: [{ field: 'email', message: '...' }],
      }
      const err = new ApiError('Bad Request', 400, undefined, body)
      expect(err.getFieldErrorMessage('username')).toBeUndefined()
    })

    it('responseData が undefined の場合は undefined', () => {
      const err = new ApiError('Bad Request', 400)
      expect(err.getFieldErrorMessage('username')).toBeUndefined()
    })

    it('responseData に errors フィールドが無い場合は undefined', () => {
      const err = new ApiError('Bad Request', 400, undefined, { message: 'foo' })
      expect(err.getFieldErrorMessage('username')).toBeUndefined()
    })
  })
})

describe('Issue#100 - S3 タグベース孤立ファイル対応', () => {
  describe('定数', () => {
    it('S3_TAG_HEADER_NAME が "x-amz-tagging" として定義されている', () => {
      expect(S3_TAG_HEADER_NAME).toBe('x-amz-tagging')
    })

    it('S3_TAG_HEADER_VALUE_PENDING が "status=pending" として定義されている', () => {
      expect(S3_TAG_HEADER_VALUE_PENDING).toBe('status=pending')
    })
  })

  describe('uploadFileToS3', () => {
    let originalFetch: typeof globalThis.fetch
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      originalFetch = globalThis.fetch
      fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('S3 への PUT リクエストに x-amz-tagging: status=pending ヘッダーが含まれる', async () => {
      const blob = new Blob(['test'], { type: 'image/jpeg' })

      await uploadFileToS3('https://example.com/upload', blob)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const init = callArgs[1] as RequestInit
      const headers = init.headers as Record<string, string>

      // 文字列リテラルで明示的に検証（undefined === undefined の false-pass を防ぐ）
      expect(headers['x-amz-tagging']).toBe('status=pending')
    })
  })
})

describe('Issue#124 - Cache-Control immutable 化', () => {
  describe('定数', () => {
    it('S3_CACHE_CONTROL_VALUE が "public, max-age=31536000, immutable" として定義されている', () => {
      expect(S3_CACHE_CONTROL_VALUE).toBe('public, max-age=31536000, immutable')
    })
  })

  describe('uploadFileToS3', () => {
    let originalFetch: typeof globalThis.fetch
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      originalFetch = globalThis.fetch
      fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('S3 への PUT リクエストに Cache-Control: public, max-age=31536000, immutable が含まれる', async () => {
      const blob = new Blob(['test'], { type: 'image/jpeg' })

      await uploadFileToS3('https://example.com/upload', blob)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const init = callArgs[1] as RequestInit
      const headers = init.headers as Record<string, string>

      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable')
    })
  })
})

describe('Issue#131 - uploadFileToS3 で crop メタデータを送信', () => {
  let originalFetch: typeof globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('crop 引数を渡すと、x-amz-meta-crop-center-x/y, x-amz-meta-crop-zoom が %.4f で送信される', async () => {
    const blob = new Blob(['test'], { type: 'image/jpeg' })

    await uploadFileToS3('https://example.com/upload', blob, {
      cropCenterX: 0.3,
      cropCenterY: 0.7,
      cropZoom: 2.0,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const callArgs = fetchMock.mock.calls[0]
    const init = callArgs[1] as RequestInit
    const headers = init.headers as Record<string, string>

    expect(headers['x-amz-meta-crop-center-x']).toBe('0.3000')
    expect(headers['x-amz-meta-crop-center-y']).toBe('0.7000')
    expect(headers['x-amz-meta-crop-zoom']).toBe('2.0000')
  })

  it('crop 引数を渡さない（avatar 経路）と、x-amz-meta-crop-* ヘッダは含まれない', async () => {
    const blob = new Blob(['test'], { type: 'image/jpeg' })

    await uploadFileToS3('https://example.com/upload', blob)

    const callArgs = fetchMock.mock.calls[0]
    const init = callArgs[1] as RequestInit
    const headers = init.headers as Record<string, string>

    expect(headers['x-amz-meta-crop-center-x']).toBeUndefined()
    expect(headers['x-amz-meta-crop-center-y']).toBeUndefined()
    expect(headers['x-amz-meta-crop-zoom']).toBeUndefined()
  })
})
