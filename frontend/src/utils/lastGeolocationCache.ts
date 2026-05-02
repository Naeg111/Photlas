/**
 * Issue#111: ユーザーの最後の位置情報を localStorage にキャッシュする。
 *
 * MapView の autoCenter / centerOnUserLocation で getCurrentPosition / watchPosition が
 * 成功するたびにキャッシュを更新し、InlineMapPicker（写真投稿マップ）が同期的に読み出して
 * 初期表示位置として使用する。
 *
 * 24 時間で自動的に期限切れ（IP 国判定キャッシュと同じ TTL）。
 *
 * `geoCountryCache.ts` と同じパターンで実装している。
 */

export const LAST_GEOLOCATION_CACHE_KEY = 'photlas_last_geolocation'
export const LAST_GEOLOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface LastGeolocationCacheEntry {
  lat: number
  lng: number
  timestamp: number
}

/**
 * キャッシュからユーザーの最後の位置情報を取得する。
 * - キャッシュがない、または期限切れ（24時間超過）の場合は null を返す。
 * - localStorage の中身が壊れている場合も null を返す（クラッシュしない）。
 */
export function getLastGeolocationCache(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(LAST_GEOLOCATION_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as LastGeolocationCacheEntry
    if (
      typeof parsed.lat !== 'number' ||
      typeof parsed.lng !== 'number' ||
      typeof parsed.timestamp !== 'number'
    ) {
      return null
    }

    const ageMs = Date.now() - parsed.timestamp
    if (ageMs >= LAST_GEOLOCATION_CACHE_TTL_MS) {
      return null
    }

    return { lat: parsed.lat, lng: parsed.lng }
  } catch {
    return null
  }
}

/**
 * ユーザーの最後の位置情報を localStorage に保存する。
 * 書き込み失敗（QuotaExceededError 等）してもクラッシュしない。
 */
export function setLastGeolocationCache(lat: number, lng: number): void {
  try {
    const entry: LastGeolocationCacheEntry = {
      lat,
      lng,
      timestamp: Date.now(),
    }
    localStorage.setItem(LAST_GEOLOCATION_CACHE_KEY, JSON.stringify(entry))
  } catch {
    // 書き込み失敗は無視
  }
}
