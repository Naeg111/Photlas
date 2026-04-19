/**
 * Issue#96: ApiError 拡張のテスト
 * - retryAfterSeconds / responseData をコンストラクタで受け取れる
 * - isRateLimited ゲッター（status === 429）
 * - 既存コンストラクタ呼び出し (message, status) は後方互換で動作
 */

import { describe, it, expect } from 'vitest'
import { ApiError } from './apiClient'

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
})
