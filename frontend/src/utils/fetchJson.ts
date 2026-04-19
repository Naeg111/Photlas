/**
 * Issue#96: fetch 共通ラッパー `fetchJson<T>`
 *
 * - non-OK レスポンスで `ApiError` を throw
 * - 429 は `Retry-After` ヘッダから秒数を解析（欠落時は 60 秒）
 * - `Content-Type: application/json` なら自動で `JSON.parse`（失敗時は生テキストを保持）
 * - `204 No Content` は `undefined` を返す
 * - `requireAuth: true` で `Authorization: Bearer <token>` を自動付与
 * - `FormData` ボディは `Content-Type` を自動設定しない（ブラウザに委譲）
 * - object ボディは `JSON.stringify` + `Content-Type: application/json`
 *
 * URL は呼び出し側で完全 URL（`${API_V1_URL}/...`）を渡す。相対パス prepend は行わない。
 */

import { ApiError, getAuthHeaders } from './apiClient'

/** Retry-After ヘッダ欠落時の既定秒数（サーバ実装と揃える） */
export const DEFAULT_RETRY_AFTER_SECONDS = 60

export interface FetchJsonOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  requireAuth?: boolean
  signal?: AbortSignal
}

export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, requireAuth = false, signal } = options

  const finalHeaders = new Headers(headers)
  let finalBody: BodyInit | undefined

  if (body instanceof FormData) {
    finalBody = body
  } else if (typeof body === 'string') {
    finalBody = body
    if (!finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json')
    }
  } else if (body !== undefined && body !== null) {
    finalBody = JSON.stringify(body)
    if (!finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json')
    }
  }

  if (requireAuth) {
    const authHeaders = getAuthHeaders() as Record<string, string>
    for (const [k, v] of Object.entries(authHeaders)) {
      finalHeaders.set(k, v)
    }
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: finalBody,
    signal,
  })

  if (!response.ok) {
    const responseData = await parseErrorBody(response)
    const retryAfterSeconds =
      response.status === 429 ? parseRetryAfter(response.headers.get('Retry-After')) : undefined
    throw new ApiError(
      `Request failed: ${response.status} ${response.statusText}`,
      response.status,
      retryAfterSeconds,
      responseData
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.includes('application/json')) {
    return (await response.json()) as T
  }
  return undefined as T
}

/**
 * non-OK レスポンスのボディを可能な限り解析する。
 *   - 204 / ボディ空文字列 → undefined
 *   - application/json → JSON.parse（失敗時は生テキスト）
 *   - それ以外 → 生テキスト
 */
async function parseErrorBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (text === '') return undefined

  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

/**
 * `Retry-After` ヘッダを秒数に変換する。
 * - 数値文字列（RFC 9110 §10.2.3 の delta-seconds）のみ対応
 * - 欠落・不正値は `DEFAULT_RETRY_AFTER_SECONDS` を返す
 */
function parseRetryAfter(headerValue: string | null): number {
  if (!headerValue) return DEFAULT_RETRY_AFTER_SECONDS
  const parsed = Number.parseInt(headerValue, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RETRY_AFTER_SECONDS
  return parsed
}
