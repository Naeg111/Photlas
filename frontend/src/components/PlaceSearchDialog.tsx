import { useState, useCallback, useRef, useMemo } from 'react'
import { Input } from './ui/input'
import { SearchBoxCore, SessionToken } from '@mapbox/search-js-core'
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox'
import { X } from 'lucide-react'

/**
 * Issue#69: 場所検索ダイアログ
 *
 * Radix Dialogを使わず、フローティングUIとして実装。
 * モバイルでの画面拡大問題を回避し、地図上に検索ボックスを浮かせて表示する。
 */

interface SearchSuggestion {
  name: string
  full_address?: string
  mapbox_id: string
  feature_type?: string
}

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
    case 'poi':
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
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionTokenRef = useRef(new SessionToken())

  const searchBox = useMemo(() => {
    if (MAPBOX_ACCESS_TOKEN) {
      return new SearchBoxCore({ accessToken: MAPBOX_ACCESS_TOKEN })
    }
    return null
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!value.trim() || !searchBox) {
      setSuggestions([])
      return
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await searchBox.suggest(value, {
          sessionToken: sessionTokenRef.current,
          country: 'jp',
          language: 'ja',
          types: 'region,postcode,district,place,locality,neighborhood,street,address,poi',
        })
        setSuggestions((result.suggestions || []) as SearchSuggestion[])
      } catch {
        setSuggestions([])
      }
    }, SEARCH_DEBOUNCE_MS)
  }, [searchBox])

  const handleSelectSuggestion = useCallback(async (suggestion: SearchSuggestion) => {
    if (!searchBox) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await searchBox.retrieve(suggestion as any, {
        sessionToken: sessionTokenRef.current,
      })
      const feature = result.features?.[0]
      if (feature?.geometry?.coordinates) {
        const [lng, lat] = feature.geometry.coordinates
        const featureType = feature.properties?.feature_type || suggestion.feature_type
        const zoom = getZoomForFeatureType(featureType)
        onPlaceSelect(lng, lat, zoom)
      }
    } catch {
      // 取得失敗時はスキップ
    }

    sessionTokenRef.current = new SessionToken()
    setSuggestions([])
    setSearchQuery('')
    onOpenChange(false)
  }, [searchBox, onPlaceSelect, onOpenChange])

  const handleClose = useCallback(() => {
    setSearchQuery('')
    setSuggestions([])
    onOpenChange(false)
  }, [onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* 透明な背景: クリックで閉じる */}
      <div
        className="absolute inset-0 pointer-events-auto"
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
          autoFocus
          className="w-full shadow-lg bg-white"
        />

        {/* 検索候補リスト */}
        {suggestions.length > 0 && (
          <div className="w-full max-h-64 overflow-y-auto bg-white border rounded-md shadow-lg">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.mapbox_id}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
                onClick={() => handleSelectSuggestion(suggestion)}
              >
                <div className="font-medium text-sm">{suggestion.name}</div>
                {suggestion.full_address && (
                  <div className="text-xs text-gray-500">{suggestion.full_address}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
