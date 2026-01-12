/**
 * API Client ユーティリティ
 * Issue#16: フィルター機能 - APIクライアント
 */

const API_BASE_URL = '/api/v1';

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
