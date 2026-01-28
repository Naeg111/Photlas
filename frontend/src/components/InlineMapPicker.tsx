import { useState, useCallback } from 'react'
import { GoogleMap, useLoadScript } from '@react-google-maps/api'
import { MapPin, LocateFixed } from 'lucide-react'
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
  const [map, setMap] = useState<google.maps.Map | null>(null)

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const handleLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)

    // 地図のドラッグ終了時に中心座標を取得
    mapInstance.addListener('idle', () => {
      const center = mapInstance.getCenter()
      if (center) {
        onPositionChange({
          lat: center.lat(),
          lng: center.lng(),
        })
      }
    })
  }, [onPositionChange])

  const handleCurrentLocation = useCallback(() => {
    if (!navigator.geolocation || !map) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCenter = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        map.panTo(newCenter)
        onPositionChange(newCenter)
      },
      (error) => {
        console.error('位置情報の取得に失敗しました:', error)
      },
      { enableHighAccuracy: true }
    )
  }, [map, onPositionChange])

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
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={DEFAULT_ZOOM}
        options={mapOptions}
        onLoad={handleLoad}
      />

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
