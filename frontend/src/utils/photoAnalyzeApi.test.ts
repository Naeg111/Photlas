/**
 * Issue#119 - photoAnalyzeApi の単体テスト。
 *
 * globalThis.fetch を vi.fn() で差し替えて HTTP 層の挙動を検証する
 * （apiClient.test.ts と同じパターン）。
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { analyzePhoto } from './photoAnalyzeApi'
import { ApiError } from './apiClient'

// setup.ts で localStorage のメソッドが vi.fn() でモック化されている
// （sessionStorage は jsdom 標準のため触らない）
const localStorageGetItemMock = localStorage.getItem as unknown as Mock

const ANALYZE_URL_FRAGMENT = '/api/v1/photos/analyze'

describe('analyzePhoto', () => {
  let originalFetch: typeof globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  const validResponseBody = {
    categories: [201, 204],
    weather: 401,
    confidence: { '201': 92.5, '204': 78.0, '401': 85.0 },
    analyzeToken: 'token-uuid-1234',
    // Issue#132: 新規フィールドを含む（発火なし時は空配列）
    parentFallbacks: [],
    exifRulesFired: [],
  }

  function mockOk(body: unknown) {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    })
  }

  function mockError(status: number, body?: unknown, retryAfter?: string) {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    if (retryAfter) {
      headers.set('Retry-After', retryAfter)
    }
    fetchMock.mockResolvedValue({
      ok: false,
      status,
      headers,
      text: async () => JSON.stringify(body ?? {}),
    })
  }

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
    localStorageGetItemMock.mockReturnValue(null)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorageGetItemMock.mockReset()
  })

  // ========== 正常系 ==========

  it('Issue#119 - 成功時にパース済みレスポンスを返す', async () => {
    mockOk(validResponseBody)
    const file = new Blob(['fake-jpeg'], { type: 'image/jpeg' })

    const response = await analyzePhoto(file)

    expect(response).toEqual(validResponseBody)
  })

  it('Issue#119 - POST /api/v1/photos/analyze に送信される', async () => {
    mockOk(validResponseBody)
    const file = new Blob(['fake-jpeg'], { type: 'image/jpeg' })

    await analyzePhoto(file)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain(ANALYZE_URL_FRAGMENT)
    expect((init as RequestInit).method).toBe('POST')
  })

  it('Issue#119 - FormData に file パートが含まれる', async () => {
    mockOk(validResponseBody)
    const file = new Blob(['fake-jpeg'], { type: 'image/jpeg' })

    await analyzePhoto(file)

    const [, init] = fetchMock.mock.calls[0]
    const body = (init as RequestInit).body
    expect(body).toBeInstanceOf(FormData)
    const formData = body as FormData
    const filePart = formData.get('file')
    expect(filePart).toBeInstanceOf(Blob)
  })

  // ========== 認証 ==========

  it('Issue#119 - localStorage の auth_token を Authorization ヘッダーに付与する', async () => {
    localStorageGetItemMock.mockImplementation((key: string) =>
      key === 'auth_token' ? 'jwt-test-token' : null
    )
    mockOk(validResponseBody)
    const file = new Blob(['fake-jpeg'], { type: 'image/jpeg' })

    await analyzePhoto(file)

    const [, init] = fetchMock.mock.calls[0]
    // fetchJson は Headers オブジェクトを生成するため Headers#get で取り出す
    const headers = (init as RequestInit).headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer jwt-test-token')
  })

  // ========== AbortSignal ==========

  it('Issue#119 - AbortSignal が fetch に伝播する', async () => {
    mockOk(validResponseBody)
    const controller = new AbortController()
    const file = new Blob(['fake-jpeg'], { type: 'image/jpeg' })

    await analyzePhoto(file, { signal: controller.signal })

    const [, init] = fetchMock.mock.calls[0]
    expect((init as RequestInit).signal).toBe(controller.signal)
  })

  // ========== エラーハンドリング ==========

  it('Issue#119 - 401 で ApiError(isUnauthorized=true) を throw する', async () => {
    mockError(401, { message: 'unauthorized' })
    const file = new Blob(['fake-jpeg'], { type: 'image/jpeg' })

    await expect(analyzePhoto(file)).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      isUnauthorized: true,
    })
  })

  it('Issue#119 - 429 で ApiError(isRateLimited=true, retryAfterSeconds 解析) を throw する', async () => {
    mockError(429, { message: 'rate limited' }, '60')
    const file = new Blob(['fake-jpeg'], { type: 'image/jpeg' })

    let caught: unknown = null
    try {
      await analyzePhoto(file)
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(ApiError)
    const err = caught as ApiError
    expect(err.status).toBe(429)
    expect(err.isRateLimited).toBe(true)
    expect(err.retryAfterSeconds).toBe(60)
  })

  it('Issue#119 - 500 で ApiError を throw する', async () => {
    mockError(500, { message: 'server error' })
    const file = new Blob(['fake-jpeg'], { type: 'image/jpeg' })

    await expect(analyzePhoto(file)).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
    })
  })

  // ========== Issue#132: 拡張フィールド ==========

  it('Issue#132 - レスポンスに parentFallbacks / exifRulesFired が含まれてもパースできる', async () => {
    const bodyWithIssue132 = {
      categories: [207],
      weather: null,
      confidence: { '207': 80 },
      analyzeToken: 'token',
      parentFallbacks: [{ childLabel: 'Husky', parentLabel: 'Dog', categoryCode: 207 }],
      exifRulesFired: [
        { rule: 'R1', categoryCode: 213, boostValue: 30, createdNewCandidate: true },
      ],
    }
    mockOk(bodyWithIssue132)
    const file = new Blob(['fake-jpeg'], { type: 'image/jpeg' })

    const response = await analyzePhoto(file)

    expect(response.parentFallbacks).toEqual([
      { childLabel: 'Husky', parentLabel: 'Dog', categoryCode: 207 },
    ])
    expect(response.exifRulesFired).toEqual([
      { rule: 'R1', categoryCode: 213, boostValue: 30, createdNewCandidate: true },
    ])
  })
})
