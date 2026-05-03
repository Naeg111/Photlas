import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Map, { Marker } from 'react-map-gl'
import type { MapEvent, ViewStateChangeEvent } from 'react-map-gl'
import type { Map as MapboxMap } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { SearchBoxCore, GeocodingCore, SessionToken } from '@mapbox/search-js-core'
import { MapPin, LocateFixed, Search } from 'lucide-react'
import { Button } from './ui/button'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'
import { sortSuggestionsByRelevance } from '../utils/sortSuggestions'
import { useMapboxLanguageSync } from '../hooks/useMapboxLanguageSync'
import { MAPBOX_LANGUAGE_MAP, type SupportedLanguage } from '../i18n'
import { getGeoCountryCache } from '../utils/geoCountryCache'
import { getCountryCoordinates } from '../utils/countryCoordinates'
import { getLastGeolocationCache } from '../utils/lastGeolocationCache'

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
 * オーバーレイはMapの兄弟要素として配置し、translateZ(0)で
 * GPU合成レイヤーを生成してWebGLキャンバスの上に描画する。
 * Mapboxロゴ・帰属表示はオーバーレイ内にカスタム実装し、
 * ネイティブ側はattributionControl=false/CSS非表示で無効化
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

// 統一された検索結果型（SearchBox + Geocoding）
interface SearchSuggestion {
  name: string
  full_address?: string
  mapbox_id: string
  source: 'searchbox' | 'geocoding'
  coordinates?: [number, number]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalSuggestion?: any
}

// 地図の初期設定
export const DEFAULT_CENTER = { lat: 35.6812, lng: 139.7671 } // 東京駅
const DEFAULT_ZOOM = 15
// Issue#106: ブラウザ位置情報取得時のズームレベル
const GEOLOCATION_ZOOM = 15
const SEARCH_DEBOUNCE_MS = 300
const LONG_DISTANCE_THRESHOLD = 4.5
const TRANSITION_FADE_MS = 500
const GEOCODING_TYPES = 'country,region,postcode,district,place,locality,neighborhood'

/** オーバーレイのスタイル定数 */
const overlayStyles = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 10,
    WebkitTransform: 'translateZ(0)',
    transform: 'translateZ(0)',
  } as React.CSSProperties,
  searchArea: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    pointerEvents: 'auto',
    zIndex: 2,
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
  logo: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    pointerEvents: 'auto',
  } as React.CSSProperties,
  attribution: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  } as React.CSSProperties,
}

const DEFAULT_PIN_COLOR = '#ef4444'

