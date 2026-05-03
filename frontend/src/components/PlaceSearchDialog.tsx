import { useState, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from './ui/input'
import { SearchBoxCore, GeocodingCore, SessionToken } from '@mapbox/search-js-core'
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox'
import { MAPBOX_LANGUAGE_MAP, type SupportedLanguage } from '../i18n'

/**
 * Issue#69: 場所検索ダイアログ
 *
 * SearchBoxCore（POI・住所）とGeocodingCore（行政区分）を併用し、
 * 都道府県・市区町村から駅・店舗まで網羅的に検索可能にする。
 */

/** 統一された検索結果の型 */
interface SearchResult {
  name: string
  description?: string
  mapbox_id: string
  feature_type?: string
  source: 'searchbox' | 'geocoding'
  coordinates?: [number, number]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalSuggestion?: any
}

interface PlaceSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPlaceSelect: (lng: number, lat: number, zoom: number) => void
}

const SEARCH_DEBOUNCE_MS = 300
const SEARCHBOX_TYPES = 'country,region,postcode,district,place,locality,neighborhood,street,address,poi'
const GEOCODING_TYPES = 'country,region,postcode,district,place,locality,neighborhood'

/** モバイルiOSのズーム防止と確実な白色背景のためのインラインスタイル */
const INPUT_STYLE = { backgroundColor: '#ffffff', fontSize: '16px' } as const

/** feature_typeに応じたズームレベルを返す */
const ZOOM_BY_FEATURE_TYPE: Record<string, number> = {
  country: 5,
  region: 8,
  postcode: 12,
  district: 12,
  place: 12,
  locality: 14,
  neighborhood: 14,
  street: 14,
  poi: 16,
}
const DEFAULT_ZOOM = 16

function getZoomForFeatureType(featureType?: string): number {
  if (!featureType) return DEFAULT_ZOOM
  return ZOOM_BY_FEATURE_TYPE[featureType] ?? DEFAULT_ZOOM
}

/** GeocodingCoreとSearchBoxCoreの結果を統一フォーマットにマージする */
function mergeSearchResults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geocodingFeatures: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchBoxSuggestions: any[],
): SearchResult[] {
  const merged: SearchResult[] = []
  const seenIds = new Set<string>()

  for (const feature of geocodingFeatures) {
    const id = feature.properties.mapbox_id
    if (!seenIds.has(id)) {
      seenIds.add(id)
      merged.push({
        name: feature.properties.name,
        description: feature.properties.place_formatted,
        mapbox_id: id,
        feature_type: feature.properties.feature_type,
        source: 'geocoding',
        coordinates: feature.geometry.coordinates as [number, number],
      })
    }
  }

  for (const suggestion of searchBoxSuggestions) {
    const id = suggestion.mapbox_id
    if (!seenIds.has(id)) {
      seenIds.add(id)
      merged.push({
        name: suggestion.name,
        description: suggestion.full_address,
        mapbox_id: id,
        feature_type: suggestion.feature_type,
        source: 'searchbox',
        originalSuggestion: suggestion,
      })
    }
  }

  return merged
}

export function PlaceSearchDialog({
  open,
  onOpenChange,
  onPlaceSelect,
}: Readonly<PlaceSearchDialogProps>) {
  const { i18n } = useTranslation()
  const mapboxLang = MAPBOX_LANGUAGE_MAP[i18n.language as SupportedLanguage] || 'en'
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionTokenRef = useRef(new SessionToken())

  const searchBox = useMemo(() => {
    if (MAPBOX_ACCESS_TOKEN) {
      return new SearchBoxCore({ accessToken: MAPBOX_ACCESS_TOKEN })
    }
    return null
  }, [])

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

    if (!value.trim() || !searchBox || !geocoding) {
      setResults([])
      return
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const [searchBoxResult, geocodingResult] = await Promise.allSettled([
          searchBox.suggest(value, {
            sessionToken: sessionTokenRef.current,
            language: mapboxLang,
            types: SEARCHBOX_TYPES,
          }),
          geocoding.forward(value, {
            language: mapboxLang,
            types: GEOCODING_TYPES,
          }),
        ])

        const geocodingFeatures = geocodingResult.status === 'fulfilled'
          ? geocodingResult.value.features || [] : []
        const searchBoxSuggestions = searchBoxResult.status === 'fulfilled'
          ? (searchBoxResult.value.suggestions || []) : []

        setResults(mergeSearchResults(geocodingFeatures, searchBoxSuggestions))
      } catch {
        setResults([])
      }
    }, SEARCH_DEBOUNCE_MS)
  }, [searchBox, geocoding, mapboxLang])

  const handleSelectResult = useCallback(async (result: SearchResult) => {
    if (result.source === 'geocoding' && result.coordinates) {
      const [lng, lat] = result.coordinates
      const zoom = getZoomForFeatureType(result.feature_type)
      onPlaceSelect(lng, lat, zoom)
    } else if (result.source === 'searchbox' && searchBox && result.originalSuggestion) {
      try {
        const retrieved = await searchBox.retrieve(result.originalSuggestion, {
          sessionToken: sessionTokenRef.current,
        })
        const feature = retrieved.features?.[0]
        if (feature?.geometry?.coordinates) {
          const [lng, lat] = feature.geometry.coordinates
          const featureType = feature.properties?.feature_type || result.feature_type
          const zoom = getZoomForFeatureType(featureType)
          onPlaceSelect(lng, lat, zoom)
        }
      } catch {
        // 取得失敗時はスキップ
      }
    }

    sessionTokenRef.current = new SessionToken()
    setResults([])
    setSearchQuery('')
    onOpenChange(false)
  }, [searchBox, onPlaceSelect, onOpenChange])

  const handleClose = useCallback(() => {
    setSearchQuery('')
    setResults([])
    onOpenChange(false)
  }, [onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* 半透明オーバーレイ: クリックで閉じる */}
      <div
        data-testid="search-overlay"
        role="button"
        tabIndex={0}
        className="absolute inset-0 pointer-events-auto bg-black/50"
        onClick={handleClose}
        onKeyDown={(e) => { if (e.key === 'Enter') handleClose() }}
      />

      {/* 検索コンテナ: 上部中央にフローティング配置 */}
      <div className="absolute top-[calc(91px+env(safe-area-inset-top,0px))] left-[30px] right-[30px] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[28rem] md:max-w-md max-w-[448px] mx-auto pointer-events-auto flex flex-col gap-1">
        {/* 検索ボックス */}
        <Input
          type="text"
          placeholder="場所を検索"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full h-11 shadow-lg"
          style={INPUT_STYLE}
        />

        {/* 検索候補リスト */}
        {results.length > 0 && (
          <div className="w-full max-h-64 overflow-y-auto bg-white border rounded-md shadow-lg">
            {results.map((result) => (
              <button
                key={result.mapbox_id}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
                onClick={() => handleSelectResult(result)}
              >
                <div className="font-medium text-sm">{result.name}</div>
                {result.description && (
                  <div className="text-xs text-gray-500">{result.description}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
