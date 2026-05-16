/**
 * Issue#119: 写真の AI 解析 API クライアント。
 *
 * `POST /api/v1/photos/analyze` を呼び出し、推定カテゴリ・天候・analyzeToken を取得する。
 * フロントは analyzeToken を保持し、投稿時に送り返すことで AI 結果を再取得できる。
 *
 * 内部では既存の `fetchJson` ラッパーを利用し、JWT 自動付与・FormData 対応・
 * AbortSignal 伝播・ApiError throw をすべて任せる。
 */

import { API_V1_URL } from '../config/api'
import { fetchJson } from './fetchJson'
import type { ExifRuleFire, ParentFallback } from './aiPrefillAnalytics'

/**
 * `POST /api/v1/photos/analyze` のレスポンス。
 * バックエンドの `PhotoAnalyzeResponse` (Java DTO) と1対1対応。
 *
 * AI 解析が失敗した場合（Rekognition エラー等）は全フィールドが空・null になる:
 * - categories: 空配列
 * - weather: null
 * - confidence: 空オブジェクト
 * - analyzeToken: null
 * - parentFallbacks: 空配列 (Issue#132)
 * - exifRulesFired: 空配列 (Issue#132)
 */
export interface PhotoAnalyzeResponse {
  categories: number[]
  weather: number | null
  confidence: Record<string, number>
  analyzeToken: string | null
  /** Issue#132: 親ラベル経由でマッピングが成立した発火イベント一覧 */
  parentFallbacks: ParentFallback[]
  /** Issue#132: EXIF ベースの補正ルール R1〜R5 の発火イベント一覧 */
  exifRulesFired: ExifRuleFire[]
}

export interface AnalyzePhotoOptions {
  /** タイムアウトやユーザーキャンセル用の AbortSignal */
  signal?: AbortSignal
}

/**
 * 画像ファイルを Rekognition で解析する。
 *
 * @param file    トリミング後の画像 Blob（typically JPEG、最大 10MB）
 * @param options signal などのオプション
 * @returns       AI 解析結果。失敗時は空フィールドのレスポンス（throw しない）
 * @throws        ApiError ネットワーク・認証・レート制限・5xx 等で fetchJson が throw する場合
 *                AbortError signal.abort() でキャンセルされた場合
 */
export async function analyzePhoto(
  file: Blob,
  options: AnalyzePhotoOptions = {}
): Promise<PhotoAnalyzeResponse> {
  const formData = new FormData()
  // multipart の file パート名はバックエンド @RequestParam("file") と揃える
  formData.append('file', file, 'photo.jpg')

  return fetchJson<PhotoAnalyzeResponse>(`${API_V1_URL}/photos/analyze`, {
    method: 'POST',
    body: formData,
    requireAuth: true,
    signal: options.signal,
  })
}
