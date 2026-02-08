import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { GoogleMap, useLoadScript } from '@react-google-maps/api'
import { MapPin, LocateFixed, Search } from 'lucide-react'
import { Button } from './ui/button'

/**
 * InlineMapPicker コンポーネント
 * Issue#9: 写真投稿時の位置選択用インライン地図ピッカー
 *
 * 地図をドラッグして中央のピンで位置を選択する
 * 検索候補はAutocompleteServiceで取得し、コンポーネント内に描画する
 * （Radix UIモーダルの pointer-events:none 制約を回避するため）
 *
 * オーバーレイはcreatePortalでGoogleMapコンテナ内部に描画し、
 * iOS Safariのスタッキングコンテキスト問題を回避する
 */

interface InlineMapPickerProps {
  position: { lat: number; lng: number } | null
  onPositionChange: (position: { lat: number; lng: number }) => void
}

// 地図の初期設定
const DEFAULT_CENTER = { lat: 35.6762, lng: 139.6503 } // 新宿
const DEFAULT_ZOOM = 15

// Google Maps APIキー
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// Places ライブラリ（useLoadScriptのlibrariesは定数参照が必要）
const LIBRARIES: ('places')[] = ['places']

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
}

/**
 * オーバーレイのスタイル定数
 * iOS Safariでの表示を保証するためインラインスタイルを使用
 */
const overlayStyles = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 1,
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
    transform: 'translate(-50%, -100%)',
    pointerEvents: 'none',
  } as React.CSSProperties,
  locationButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    pointerEvents: 'auto',
  } as React.CSSProperties,
  coordinates: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    background: 'rgba(255,255,255,0.9)',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  } as React.CSSProperties,
}

export function InlineMapPicker({ position, onPositionChange }: InlineMapPickerProps) {
  const mapRef = useRef<google.maps.Map | null>(null)
  const [mapContainerEl, setMapContainerEl] = useState<HTMLElement | null>(null)
  const onPositionChangeRef = useRef(onPositionChange)
  onPositionChangeRef.current = onPositionChange

  // 検索関連のstate
  const [searchQuery, setSearchQuery] = useState('')
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  })

  // AutocompleteService と Geocoder を初期化
  useEffect(() => {
    if (!isLoaded) return
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService()
    geocoderRef.current = new google.maps.Geocoder()
  }, [isLoaded])

  // 検索入力ハンドラー（デバウンス付き）
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!value.trim() || !autocompleteServiceRef.current) {
      setPredictions([])
      setIsDropdownOpen(false)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      autocompleteServiceRef.current?.getPlacePredictions(
        { input: value, componentRestrictions: { country: 'jp' } },
        (results) => {
          setPredictions(results || [])
          setIsDropdownOpen((results?.length ?? 0) > 0)
        }
      )
    }, 300)
  }, [])

  // 候補選択ハンドラー
  const handleSelectPrediction = useCallback((prediction: google.maps.places.AutocompletePrediction) => {
    if (!geocoderRef.current) return

    geocoderRef.current.geocode({ placeId: prediction.place_id }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const lat = results[0].geometry.location.lat()
        const lng = results[0].geometry.location.lng()
        mapRef.current?.panTo({ lat, lng })
        onPositionChangeRef.current({ lat, lng })
      }
    })

    setSearchQuery(prediction.structured_formatting.main_text)
    setPredictions([])
    setIsDropdownOpen(false)
  }, [])

  const handleLoad = useCallback((mapInstance: google.maps.Map) => {
    mapRef.current = mapInstance
    setMapContainerEl(mapInstance.getDiv())

    // 地図のドラッグ終了時に中心座標を取得
    mapInstance.addListener('idle', () => {
      const center = mapInstance.getCenter()
      if (center) {
        onPositionChangeRef.current({
          lat: center.lat(),
          lng: center.lng(),
        })
      }
    })
  }, [])

  const handleCurrentLocation = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCenter = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        mapRef.current?.panTo(newCenter)
        onPositionChangeRef.current(newCenter)
      },
      (error) => {
        console.error('位置情報の取得に失敗しました:', error)
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

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 text-gray-500">
        地図の読み込みに失敗しました
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 text-gray-500">
        地図を読み込み中...
      </div>
    )
  }

  const center = position || DEFAULT_CENTER

  // オーバーレイ要素（createPortalでGoogleMapコンテナ内に描画）
  const overlayContent = (
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
          {isDropdownOpen && predictions.length > 0 && (
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
              {predictions.map((prediction) => (
                <li
                  key={prediction.place_id}
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={() => handleSelectPrediction(prediction)}
                  style={{
                    padding: '8px 12px',
                    fontSize: 14,
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{prediction.structured_formatting.main_text}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{prediction.structured_formatting.secondary_text}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 中央固定ピン */}
      <div style={overlayStyles.pin}>
        <MapPin style={{ width: 40, height: 40, color: '#ef4444', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
      </div>

      {/* 現在地ボタン */}
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

      {/* 座標表示 */}
      {position && (
        <div style={overlayStyles.coordinates}>
          緯度: {position.lat.toFixed(4)}, 経度: {position.lng.toFixed(4)}
        </div>
      )}
    </div>
  )

  return (
    <div className="relative h-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={DEFAULT_ZOOM}
        options={mapOptions}
        onLoad={handleLoad}
      />

      {/* GoogleMapコンテナ内部にオーバーレイをPortalで描画 */}
      {mapContainerEl && createPortal(overlayContent, mapContainerEl)}
    </div>
  )
}