export function InlineMapPicker({ position, onPositionChange, pinColor = DEFAULT_PIN_COLOR, markers, showLocationButton = true }: Readonly<InlineMapPickerProps>) {
  const { i18n } = useTranslation()
  const mapboxLang = MAPBOX_LANGUAGE_MAP[i18n.language as SupportedLanguage] || 'en'
  const mapRef = useRef<MapboxMap | null>(null)
  // Issue#107: 言語切替時に setLanguage を呼ぶ useEffect の依存対象として、
  // ref とは別にロード済みの map インスタンスを state でも保持する。
  const [mapForLanguage, setMapForLanguage] = useState<MapboxMap | null>(null)
  const onPositionChangeRef = useRef(onPositionChange)
  onPositionChangeRef.current = onPositionChange
  // moveMapTo呼び出し時のターゲット座標（onMoveEndで正確な座標を返すため）
  const moveTargetRef = useRef<{ lat: number; lng: number } | null>(null)
  // 初回moveEndスキップフラグ（初回レンダリングのmoveEndでgetCenter()のMercator誤差を拾わない）
  const isFirstMoveEndRef = useRef(true)

  // 外部からのposition変更を検知してマップを移動する
  const lastExternalPositionRef = useRef<{ lat: number; lng: number } | null>(null)

  // 帰属情報の表示状態
  const [isAttributionOpen, setIsAttributionOpen] = useState(false)

  // ワープアニメーション
  const [mapTransitioning, setMapTransitioning] = useState(false)
  const [mapTransitionFading, setMapTransitionFading] = useState(false)

  // 検索関連のstate
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchAreaRef = useRef<HTMLDivElement>(null)

  // SearchBoxCore + GeocodingCore を初期化
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

  // セッショントークン（検索セッション管理用）
  const sessionTokenRef = useRef(new SessionToken())

  // 検索入力ハンドラー（デバウンス付き）
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!value.trim() || !searchBox || !geocoding) {
      setSuggestions([])
      setIsDropdownOpen(false)
      return
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const [searchBoxResult, geocodingResult] = await Promise.allSettled([
          searchBox.suggest(value, {
            sessionToken: sessionTokenRef.current,
            language: mapboxLang,
          }),
          geocoding.forward(value, {
            language: mapboxLang,
            types: GEOCODING_TYPES,
          }),
        ])

        const merged: SearchSuggestion[] = []
        const seenIds = new Set<string>()

        // Geocoding結果（行政区分）を先に追加
        if (geocodingResult.status === 'fulfilled') {
          for (const feature of geocodingResult.value.features || []) {
            const id = feature.properties.mapbox_id
            if (!seenIds.has(id)) {
              seenIds.add(id)
              merged.push({
                name: feature.properties.name,
                full_address: feature.properties.place_formatted,
                mapbox_id: id,
                source: 'geocoding',
                coordinates: feature.geometry.coordinates as [number, number],
              })
            }
          }
        }

        // SearchBox結果（POI・住所）を追加
        if (searchBoxResult.status === 'fulfilled') {
          for (const suggestion of searchBoxResult.value.suggestions || []) {
            const id = suggestion.mapbox_id
            if (!seenIds.has(id)) {
              seenIds.add(id)
              merged.push({
                name: suggestion.name,
                full_address: suggestion.full_address,
                mapbox_id: id,
                source: 'searchbox',
                originalSuggestion: suggestion,
              })
            }
          }
        }

        const items = sortSuggestionsByRelevance(merged, value)
        setSuggestions(items)
        setIsDropdownOpen(items.length > 0)
      } catch {
        setSuggestions([])
        setIsDropdownOpen(false)
      }
    }, SEARCH_DEBOUNCE_MS)
  }, [searchBox, geocoding, mapboxLang])

  // 長距離移動時にワープアニメーション、短距離はflyTo
  const moveMapTo = useCallback((lng: number, lat: number, zoom: number = DEFAULT_ZOOM) => {
    if (!mapRef.current) return
    // ターゲット座標を保存（onMoveEndでgetCenter()の代わりに使用し、Mercator変換誤差を回避）
    moveTargetRef.current = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
    const currentCenter = mapRef.current.getCenter()
    const distance = Math.sqrt(
      Math.pow(lng - currentCenter.lng, 2) + Math.pow(lat - currentCenter.lat, 2)
    )
    if (distance > LONG_DISTANCE_THRESHOLD) {
      setMapTransitioning(true)
      let completed = false
      const completeTransition = () => {
        if (completed) return
        completed = true
        setMapTransitionFading(true)
        setTimeout(() => {
          setMapTransitioning(false)
          setMapTransitionFading(false)
        }, TRANSITION_FADE_MS)
      }
      requestAnimationFrame(() => {
        mapRef.current?.jumpTo({ center: [lng, lat], zoom })
        mapRef.current?.once('idle', completeTransition)
        setTimeout(completeTransition, 500)
      })
    } else {
      mapRef.current.flyTo({ center: [lng, lat], zoom })
    }
  }, [])

  // 外部からのposition変更を検知してマップを移動（EXIF GPS座標等）
  useEffect(() => {
    if (!position || !mapRef.current) return
    if (lastExternalPositionRef.current &&
        lastExternalPositionRef.current.lat === position.lat &&
        lastExternalPositionRef.current.lng === position.lng) return
    const current = mapRef.current.getCenter()
    const dist = Math.abs(current.lat - position.lat) + Math.abs(current.lng - position.lng)
    if (dist > 0.001) {
      moveMapTo(position.lng, position.lat)
    }
    lastExternalPositionRef.current = position
  }, [position, moveMapTo])

  // 候補選択ハンドラー（センタリングのみ方式）
  const handleSelectSuggestion = useCallback(async (suggestion: SearchSuggestion) => {
    if (suggestion.source === 'geocoding' && suggestion.coordinates) {
      const [lng, lat] = suggestion.coordinates
      moveMapTo(lng, lat)
    } else if (suggestion.source === 'searchbox' && searchBox) {
      try {
        const result = await searchBox.retrieve(suggestion.originalSuggestion ?? suggestion, {
          sessionToken: sessionTokenRef.current,
        })
        const feature = result.features?.[0]
        if (feature?.geometry?.coordinates) {
          const [lng, lat] = feature.geometry.coordinates
          moveMapTo(lng, lat)
        }
      } catch {
        // 検索結果の取得に失敗した場合はスキップ
      }
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
    setMapForLanguage(mapInstance)
  }, [])

  // Issue#107: 表示言語に追従して地名ラベルを切り替える
  // （mapRef は依存配列に含められないため、handleLoad で同 map を state にも保持して渡す）
  useMapboxLanguageSync(mapForLanguage, mapboxLang)

  // 地図移動完了時に中心座標をonPositionChangeに伝播
  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    // 初回レンダリングのmoveEndはスキップ（initialViewStateのgetCenter()にMercator誤差が含まれるため）
    if (isFirstMoveEndRef.current) {
      isFirstMoveEndRef.current = false
      return
    }
    // moveMapToで移動した場合はターゲット座標を使用（getCenter()のMercator変換誤差を回避）
    if (moveTargetRef.current) {
      onPositionChangeRef.current(moveTargetRef.current)
      moveTargetRef.current = null
      return
    }
    // ユーザーのドラッグ移動の場合はgetCenter()から取得（6桁丸め）
    const mapInstance = e.target
    const center = mapInstance.getCenter()
    if (center) {
      onPositionChangeRef.current({
        lat: Math.round(center.lat * 1e6) / 1e6,
        lng: Math.round(center.lng * 1e6) / 1e6,
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
        moveMapTo(newCenter.lng, newCenter.lat)
      },
      () => {
        // 位置情報取得失敗時は現在位置への移動をスキップ
      },
      { enableHighAccuracy: true }
    )
  }, [])

  // ドロップダウン外クリック/タップで閉じる（検索エリア内のタップでは閉じない）
  useEffect(() => {
    if (!isDropdownOpen) return
    const handleOutside = (e: Event) => {
      if (searchAreaRef.current?.contains(e.target as Node)) return
      setIsDropdownOpen(false)
    }
    document.addEventListener('click', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('click', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [isDropdownOpen])

  // Issue#106 + Issue#111: position（EXIF座標）がない場合のフォールバック。
  // 優先順位:
  //   1. position（EXIF座標）
  //   2. lastGeolocationCache（ユーザーの最後の位置情報。MapView が autoCenter / 現在位置ボタンで保存）
  //   3. IP国判定キャッシュ
  //   4. 東京駅
  // ※ permissions.query は async だが、初期表示は sync な initialCenter を使う必要があるため
  //   同期的に取得できる「キャッシュ」と「東京駅」のみ initialCenter で使用する。
  //   ブラウザ位置情報（許可済み）は別 useEffect で取得し、取得できたら map.flyTo で移動する。
  const initialCenter = useMemo(() => {
    if (position) return { center: position, zoom: DEFAULT_ZOOM }
    // Issue#111: ユーザーの最後の位置情報キャッシュを優先利用
    const lastGeo = getLastGeolocationCache()
    if (lastGeo) {
      return { center: lastGeo, zoom: DEFAULT_ZOOM }
    }
    const cachedCountry = getGeoCountryCache()
    const countryCoords = getCountryCoordinates(cachedCountry)
    if (countryCoords) {
      return { center: { lat: countryCoords.lat, lng: countryCoords.lng }, zoom: countryCoords.zoom }
    }
    return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM }
  }, [position])

  // Issue#106: ブラウザ位置情報（許可済み）を取得して、得られたらマップを移動する
  useEffect(() => {
    if (position) return // EXIF 座標が指定済みなら何もしない

    let cancelled = false
    const tryGeolocation = async () => {
      try {
        if (!navigator.permissions || !navigator.permissions.query) return
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
        if (cancelled || status.state !== 'granted') return
        if (!('geolocation' in navigator)) return

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled || !mapRef.current) return
            mapRef.current.flyTo({
              center: [pos.coords.longitude, pos.coords.latitude],
              zoom: GEOLOCATION_ZOOM,
            })
          },
          () => {},
          { enableHighAccuracy: false, timeout: 10000 },
        )
      } catch {
        // navigator.permissions.query が未サポート（Safari 15 以前）等：何もしない
      }
    }
    tryGeolocation()

    return () => {
      cancelled = true
    }
  }, [position])

  return (
    <div data-testid="inline-map-picker" style={{ position: 'relative', height: '100%' }}>
      <Map
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{
          longitude: initialCenter.center.lng,
          latitude: initialCenter.center.lat,
          zoom: initialCenter.zoom,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAPBOX_STYLE}
        language={mapboxLang}
        attributionControl={false}
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

      {/* ワープアニメーション用暗転オーバーレイ */}
      {mapTransitioning && (
        <div style={{
          position: 'absolute', inset: 0, backgroundColor: 'black', zIndex: 20,
          opacity: mapTransitionFading ? 0 : 1,
          transition: mapTransitionFading ? `opacity ${TRANSITION_FADE_MS}ms ease-out` : 'none',
          pointerEvents: 'none',
        }} />
      )}

      {/* オーバーレイ: Mapの兄弟要素として配置（translateZ不使用でMapboxコントロールを遮蔽しない） */}
      <div style={overlayStyles.container}>
        {/* 検索バー + 候補リスト */}
        <div ref={searchAreaRef} style={overlayStyles.searchArea}>
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
              className="shadow-lg"
              style={{ backgroundColor: 'white' }}
              onClick={handleCurrentLocation}
              aria-label="現在地へ移動"
            >
              <LocateFixed className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Mapboxロゴ（左下） */}
        <div style={overlayStyles.logo}>
          <a
            href="https://www.mapbox.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Mapbox ホームページ"
          >
            <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" fillRule="evenodd" viewBox="0 0 88 23" width="88" height="23">
              <defs>
                <path id="mapbox-logo-icon" d="M11.5 2.25c5.105 0 9.25 4.145 9.25 9.25s-4.145 9.25-9.25 9.25-9.25-4.145-9.25-9.25 4.145-9.25 9.25-9.25zM6.997 15.983c-.051-.338-.828-5.802 2.233-8.873a4.395 4.395 0 013.13-1.28c1.27 0 2.49.51 3.39 1.42.91.9 1.42 2.12 1.42 3.39 0 1.18-.449 2.301-1.28 3.13C12.72 16.93 7 16 7 16l-.003-.017zM15.3 10.5l-2 .8-.8 2-.8-2-2-.8 2-.8.8-2 .8 2 2 .8z" />
                <path id="mapbox-logo-text" d="M50.63 8c.13 0 .23.1.23.23V9c.7-.76 1.7-1.18 2.73-1.18 2.17 0 3.95 1.85 3.95 4.17s-1.77 4.19-3.94 4.19c-1.04 0-2.03-.43-2.74-1.18v3.77c0 .13-.1.23-.23.23h-1.4c-.13 0-.23-.1-.23-.23V8.23c0-.12.1-.23.23-.23h1.4zm-3.86.01c.01 0 .01 0 .01-.01.13 0 .22.1.22.22v7.55c0 .12-.1.23-.23.23h-1.4c-.13 0-.23-.1-.23-.23V15c-.7.76-1.69 1.19-2.73 1.19-2.17 0-3.94-1.87-3.94-4.19 0-2.32 1.77-4.19 3.94-4.19 1.03 0 2.02.43 2.73 1.18v-.75c0-.12.1-.23.23-.23h1.4zm26.375-.19a4.24 4.24 0 00-4.16 3.29c-.13.59-.13 1.19 0 1.77a4.233 4.233 0 004.17 3.3c2.35 0 4.26-1.87 4.26-4.19 0-2.32-1.9-4.17-4.27-4.17zM60.63 5c.13 0 .23.1.23.23v3.76c.7-.76 1.7-1.18 2.73-1.18 1.88 0 3.45 1.4 3.84 3.28.13.59.13 1.2 0 1.8-.39 1.88-1.96 3.29-3.84 3.29-1.03 0-2.02-.43-2.73-1.18v.77c0 .12-.1.23-.23.23h-1.4c-.13 0-.23-.1-.23-.23V5.23c0-.12.1-.23.23-.23h1.4zm-34 11h-1.4c-.13 0-.23-.11-.23-.23V8.22c.01-.13.1-.22.23-.22h1.4c.13 0 .22.11.23.22v.68c.5-.68 1.3-1.09 2.16-1.1h.03c1.09 0 2.09.6 2.6 1.55.45-.95 1.4-1.55 2.44-1.56 1.62 0 2.93 1.25 2.9 2.78l.03 5.2c0 .13-.1.23-.23.23h-1.41c-.13 0-.23-.11-.23-.23v-4.59c0-.98-.74-1.71-1.62-1.71-.8 0-1.46.7-1.59 1.62l.01 4.68c0 .13-.11.23-.23.23h-1.41c-.13 0-.23-.11-.23-.23v-4.59c0-.98-.74-1.71-1.62-1.71-.85 0-1.54.79-1.6 1.8v4.5c0 .13-.1.23-.23.23zm53.615 0h-1.61c-.04 0-.08-.01-.12-.03-.09-.06-.13-.19-.06-.28l2.43-3.71-2.39-3.65a.213.213 0 01-.03-.12c0-.12.09-.21.21-.21h1.61c.13 0 .24.06.3.17l1.41 2.37 1.4-2.37a.34.34 0 01.3-.17h1.6c.04 0 .08.01.12.03.09.06.13.19.06.28l-2.37 3.65 2.43 3.7c0 .05.01.09.01.13 0 .12-.09.21-.21.21h-1.61c-.13 0-.24-.06-.3-.17l-1.44-2.42-1.44 2.42a.34.34 0 01-.3.17zm-7.12-1.49c-1.33 0-2.42-1.12-2.42-2.51 0-1.39 1.08-2.52 2.42-2.52 1.33 0 2.42 1.12 2.42 2.51 0 1.39-1.08 2.51-2.42 2.52zm-19.865 0c-1.32 0-2.39-1.11-2.42-2.48v-.07c.02-1.38 1.09-2.49 2.4-2.49 1.32 0 2.41 1.12 2.41 2.51 0 1.39-1.07 2.52-2.39 2.53zm-8.11-2.48c-.01 1.37-1.09 2.47-2.41 2.47s-2.42-1.12-2.42-2.51c0-1.39 1.08-2.52 2.4-2.52 1.33 0 2.39 1.11 2.41 2.48l.02.08zm18.12 2.47c-1.32 0-2.39-1.11-2.41-2.48v-.06c.02-1.38 1.09-2.48 2.41-2.48s2.42 1.12 2.42 2.51c0 1.39-1.09 2.51-2.42 2.51z" />
              </defs>
              <mask id="mapbox-logo-clip"><rect x="0" y="0" width="100%" height="100%" fill="white" /><use xlinkHref="#mapbox-logo-icon" /><use xlinkHref="#mapbox-logo-text" /></mask>
              <g opacity="0.3" stroke="#000" strokeWidth="3"><circle mask="url(#mapbox-logo-clip)" cx="11.5" cy="11.5" r="9.25" /><use xlinkHref="#mapbox-logo-text" mask="url(#mapbox-logo-clip)" /></g>
              <g opacity="0.9" fill="#fff"><use xlinkHref="#mapbox-logo-icon" /><use xlinkHref="#mapbox-logo-text" /></g>
            </svg>
          </a>
        </div>

        {/* 帰属情報（右下） */}
        <div style={overlayStyles.attribution}>
          {isAttributionOpen && (
            <div style={{
              background: 'rgba(255,255,255,0.9)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 10,
              whiteSpace: 'nowrap',
            }}>
              <a href="https://www.mapbox.com/about/maps" target="_blank" rel="noopener noreferrer" style={{ color: '#333', textDecoration: 'none' }}>© Mapbox</a>
              {' '}
              <a href="https://www.openstreetmap.org/copyright/" target="_blank" rel="noopener noreferrer" style={{ color: '#333', textDecoration: 'none' }}>© OpenStreetMap</a>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsAttributionOpen(prev => !prev)}
            aria-label="帰属情報"
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: 'none',
              background: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" fill="black" fillRule="evenodd">
              <path d="M4 10a6 6 0 1 0 12 0 6 6 0 1 0-12 0m5-3a1 1 0 1 0 2 0 1 1 0 1 0-2 0m0 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
