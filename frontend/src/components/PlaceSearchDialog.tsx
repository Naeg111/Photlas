import { useState, useCallback, useRef, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { SearchBoxCore, SessionToken } from '@mapbox/search-js-core'
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox'

/**
 * Issue#69: 場所検索ダイアログ
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
    case 'city':
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

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setSearchQuery('')
      setSuggestions([])
    }
    onOpenChange(isOpen)
  }, [onOpenChange])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">場所検索</DialogTitle>
        <DialogDescription className="sr-only">場所を検索してマップを移動</DialogDescription>

        <div className="space-y-2">
          <Input
            type="text"
            placeholder="場所を検索"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            autoFocus
          />

          {suggestions.length > 0 && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
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
      </DialogContent>
    </Dialog>
  )
}
