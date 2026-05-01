/**
 * Issue#106: IP国判定結果のキャッシュ
 *
 * localStorage に「ユーザーがいる国の国コード」を24時間保存し、
 * 同一ユーザーの再訪問時にAPI呼び出しを省略する。
 *
 * 旅行等で国が変わった場合は24時間で自動的にリフレッシュされる。
 */

export const GEO_COUNTRY_CACHE_KEY = 'photlas_geo_country'
export const GEO_COUNTRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24時間

interface GeoCountryCacheEntry {
  countryCode: string
  timestamp: number // Date.now() の値
}

/**
 * キャッシュから国コードを取得する。
 * - キャッシュがない、または期限切れ（24時間超過）の場合は null を返す。
 * - localStorage の中身が壊れている場合も null を返す（クラッシュしない）。
 */
export function getGeoCountryCache(): string | null {
  try {
    const raw = localStorage.getItem(GEO_COUNTRY_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as GeoCountryCacheEntry
    if (typeof parsed.countryCode !== 'string' || typeof parsed.timestamp !== 'number') {
      return null
    }

    const ageMs = Date.now() - parsed.timestamp
    if (ageMs >= GEO_COUNTRY_CACHE_TTL_MS) {
      return null
    }

    return parsed.countryCode
  } catch {
    // JSON パース失敗、localStorage アクセス不可（プライベートブラウジング等）
    return null
  }
}

/**
 * 国コードをキャッシュに保存する。
 * 書き込み失敗（QuotaExceededError 等）してもクラッシュしない。
 */
export function setGeoCountryCache(countryCode: string): void {
  try {
    const entry: GeoCountryCacheEntry = {
      countryCode,
      timestamp: Date.now(),
    }
    localStorage.setItem(GEO_COUNTRY_CACHE_KEY, JSON.stringify(entry))
  } catch {
    // 書き込み失敗は無視（次回のAPI呼び出しでリトライされるだけ）
  }
}
