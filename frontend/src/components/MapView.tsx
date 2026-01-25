import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { GoogleMap, useLoadScript, OverlayViewF } from '@react-google-maps/api'
import { API_V1_URL } from '../config/api'

// MapViewの公開メソッド型定義
export interface MapViewHandle {
  centerOnUserLocation: () => void
}

/**
 * Issue#13: 地図検索機能のインタラクション改善とピン表示制御
 * Issue#16: フィルター機能統合
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

// フィルター条件の型定義（Issue#16）
export interface MapViewFilterParams {
  subject_categories?: number[]
  months?: number[]
  times_of_day?: string[]
  weathers?: string[]
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

// Google Maps APIキー
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// MapViewコンポーネントのProps（Issue#16）
interface MapViewProps {
  filterParams?: MapViewFilterParams
}

/**
 * フォールバック地図UI
 * APIキーが設定されていない場合に表示
 */
function FallbackMapView() {
  return (
    <div className="w-full h-screen relative bg-gradient-to-br from-gray-100 to-gray-200">
      {/* グリッドパターン */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(0deg, #ddd 1px, transparent 1px),
            linear-gradient(90deg, #ddd 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* 中央メッセージ */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-6 py-4 rounded-lg shadow-lg text-center">
        <p className="text-gray-700 font-semibold mb-2">地図を表示できません</p>
        <p className="text-gray-500 text-sm">Google Maps APIキーが設定されていません</p>
      </div>
    </div>
  )
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({ filterParams }, ref) {
  const [spots, setSpots] = useState<SpotResponse[]>([])
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [showToast, setShowToast] = useState(false)
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null)
  const [userHeading, setUserHeading] = useState<number | null>(null)
  const listenerAddedRef = useRef(false)
  const initialMountRef = useRef(true)

  // デバイスの向きを取得
  useEffect(() => {
    if (!userLocation) return

    const handleOrientation = (event: DeviceOrientationEvent) => {
      // webkitCompassHeading（iOS）またはalpha（Android）を使用
      const heading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
        ?? (event.alpha !== null ? (360 - event.alpha) % 360 : null)
      if (heading !== null) {
        setUserHeading(heading)
      }
    }

    window.addEventListener('deviceorientation', handleOrientation)
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [userLocation])

  // 現在位置に移動するメソッドを公開
  useImperativeHandle(ref, () => ({
    centerOnUserLocation: () => {
      if (!map) return

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }
            setUserLocation(newLocation)
            map.panTo(newLocation)
          },
          (error) => {
            console.error('位置情報の取得に失敗しました:', error)
          },
          { enableHighAccuracy: true }
        )
      }
    },
  }), [map])

  // APIキーが空の場合はuseLoadScriptを呼ばない
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  // スポットデータを取得（mapInstanceとフィルター条件をパラメータで受け取る）
  const fetchSpots = useCallback(async (mapInstance: google.maps.Map) => {
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

      // Issue#16: フィルター条件を追加
      if (filterParams) {
        if (filterParams.subject_categories && filterParams.subject_categories.length > 0) {
          filterParams.subject_categories.forEach(id => params.append('subject_categories', id.toString()))
        }
        if (filterParams.months && filterParams.months.length > 0) {
          filterParams.months.forEach(month => params.append('months', month.toString()))
        }
        if (filterParams.times_of_day && filterParams.times_of_day.length > 0) {
          filterParams.times_of_day.forEach(time => params.append('times_of_day', time))
        }
        if (filterParams.weathers && filterParams.weathers.length > 0) {
          filterParams.weathers.forEach(weather => params.append('weathers', weather))
        }
      }

      const response = await fetch(`${API_V1_URL}/spots?${params}`, {
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
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    }
  }, [filterParams])

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
  }, [fetchSpots])

  // Issue#16: フィルター条件が変更されたときにスポットを再取得
  // 初回マウント時はskip（idleイベントで既に呼ばれるため）
  // filterParamsのみに依存することで、zoom変更などによる不要な再取得を防ぐ
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false
      return
    }

    if (map) {
      fetchSpots(map)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParams])

  // ズームバナーをクリックしたときの処理
  const handleZoomBannerClick = () => {
    if (map) {
      map.setZoom(MIN_ZOOM_FOR_PINS)
    }
  }

  // APIキーが空の場合はフォールバックUIを表示
  if (!GOOGLE_MAPS_API_KEY) {
    return <FallbackMapView />
  }

  if (loadError) {
    return <FallbackMapView />
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
        options={{
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          keyboardShortcuts: false,
        }}
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

        {/* 現在地マーカー（パルスエフェクト + ビーム + 青い円） */}
        {userLocation && (
          <OverlayViewF
            position={userLocation}
            mapPaneName="overlayMouseTarget"
          >
            <div
              data-testid="user-location-marker"
              className="relative"
              style={{ width: '80px', height: '80px' }}
            >
              {/* パルスエフェクト（波紋） */}
              <div
                className="location-pulse absolute top-1/2 left-1/2 w-8 h-8 rounded-full bg-blue-400"
                style={{ transform: 'translate(-50%, -50%)' }}
              />
              <div
                className="location-pulse absolute top-1/2 left-1/2 w-8 h-8 rounded-full bg-blue-400"
                style={{ transform: 'translate(-50%, -50%)', animationDelay: '0.5s' }}
              />

              {/* ビーム（方向を示す扇形） */}
              {userHeading !== null && (
                <div
                  className="absolute top-1/2 left-1/2"
                  style={{
                    width: '60px',
                    height: '60px',
                    transform: `translate(-50%, -50%) rotate(${userHeading - 90}deg)`,
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'conic-gradient(from -22.5deg, rgba(59, 130, 246, 0.4) 0deg, rgba(59, 130, 246, 0.4) 45deg, transparent 45deg)',
                      borderRadius: '50%',
                    }}
                  />
                </div>
              )}

              {/* 中心の青い円 */}
              <div
                className="absolute top-1/2 left-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg"
                style={{ transform: 'translate(-50%, -50%)' }}
              />
            </div>
          </OverlayViewF>
        )}
      </GoogleMap>

      {/* Zoom 10以下の場合、ズームバナーを表示 */}
      {zoom < MIN_ZOOM_FOR_PINS && (
        <div
          className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-white px-6 py-3 rounded-lg shadow-lg cursor-pointer"
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
})

export default MapView
