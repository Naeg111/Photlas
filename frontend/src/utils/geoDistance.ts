/**
 * Issue#146: 2 点間の距離（メートル）を返す haversine 純粋関数。
 *
 * 撮影場所指摘の距離バリデーション（30m 下限・1km 上限）と、
 * アップロード時の GPS 1km 制限の両方で使う。
 * バックエンド（SpotRepository / LocationSuggestionService）と同じ
 * 地球半径 6371000m を用いるため、フロントとサーバーの判定が一致する。
 */
const EARTH_RADIUS_METERS = 6371000

/**
 * Issue#146: 撮影場所指摘の下限距離（メートル）。
 * 元の撮影場所からこれ未満は「近すぎる誤差レベルの指摘」として全写真で拒否する。
 * バックエンドの安全網（LocationSuggestionService）と同じ閾値。
 */
export const MIN_SUGGESTION_DISTANCE_METERS = 30

/**
 * Issue#146: GPS 由来写真に適用する上限距離（メートル）。
 * - 指摘: GPS 写真は元の撮影場所からこれを超える指摘を拒否する。
 * - アップロード: GPS 写真はピンを GPS 地点からこの半径内に制限する。
 * いずれも「GPS 写真は位置がおおむね正しい」前提に基づく同一ルール。
 */
export const MAX_GPS_DISTANCE_METERS = 1000

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

export function geoDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_METERS * 2 * Math.asin(Math.sqrt(a))
}
