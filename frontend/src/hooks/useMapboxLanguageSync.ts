import { useEffect } from 'react'
import type { Map as MapboxMap } from 'mapbox-gl'

/**
 * Issue#107: Mapbox の地名ラベルを表示言語に追従させるカスタムフック。
 *
 * react-map-gl の `language` prop は初回レンダリング時にしか反映されないため、
 * 言語切替時に map インスタンスへ `setLanguage()` を明示的に呼ぶ必要がある。
 * MapView と InlineMapPicker の両方で同じ処理を行うため、共通フックとして切り出した。
 *
 * @param map ロード済みの Mapbox マップインスタンス（未ロード時は null を渡す）
 * @param mapboxLang Mapbox の言語コード（例: 'ja', 'en', 'zh-Hans'）
 */
export function useMapboxLanguageSync(map: MapboxMap | null, mapboxLang: string) {
  useEffect(() => {
    if (!map) return
    map.setLanguage(mapboxLang)
  }, [map, mapboxLang])
}
