import { useState, useCallback, useRef, useMemo } from 'react'
import { Input } from './ui/input'
import { GeocodingCore } from '@mapbox/search-js-core'
import type { GeocodingFeature } from '@mapbox/search-js-core'
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox'
import { X } from 'lucide-react'

/**
 * Issue#69: 場所検索ダイアログ
 *
 * Geocoding API v6（GeocodingCore）を使用し、市区町村を含む行政区分を検索可能にする。
 * フローティングUIとして実装し、モバイルでの画面拡大を回避する。
 */

interface PlaceSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPlaceSelect: (lng: number, lat: number, zoom: number) => void
}

const SEARCH_DEBOUNCE_MS = 300

/** feature_typeに応じたズームレベルを返す */
function getZoomForFeatureType(featureType?: string): number {
  switch (featureType) {
    case 'country':
      return 5
    case 'region':
      return 8
    case 'postcode':
    case 'district':
    case 'place':
      return 12
    case 'locality':
    case 'neighborhood':
    case 'street':
      return 14
    case 'address':
    default:
      return 16
  }
}

export function PlaceSearchDialog({
  open,
  onOpenChange,
  onPlaceSelect,
}: PlaceSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [features, setFeatures] = useState<GeocodingFeature[]>([])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const geocoding = useMemo(() => {
    if (MAPBOX_ACCESS_TOKEN) {
      return new GeocodingCore({ accessToken: MAPBOX_ACCESS_TOKEN })
    }
    return null
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!value.trim() || !geocoding) {
      setFeatures([])
      return
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await geocoding.forward(value, {
          country: 'jp',
          language: 'ja',
          types: 'region,postcode,district,place,locality,neighborhood,street,address',
        })
        setFeatures(result.features || [])
      } catch {
        setFeatures([])
      }
    }, SEARCH_DEBOUNCE_MS)
  }, [geocoding])

  const handleSelectFeature = useCallback((feature: GeocodingFeature) => {
    const [lng, lat] = feature.geometry.coordinates
    const zoom = getZoomForFeatureType(feature.properties.feature_type)
    onPlaceSelect(lng, lat, zoom)

    setFeatures([])
    setSearchQuery('')
    onOpenChange(false)
  }, [onPlaceSelect, onOpenChange])

  const handleClose = useCallback(() => {
    setSearchQuery('')
    setFeatures([])
    onOpenChange(false)
  }, [onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* 半透明オーバーレイ: クリックで閉じる */}
      <div
        data-testid="search-overlay"
        className="absolute inset-0 pointer-events-auto bg-black/50"
        onClick={handleClose}
      />

      {/* 検索コンテナ: 上部中央にフローティング配置 */}
      <div className="absolute top-[4.5rem] left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-md pointer-events-auto flex flex-col items-end gap-1">
        {/* 閉じるボタン */}
        <button
          className="bg-white rounded-full p-1.5 shadow-lg hover:bg-gray-100"
          onClick={handleClose}
          aria-label="閉じる"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 検索ボックス */}
        <Input
          type="text"
          placeholder="場所を検索"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full shadow-lg bg-white"
        />

        {/* 検索候補リスト */}
        {features.length > 0 && (
          <div className="w-full max-h-64 overflow-y-auto bg-white border rounded-md shadow-lg">
            {features.map((feature) => (
              <button
                key={feature.properties.mapbox_id}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
                onClick={() => handleSelectFeature(feature)}
              >
                <div className="font-medium text-sm">{feature.properties.name}</div>
                {feature.properties.place_formatted && (
                  <div className="text-xs text-gray-500">{feature.properties.place_formatted}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
