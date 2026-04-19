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

  const finalHeaders = buildHeaders(headers, body, requireAuth)
  const finalBody = buildBody(body)

  const response = await fetch(url, { method, headers: finalHeaders, body: finalBody, signal })

  if (!response.ok) {
    throw await buildApiError(response)
  }

  return await parseSuccessBody<T>(response)
}

/**
 * リクエストヘッダを組み立てる。
 * - FormData 以外のボディには Content-Type: application/json を既定で付与（明示指定があれば上書きしない）
 * - requireAuth=true なら getAuthHeaders() の内容を追加
 */
function buildHeaders(
  headers: Record<string, string>,
  body: unknown,
  requireAuth: boolean
): Headers {
  const finalHeaders = new Headers(headers)

  const needsJsonContentType = body !== undefined && body !== null && !(body instanceof FormData)
  if (needsJsonContentType && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }

  if (requireAuth) {
    const authHeaders = getAuthHeaders() as Record<string, string>
    for (const [k, v] of Object.entries(authHeaders)) {
      finalHeaders.set(k, v)
    }
  }

  return finalHeaders
}

/**
 * リクエストボディを BodyInit に変換する。
 * - undefined / null → undefined（ボディなし）
 * - FormData / string → そのまま（FormData は Content-Type を自動付与させない）
 * - それ以外 → JSON.stringify
 */
function buildBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined
  if (body instanceof FormData) return body
  if (typeof body === 'string') return body
  return JSON.stringify(body)
}

/**
 * non-OK レスポンスから ApiError を生成する。
 * 429 のときは Retry-After ヘッダを解析（欠落時は DEFAULT_RETRY_AFTER_SECONDS）。
 */
async function buildApiError(response: Response): Promise<ApiError> {
  const responseData = await parseErrorBody(response)
  const retryAfterSeconds =
    response.status === 429 ? parseRetryAfter(response.headers.get('Retry-After')) : undefined
  return new ApiError(
    `Request failed: ${response.status} ${response.statusText}`,
    response.status,
    retryAfterSeconds,
    responseData
  )
}

/**
 * 成功レスポンスのボディを解析する。
 * - 204 → undefined
 * - Content-Type application/json → JSON.parse 結果
 * - それ以外 → undefined（本体は呼び出し側で扱わない前提）
 */
async function parseSuccessBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
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
