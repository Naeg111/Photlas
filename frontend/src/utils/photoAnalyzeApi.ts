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

/**
 * `POST /api/v1/photos/analyze` のレスポンス。
 * バックエンドの `PhotoAnalyzeResponse` (Java DTO) と1対1対応。
 *
 * AI 解析が失敗した場合（Rekognition エラー等）は全フィールドが空・null になる:
 * - categories: 空配列
 * - weather: null
 * - confidence: 空オブジェクト
 * - analyzeToken: null
 */
export interface PhotoAnalyzeResponse {
  categories: number[]
  weather: number | null
  confidence: Record<string, number>
  analyzeToken: string | null
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
  // Phase 7 Red 段階: スタブ実装（fetch を呼ばず空レスポンスを返す）
  return { categories: [], weather: null, confidence: {}, analyzeToken: null }
}
