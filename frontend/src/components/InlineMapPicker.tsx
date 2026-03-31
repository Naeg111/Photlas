import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Map, { Marker } from 'react-map-gl'
import type { MapEvent, ViewStateChangeEvent } from 'react-map-gl'
import type { Map as MapboxMap } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { SearchBoxCore, SessionToken } from '@mapbox/search-js-core'
import { MapPin, LocateFixed, Search } from 'lucide-react'
import { Button } from './ui/button'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'

/**
 * InlineMapPicker コンポーネント
 * Issue#9: 写真投稿時の位置選択用インライン地図ピッカー
 * Issue#53: Google Maps API → Mapbox API 移行（センタリングのみ方式）
 *
 * 地図をドラッグして中央のピンで位置を選択する
 * 検索候補はMapbox Search Box APIで取得し、コンポーネント内に描画する
 *
 * センタリングのみ方式:
 * - 検索候補選択時は地図のセンタリングのみ（flyTo）
 * - 最終座標は常に地図中心点（ユーザー確定位置）から取得
 *
 * オーバーレイはMapの兄弟要素として配置する（translateZ不使用）
 * react-map-gl v8のMap子要素コンテナはposition:static/z-index未指定のため
 * 内部のabsolute要素がWebGLキャンバスの背面に描画される。
 * translateZ(0)はGPUコンポジティングレイヤーを生成しMapboxコントロールを遮蔽するため不使用
 */

interface MarkerConfig {
  lat: number
  lng: number
  color: string
}

interface InlineMapPickerProps {
  position: { lat: number; lng: number } | null
  onPositionChange: (position: { lat: number; lng: number }) => void
  /** 固定中央ピンの色（デフォルト: '#ef4444' 赤） */
  pinColor?: string
  /** 地図上に表示する追加マーカー */
  markers?: MarkerConfig[]
  /** 現在地ボタン表示の有無（デフォルト: true） */
  showLocationButton?: boolean
}

// Mapbox Search Box APIの検索結果型
interface SearchSuggestion {
  name: string
  full_address?: string
  mapbox_id: string
}

// 地図の初期設定
export const DEFAULT_CENTER = { lat: 35.6812, lng: 139.7671 } // 東京駅
const DEFAULT_ZOOM = 15
const SEARCH_DEBOUNCE_MS = 300

/**
 * オーバーレイのスタイル定数
 * Mapの兄弟要素としてposition: absoluteで地図全体を覆う
 * pointer-events: noneでMapboxコントロールへのクリックを透過させる
 * translateZ(0)はGPUレイヤー生成によりMapboxコントロールを遮蔽するため不使用
 */
const overlayStyles = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 10,
  } as React.CSSProperties,
  searchArea: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    pointerEvents: 'auto',
  } as React.CSSProperties,
  pin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    WebkitTransform: 'translate(-50%, -100%)',
    transform: 'translate(-50%, -100%)',
    pointerEvents: 'none',
  } as React.CSSProperties,
  locationButton: {
    position: 'absolute',
    bottom: 40,
    right: 8,
    pointerEvents: 'auto',
  } as React.CSSProperties,
}

const DEFAULT_PIN_COLOR = '#ef4444'

