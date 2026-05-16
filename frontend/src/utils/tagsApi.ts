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

/** Issue#135: 写真詳細ページ等で使う「表示用」キーワード DTO。 */
export interface PhotoTagDisplay {
  tagId: number
  slug: string
  displayName: string
}

export interface PhotoTagsResponse {
  tags: PhotoTagDisplay[]
}

/**
 * 指定写真に紐づくアクティブキーワードを取得する（写真詳細ページ用）。
 *
 * @param photoId 写真 ID
 * @param lang    ISO 言語コード
 * @param options signal などのオプション
 */
export async function fetchPhotoTags(
  photoId: number,
  lang: string,
  options: { signal?: AbortSignal } = {}
): Promise<PhotoTagsResponse> {
  const url = `${API_V1_URL}/photos/${photoId}/tags?lang=${encodeURIComponent(lang)}`
  return fetchJson<PhotoTagsResponse>(url, {
    method: 'GET',
    requireAuth: false,
    signal: options.signal,
  })
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
