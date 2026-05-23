/**
 * Issue#145: 確認画面ミニマップの自動フィット用 bounds 計算。
 *
 * 元の撮影場所と指摘位置の 2 点を必ず内包する矩形を
 * `[[minLng, minLat], [maxLng, maxLat]]` 形式で返す純粋関数。
 * react-map-gl の `initialViewState.bounds` にそのまま渡せる。
 * 指摘位置に距離制限が無く 2 点が大きく離れうるため、固定ズームではなく
 * この bounds で両ピンを必ず画面内に収める。
 */
export interface LngLat {
  lng: number
  lat: number
}

export function computeBoundsForPins(
  a: LngLat,
  b: LngLat,
): [[number, number], [number, number]] {
  return [
    [Math.min(a.lng, b.lng), Math.min(a.lat, b.lat)],
    [Math.max(a.lng, b.lng), Math.max(a.lat, b.lat)],
  ]
}
