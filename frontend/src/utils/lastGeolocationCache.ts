/**
 * Issue#111: ユーザーの最後の位置情報を localStorage にキャッシュする。
 *
 * MapView の autoCenter / centerOnUserLocation で getCurrentPosition / watchPosition が
 * 成功するたびにキャッシュを更新し、InlineMapPicker（写真投稿マップ）が同期的に読み出して
 * 初期表示位置として使用する。
 *
 * 24 時間で自動的に期限切れ（IP 国判定キャッシュと同じ TTL）。
 *
 * Red 段階（Issue#111）: スタブ実装。Green 段階で実装する。
 */

export const LAST_GEOLOCATION_CACHE_KEY = 'photlas_last_geolocation'
export const LAST_GEOLOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * キャッシュからユーザーの最後の位置情報を取得する。
 * Red 段階: 常に null を返すスタブ。
 */
export function getLastGeolocationCache(): { lat: number; lng: number } | null {
  return null
}

/**
 * ユーザーの最後の位置情報を localStorage に保存する。
 * Red 段階: 何もしないスタブ。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setLastGeolocationCache(_lat: number, _lng: number): void {
  // Red 段階のスタブ: テストを失敗させるため何もしない
}
