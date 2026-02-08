import { useCallback, useRef, useEffect } from 'react'
import { GoogleMap, useLoadScript } from '@react-google-maps/api'
import { MapPin, LocateFixed, Search } from 'lucide-react'
import { Button } from './ui/button'

/**
 * InlineMapPicker コンポーネント
 * Issue#9: 写真投稿時の位置選択用インライン地図ピッカー
 *
 * 地図をドラッグして中央のピンで位置を選択する
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
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
}

export function InlineMapPicker({ position, onPositionChange }: InlineMapPickerProps) {
  const mapRef = useRef<google.maps.Map | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const onPositionChangeRef = useRef(onPositionChange)
  onPositionChangeRef.current = onPositionChange

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  })

  // Google Maps Autocomplete を直接作成
  useEffect(() => {
    if (!isLoaded || !searchInputRef.current) return

    const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
      componentRestrictions: { country: 'jp' },
      fields: ['geometry', 'name'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()
        mapRef.current?.panTo({ lat, lng })
        onPositionChangeRef.current({ lat, lng })
      }
    })

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete)
    }
  }, [isLoaded])

  const handleLoad = useCallback((mapInstance: google.maps.Map) => {
    mapRef.current = mapInstance

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

  return (
    <div className="relative h-full">
      {/* 地図 - isolateでスタッキングコンテキストを隔離しオーバーレイ要素が隠れるのを防止 */}
      <div className="absolute inset-0 isolate">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={DEFAULT_ZOOM}
          options={mapOptions}
          onLoad={handleLoad}
        />
      </div>

      {/* 検索バー */}
      <div className="absolute top-3 left-3 right-3 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="場所を検索"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* 中央固定ピン */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10">
        <MapPin className="w-10 h-10 text-red-500 drop-shadow-lg" />
      </div>

      {/* 現在地ボタン */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="absolute bottom-3 right-3 z-10 bg-white shadow-lg"
        onClick={handleCurrentLocation}
        aria-label="現在地へ移動"
      >
        <LocateFixed className="w-5 h-5" />
      </Button>

      {/* 座標表示 */}
      {position && (
        <div className="absolute bottom-3 left-3 z-10 bg-white/90 rounded px-2 py-1 text-xs shadow">
          緯度: {position.lat.toFixed(4)}, 経度: {position.lng.toFixed(4)}
        </div>
      )}
    </div>
  )
}
