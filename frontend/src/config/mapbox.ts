/**
 * Mapbox設定
 * Issue#53: Google Maps API → Mapbox API 移行
 */

/** Mapbox アクセストークン */
export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''

/** Mapbox 地図スタイルURL */
export const MAPBOX_STYLE = 'mapbox://styles/mapbox/streets-v12'
