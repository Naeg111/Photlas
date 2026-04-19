/**
 * API Client ユーティリティ
 * Issue#16: フィルター機能 - APIクライアント
 * Issue#30: 認証ヘッダー取得関数を追加
 */

import { API_V1_URL } from '../config/api';

const API_BASE_URL = API_V1_URL;

/**
 * API通信エラー
 * HTTPステータスコードを保持し、呼び出し元での分岐処理を可能にする
 *
 * Issue#96: retryAfterSeconds / responseData / isRateLimited を追加。
 * 既存の 2 引数呼び出し (message, status) はそのまま動作する（後方互換）。
 */
export class ApiError extends Error {
  readonly status: number
  readonly retryAfterSeconds?: number
  readonly responseData?: unknown

  constructor(
    message: string,
    status: number,
    retryAfterSeconds?: number,
    responseData?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
    this.responseData = responseData
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }

  /**
   * バックエンドが返す `{ message: string }` 形式のエラー本文から message を取り出す。
   * 本文がオブジェクトでない（生テキスト等）、または message フィールドが無い場合は undefined。
   * 呼び出し側で `err.responseMessage || t('fallback')` のように既定メッセージと併用する。
   */
  get responseMessage(): string | undefined {
    return (this.responseData as { message?: string } | undefined)?.message
  }
}

/**
 * 認証ヘッダーを取得する
 * Issue#9: AuthContextと同じトークンキー(auth_token)を使用
 * @returns 認証ヘッダー（トークンがない場合は空オブジェクト）
 */
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

/**
 * カテゴリーレスポンスの型定義
 */
export interface CategoryResponse {
  categoryId: number;
  name: string;
}

/**
 * スポットレスポンスの型定義
 */
export interface SpotResponse {
  spotId: number;
  latitude: number;
  longitude: number;
  title: string;
  pinColor: string;
  thumbnailUrl: string;
  photoCount: number;
}

/**
 * スポット検索パラメータの型定義
 */
export interface SpotSearchParams {
  north: number;
  south: number;
  east: number;
  west: number;
  subject_categories?: number[];
  months?: number[];
  times_of_day?: string[];
  weathers?: string[];
  device_type?: string;
  max_age_days?: number;
  aspect_ratio?: string;
  focal_length_range?: string;
  max_iso?: number;
}

/**
 * 全カテゴリーを取得
 * @returns カテゴリー一覧
 */
export async function fetchCategories(): Promise<CategoryResponse[]> {
  const response = await fetch(`${API_BASE_URL}/categories`);

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * スポットを検索（フィルター条件付き）
 * @param params 検索パラメータ
 * @returns スポット一覧
 */
export async function fetchSpots(params: SpotSearchParams): Promise<SpotResponse[]> {
  const searchParams = new URLSearchParams();

  // 必須パラメータ
  searchParams.append('north', params.north.toString());
  searchParams.append('south', params.south.toString());
  searchParams.append('east', params.east.toString());
  searchParams.append('west', params.west.toString());

  // オプショナルパラメータ
  if (params.subject_categories && params.subject_categories.length > 0) {
    params.subject_categories.forEach(id => searchParams.append('subject_categories', id.toString()));
  }

  if (params.months && params.months.length > 0) {
    params.months.forEach(month => searchParams.append('months', month.toString()));
  }

  if (params.times_of_day && params.times_of_day.length > 0) {
    params.times_of_day.forEach(time => searchParams.append('times_of_day', time));
  }

  if (params.weathers && params.weathers.length > 0) {
    params.weathers.forEach(weather => searchParams.append('weathers', weather));
  }

  const response = await fetch(`${API_BASE_URL}/spots?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch spots: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// ============================================================
// 写真投稿API（Issue#9: 写真アップロード処理）
// ============================================================

/**
 * Presigned URL取得リクエストの型定義
 */
export interface UploadUrlRequest {
  extension: string
  contentType: string
}

/**
 * Presigned URLレスポンスの型定義
 */
export interface UploadUrlResponse {
  uploadUrl: string
  objectKey: string
}

/**
 * 写真メタデータ作成リクエストの型定義
 */
export interface CreatePhotoRequest {
  placeName?: string
  s3ObjectKey: string
  takenAt: string
  latitude: number
  longitude: number
  categories: string[]
  weather?: number
  deviceType?: number
  cameraBody?: string
  cameraLens?: string
  focalLength35mm?: number
  fValue?: string
  shutterSpeed?: string
  iso?: number
  imageWidth?: number
  imageHeight?: number
  cropCenterX?: number
  cropCenterY?: number
  cropZoom?: number
}

/**
 * 写真レスポンスの型定義
 */
export interface PhotoResponse {
  photo: {
    photoId: number
    title: string
    s3ObjectKey: string
    shotAt: string
    weather: string | null
    isFavorited: boolean
    favoriteCount: number
  }
  spot: {
    spotId: number
    latitude: number
    longitude: number
  }
  user: {
    userId: number
    username: string
  }
}

/**
 * 写真アップロード用のPresigned URLを取得
 * @param request 拡張子とコンテンツタイプ
 * @returns Presigned URLとオブジェクトキー
 */
export async function getPhotoUploadUrl(request: UploadUrlRequest): Promise<UploadUrlResponse> {
  const response = await fetch(`${API_BASE_URL}/photos/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new ApiError(`Failed to get upload URL: ${response.status}`, response.status)
  }

  return response.json()
}

/**
 * S3にファイルをアップロード
 * @param uploadUrl Presigned URL
 * @param file アップロードするファイル
 */
export async function uploadFileToS3(uploadUrl: string, file: Blob): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  })

  if (!response.ok) {
    throw new ApiError(`Failed to upload file to S3: ${response.status}`, response.status)
  }
}

/**
 * 写真メタデータを保存
 * @param request 写真メタデータ
 * @returns 作成された写真情報
 */
export async function createPhoto(request: CreatePhotoRequest): Promise<PhotoResponse> {
  const response = await fetch(`${API_BASE_URL}/photos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new ApiError(`Failed to create photo: ${response.status}`, response.status)
  }

  return response.json()
}
