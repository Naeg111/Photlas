import { useState, useRef, useCallback } from 'react'
import { GoogleMap, useLoadScript, OverlayViewF } from '@react-google-maps/api'

/**
 * Issue#13: 地図検索機能のインタラクション改善とピン表示制御
 * TDD Green段階: テストをパスする実装
 */

// Spot APIレスポンスの型定義
interface SpotResponse {
  spotId: number
  latitude: number
  longitude: number
  pinColor: 'Green' | 'Yellow' | 'Orange' | 'Red'
  thumbnailUrl: string
  photoCount: number
}

// ピンの色をTailwindクラスにマッピング
const PIN_COLOR_MAP: Record<SpotResponse['pinColor'], string> = {
  Green: 'bg-green-500',
  Yellow: 'bg-yellow-500',
  Orange: 'bg-orange-500',
  Red: 'bg-red-500',
}

// 地図の初期設定
const DEFAULT_CENTER = { lat: 35.6585, lng: 139.7454 } // 東京
const DEFAULT_ZOOM = 11
const MIN_ZOOM_FOR_PINS = 11

export default function MapView() {
  const [spots, setSpots] = useState<SpotResponse[]>([])
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [showToast, setShowToast] = useState(false)
  const listenerAddedRef = useRef(false)

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  })

  // スポットデータを取得（mapInstanceをパラメータで受け取る）
  const fetchSpots = async (mapInstance: google.maps.Map) => {
    try {
      const bounds = mapInstance.getBounds()
      if (!bounds) return

      const ne = bounds.getNorthEast()
      const sw = bounds.getSouthWest()

      const params = new URLSearchParams({
        north: ne.lat().toString(),
        south: sw.lat().toString(),
        east: ne.lng().toString(),
        west: sw.lng().toString(),
      })

      const response = await fetch(`/api/v1/spots?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      const data = await response.json()
      setSpots(data)
    } catch (error) {
      console.error('Failed to fetch spots:', error)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    }
  }

  // 地図が読み込まれたときの処理
  const handleLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)

    // idle イベントリスナーを一度だけ追加
    // Google Maps は初回読み込み時と地図操作後に自動的にidleイベントを発火する
    if (!listenerAddedRef.current) {
      listenerAddedRef.current = true
      mapInstance.addListener('idle', () => {
        const currentZoom = mapInstance.getZoom()
        if (currentZoom !== undefined) {
          setZoom(currentZoom)
        }
        fetchSpots(mapInstance)
      })
    }
  }, [])

  // ズームバナーをクリックしたときの処理
  const handleZoomBannerClick = () => {
    if (map) {
      map.setZoom(MIN_ZOOM_FOR_PINS)
    }
  }

  if (loadError) {
    return <div>地図の読み込みに失敗しました</div>
  }

  if (!isLoaded) {
    return <div>読み込み中...</div>
  }

  return (
    <div className="relative w-full h-screen">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        onLoad={handleLoad}
      >
        {/* ズームレベルが11以上の場合のみピンを表示 */}
        {zoom >= MIN_ZOOM_FOR_PINS &&
          spots.map((spot) => (
            <OverlayViewF
              key={spot.spotId}
              position={{ lat: spot.latitude, lng: spot.longitude }}
              mapPaneName="overlayMouseTarget"
            >
              <div
                data-testid={`map-pin-${spot.spotId}`}
                className={`rounded-full ${PIN_COLOR_MAP[spot.pinColor]} w-8 h-8 flex items-center justify-center text-white text-sm font-bold cursor-pointer shadow-lg transform -translate-x-1/2 -translate-y-1/2`}
              >
                {spot.photoCount}
              </div>
            </OverlayViewF>
          ))}
      </GoogleMap>

      {/* Zoom 10以下の場合、ズームバナーを表示 */}
      {zoom < MIN_ZOOM_FOR_PINS && (
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-6 py-3 rounded-lg shadow-lg cursor-pointer"
          onClick={handleZoomBannerClick}
        >
          <p className="text-center text-gray-700 font-semibold">
            ズームしてスポットを表示
          </p>
        </div>
      )}

      {/* エラートースト */}
      {showToast && (
        <div
          data-testid="toast-container"
          className="top-center absolute top-4 left-1/2 transform -translate-x-1/2 z-50"
        >
          <div
            role="alert"
            className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg"
          >
            データの取得に失敗しました
          </div>
        </div>
      )}
    </div>
  )
}
