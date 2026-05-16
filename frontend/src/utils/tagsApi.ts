/**
 * Issue#135: キーワード REST API クライアント。
 *
 * GET /api/v1/tags でアクティブな全キーワード + カテゴリ紐付けを取得する。
 */

import { API_V1_URL } from '../config/api'
import { fetchJson } from './fetchJson'
import type { KeywordTag } from '../components/KeywordSection'

export interface TagListResponse {
  tags: KeywordTag[]
}

/**
 * アクティブなキーワード一覧を取得する。
 *
 * @param lang ISO 言語コード（"ja"/"en"/"zh"/"ko"/"es"）
 * @param options signal などのオプション
 */
export async function fetchTags(
  lang: string,
  options: { signal?: AbortSignal } = {}
): Promise<TagListResponse> {
  const url = `${API_V1_URL}/tags?lang=${encodeURIComponent(lang)}`
  return fetchJson<TagListResponse>(url, {
    method: 'GET',
    requireAuth: false,
    signal: options.signal,
  })
}