export function InlineMapPicker({ position, onPositionChange, pinColor = DEFAULT_PIN_COLOR, markers, showLocationButton = true }: Readonly<InlineMapPickerProps>) {
  const mapRef = useRef<MapboxMap | null>(null)
  const onPositionChangeRef = useRef(onPositionChange)
  onPositionChangeRef.current = onPositionChange

  // 検索関連のstate
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // SearchBoxCore を初期化（useMemoで即座に生成）
  const searchBox = useMemo(() => {
    if (MAPBOX_ACCESS_TOKEN) {
      return new SearchBoxCore({ accessToken: MAPBOX_ACCESS_TOKEN })
    }
    return null
  }, [])

  // セッショントークン（検索セッション管理用）
  const sessionTokenRef = useRef(new SessionToken())

  // 検索入力ハンドラー（デバウンス付き）
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!value.trim() || !searchBox) {
      setSuggestions([])
      setIsDropdownOpen(false)
      return
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await searchBox.suggest(value, {
          sessionToken: sessionTokenRef.current,
          language: 'ja',
        })
        const items = result.suggestions || []
        setSuggestions(items)
        setIsDropdownOpen(items.length > 0)
      } catch {
        setSuggestions([])
        setIsDropdownOpen(false)
      }
    }, SEARCH_DEBOUNCE_MS)
  }, [])

  // 候補選択ハンドラー（センタリングのみ方式）
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
        // センタリングのみ: flyToで地図を移動するが、onPositionChangeは呼ばない
        // 最終座標はonMoveEnd経由で地図中心点から取得される
        mapRef.current?.flyTo({ center: [lng, lat], zoom: DEFAULT_ZOOM })
      }
    } catch {
      // 検索結果の取得に失敗した場合はスキップ
    }

    // retrieve完了後にセッショントークンを更新
    sessionTokenRef.current = new SessionToken()
    setSearchQuery(suggestion.name)
    setSuggestions([])
    setIsDropdownOpen(false)
  }, [])

  const handleLoad = useCallback((e: MapEvent) => {
    const mapInstance = e.target
    mapRef.current = mapInstance
  }, [])

  // 地図移動完了時に中心座標をonPositionChangeに伝播
  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    const mapInstance = e.target
    const center = mapInstance.getCenter()
    if (center) {
      onPositionChangeRef.current({
        lat: center.lat,
        lng: center.lng,
      })
    }
  }, [])

  const handleCurrentLocation = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCenter = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        mapRef.current?.flyTo({ center: [newCenter.lng, newCenter.lat] })
      },
      () => {
        // 位置情報取得失敗時は現在位置への移動をスキップ
      },
      { enableHighAccuracy: true }
    )
  }, [])

  // ドロップダウン外クリック/タップで閉じる
  useEffect(() => {
    if (!isDropdownOpen) return
    const handleClick = () => setIsDropdownOpen(false)
    document.addEventListener('click', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [isDropdownOpen])

  const center = position || DEFAULT_CENTER

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Map
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom: DEFAULT_ZOOM,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAPBOX_STYLE}
        language="ja"
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
      >
        {markers?.map((marker, index) => (
          <Marker key={index} latitude={marker.lat} longitude={marker.lng}>
            <div data-testid={`additional-marker-${index}`}>
              <MapPin style={{ width: 32, height: 32, color: marker.color, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
            </div>
          </Marker>
        ))}
      </Map>

      {/* オーバーレイ: Mapの兄弟要素として配置（translateZ不使用でMapboxコントロールを遮蔽しない） */}
      <div style={overlayStyles.container}>
        {/* 検索バー + 候補リスト */}
        <div style={overlayStyles.searchArea}>
          <div style={{ position: 'relative' }}>
            <Search
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#9ca3af', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="場所を検索"
              style={{
                width: '100%',
                paddingLeft: 36,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                fontSize: 14,
                borderRadius: 8,
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                outline: 'none',
                WebkitAppearance: 'none',
              }}
            />
            {/* 検索候補ドロップダウン */}
            {isDropdownOpen && suggestions.length > 0 && (
              <ul style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                maxHeight: 192,
                overflowY: 'auto',
                listStyle: 'none',
                padding: 0,
                margin: 0,
              }}>
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.mapbox_id}
                    onMouseDown={(e) => e.preventDefault()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    style={{
                      padding: '8px 12px',
                      fontSize: 14,
                      cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{suggestion.name}</div>
                    {suggestion.full_address && (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{suggestion.full_address}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 中央固定ピン */}
        <div style={overlayStyles.pin} data-testid="center-pin">
          <MapPin style={{ width: 40, height: 40, color: pinColor, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
        </div>

        {/* 現在地ボタン */}
        {showLocationButton && (
          <div style={overlayStyles.locationButton}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="bg-white shadow-lg"
              onClick={handleCurrentLocation}
              aria-label="現在地へ移動"
            >
              <LocateFixed className="w-5 h-5" />
            </Button>
          </div>
        )}

      </div>
    </div>
  )
}
