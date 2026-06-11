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
 * AI 解析が失敗した場合（Rekognition エラー等）は全フィールドが空・null になる。
 */
export interface SuggestedTag {
  tagId: number
  slug: string
  displayName: string
  confidence: number
}

export interface PhotoAnalyzeResponse {
  categories: number[]
  weather: number | null
  confidence: Record<string, number>
  analyzeToken: string | null
  /** Issue#132: 親ラベル経由でマッピングが成立した発火イベント一覧 */
  parentFallbacks: ParentFallback[]
  /** Issue#132: EXIF ベースの補正ルール R1〜R5 の発火イベント一覧 */
  exifRulesFired: ExifRuleFire[]
  /** Issue#135: AI 提案キーワード（直接マッチのみ、最大 10 件） */
  suggestedTags: SuggestedTag[]
}

/**
 * Issue#142: 解析時にカテゴリ判定の EXIF ルール（R1〜R5 / R3.5）へ渡す EXIF 値。
 * 解析用画像は canvas 再エンコードで EXIF が剥がれるため、必要な値だけを別送する。
 * GPS 緯度経度は送らない。
 */
export interface AnalyzeExifFields {
  focalLength35mm?: number
  iso?: number
  exposureTimeSeconds?: number
  /** ISO8601 ローカル日時文字列（ExifData.takenAt をそのまま渡す） */
  dateTimeOriginal?: string
  gpsAltitude?: number
}

export interface AnalyzePhotoOptions {
  /** タイムアウトやユーザーキャンセル用の AbortSignal */
  signal?: AbortSignal
  /** Issue#142: 解析に渡す EXIF 値（任意。EXIF が無ければ省略） */
  exif?: AnalyzeExifFields
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

  // Issue#142: EXIF 値をフォーム値として別送（バックエンド @RequestParam と名前を揃える）。
  // 値はバックエンドで再検証され、解析中のみ使用・非保存。
  const exif = options.exif
  if (exif) {
    if (exif.focalLength35mm != null) formData.append('focalLength35mm', String(exif.focalLength35mm))
    if (exif.iso != null) formData.append('iso', String(exif.iso))
    if (exif.exposureTimeSeconds != null) formData.append('exposureTimeSeconds', String(exif.exposureTimeSeconds))
    if (exif.dateTimeOriginal != null) formData.append('dateTimeOriginal', exif.dateTimeOriginal)
    if (exif.gpsAltitude != null) formData.append('gpsAltitude', String(exif.gpsAltitude))
  }

  return fetchJson<PhotoAnalyzeResponse>(`${API_V1_URL}/photos/analyze`, {
    method: 'POST',
    body: formData,
    requireAuth: true,
    signal: options.signal,
  })
}
