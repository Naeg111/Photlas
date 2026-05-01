/**
 * Issue#106: IP国判定APIの呼び出し関数
 *
 * GET /api/v1/geo/my-country を呼び出し、リクエスト元のIPアドレスから判定された
 * 国コード（ISO 3166-1 alpha-2）を返す。
 *
 * - ネットワークエラー、HTTPエラー、JSONパースエラー時は null を返す（例外を投げない）。
 * - 認証は不要。
 */

import { API_V1_URL } from '../config/api'

interface GeoCountryApiResponse {
  countryCode: string | null
}

export async function fetchMyCountry(): Promise<string | null> {
  try {
    const response = await fetch(`${API_V1_URL}/geo/my-country`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null

    const data = (await response.json()) as GeoCountryApiResponse
    return data.countryCode ?? null
  } catch {
    // ネットワークエラー、JSONパースエラー等
    return null
  }
}
