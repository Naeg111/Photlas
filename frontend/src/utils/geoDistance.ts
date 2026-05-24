/**
 * Issue#146: 2 点間の距離（メートル）を返す haversine 純粋関数。
 *
 * 撮影場所指摘の距離バリデーション（30m 下限・1km 上限）と、
 * アップロード時の GPS 1km 制限の両方で使う。
 * バックエンド（SpotRepository / LocationSuggestionService）と同じ
 * 地球半径 6371000m を用いるため、フロントとサーバーの判定が一致する。
 */
const EARTH_RADIUS_METERS = 6371000

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
