import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import { GoogleMap, useLoadScript, OverlayViewF } from '@react-google-maps/api'
import Supercluster from 'supercluster'
import { API_V1_URL } from '../config/api'

// MapViewの公開メソッド型定義
export interface MapViewHandle {
  centerOnUserLocation: () => void
  refreshSpots: () => void
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

// フィルター条件の型定義（Issue#16, Issue#46）
export interface MapViewFilterParams {
  subject_categories?: number[]
  months?: number[]
  times_of_day?: string[]
  weathers?: string[]
  tags?: string[]
  min_resolution?: number
  device_type?: string
  max_age_years?: number
  aspect_ratio?: string
  focal_length_range?: string
  max_iso?: number
}

// ピンの色をTailwindクラスにマッピング
// Tailwind bgクラス（クラスタピン用）
const PIN_BG_CLASS_MAP: Record<SpotResponse['pinColor'], string> = {
  Green: 'bg-green-500',
  Yellow: 'bg-yellow-500',
  Orange: 'bg-orange-500',
  Red: 'bg-red-500',
}

// SVG fillカラー（個別ピン用）
const PIN_FILL_COLOR_MAP: Record<SpotResponse['pinColor'], string> = {
  Green: '#22c55e',
  Yellow: '#eab308',
  Orange: '#f97316',
  Red: '#ef4444',
}

// 地図の初期設定
const DEFAULT_CENTER = { lat: 35.6585, lng: 139.7454 } // 東京
const DEFAULT_ZOOM = 11
const MIN_ZOOM_FOR_PINS = 11

// クラスタリング設定（Issue#39）
const CLUSTER_RADIUS = 60
const CLUSTER_MAX_ZOOM = 16

/**
 * 投稿件数からピン色のTailwindクラスを決定
 * Issue#12のピン色ルールに準拠
 */
function determinePinColorClass(count: number): string {
  if (count >= 30) return PIN_BG_CLASS_MAP.Red
  if (count >= 10) return PIN_BG_CLASS_MAP.Orange
  if (count >= 5) return PIN_BG_CLASS_MAP.Yellow
  return PIN_BG_CLASS_MAP.Green
}

/**
 * ズームレベルに応じたピンのスケール倍率を返す
 */
function getPinScale(zoom: number): number {
  if (zoom >= 16) return 1.4
  return 1.0
}

// 個別ピンの基準サイズ (px)
const BASE_PIN_SIZE = 32
// クラスタピンの基準サイズ (px)
const BASE_CLUSTER_SIZE = 40

// supercluster用のプロパティ型
interface SpotProperties extends SpotResponse {
  [key: string]: unknown
}

// Google Maps APIキー
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// Google Maps ライブラリ（全コンポーネントで同一の定数を使用すること）
const LIBRARIES: ('places')[] = ['places']

// MapViewコンポーネントのProps（Issue#16）
interface MapViewProps {
  filterParams?: MapViewFilterParams
  onSpotClick?: (spotId: number) => void
}

/**
 * フォールバック地図UI
 * APIキーが設定されていない場合に表示
 */
function FallbackMapView() {
  return (
    <div className="w-full h-full relative bg-gradient-to-br from-gray-100 to-gray-200">
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

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({ filterParams, onSpotClick }, ref) {
  const [spots, setSpots] = useState<SpotResponse[]>([])
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [showToast, setShowToast] = useState(false)
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null)
  const [userHeading, setUserHeading] = useState<number | null>(null)
  const listenerAddedRef = useRef(false)
  const initialMountRef = useRef(true)
  const watchIdRef = useRef<number | null>(null)

  // watchPositionのクリーンアップ
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

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

  // デバイスの向き取得の許可をリクエスト（iOS 13+用）
  const requestOrientationPermission = useCallback(async () => {
    // DeviceOrientationEventにrequestPermissionメソッドがあるか確認（iOS 13+）
    const DeviceOrientationEventWithPermission = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
    }

    if (typeof DeviceOrientationEventWithPermission.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEventWithPermission.requestPermission()
        return permission === 'granted'
      } catch {
        return false
      }
    }
    // Android等、許可不要な場合はtrue
    return true
  }, [])

  // APIキーが空の場合はuseLoadScriptを呼ばない
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
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
        // Issue#47: タグフィルター
        if (filterParams.tags && filterParams.tags.length > 0) {
          filterParams.tags.forEach(tag => params.append('tags', tag))
        }
        // Issue#46: 詳細フィルター
        if (filterParams.min_resolution != null) {
          params.append('min_resolution', filterParams.min_resolution.toString())
        }
        if (filterParams.device_type) {
          params.append('device_type', filterParams.device_type)
        }
        if (filterParams.max_age_years != null) {
          params.append('max_age_years', filterParams.max_age_years.toString())
        }
        if (filterParams.aspect_ratio) {
          params.append('aspect_ratio', filterParams.aspect_ratio)
        }
        if (filterParams.focal_length_range) {
          params.append('focal_length_range', filterParams.focal_length_range)
        }
        if (filterParams.max_iso != null) {
          params.append('max_iso', filterParams.max_iso.toString())
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

  // 現在位置に移動するメソッドとスポット再取得メソッドを公開
  useImperativeHandle(ref, () => ({
    centerOnUserLocation: async () => {
      if (!map) return

      // デバイスの向き取得の許可をリクエスト
      await requestOrientationPermission()

      if ('geolocation' in navigator) {
        // 既存のwatchを停止してから新しいwatchを開始
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current)
        }

        let isFirstUpdate = true
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }
            setUserLocation(newLocation)
            // 初回のみ地図を現在地にパン
            if (isFirstUpdate) {
              map.panTo(newLocation)
              isFirstUpdate = false
            }
          },
          () => {
            // 位置情報取得失敗時は現在位置の追跡をスキップ
          },
          { enableHighAccuracy: true }
        )
      }
    },
    refreshSpots: () => {
      if (map) {
        fetchSpots(map)
      }
    },
  }), [map, requestOrientationPermission, fetchSpots])

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

  // Issue#39: supercluster によるクラスタリング
  const clusterIndex = useMemo(() => {
    const index = new Supercluster<SpotProperties>({
      radius: CLUSTER_RADIUS,
      maxZoom: CLUSTER_MAX_ZOOM,
    })
    const points: Supercluster.PointFeature<SpotProperties>[] = spots.map(spot => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [spot.longitude, spot.latitude] },
      properties: { ...spot },
    }))
    index.load(points)
    return index
  }, [spots])

  const clusteredFeatures = useMemo(() => {
    if (!map || zoom < MIN_ZOOM_FOR_PINS) return []
    const bounds = map.getBounds()
    if (!bounds) return []
    const bbox: [number, number, number, number] = [
      bounds.getSouthWest().lng(),
      bounds.getSouthWest().lat(),
      bounds.getNorthEast().lng(),
      bounds.getNorthEast().lat(),
    ]
    return clusterIndex.getClusters(bbox, Math.floor(zoom))
  }, [clusterIndex, map, zoom])

  /**
   * クラスタ内の合計投稿件数を取得
   */
  const getClusterPhotoCount = useCallback((clusterId: number): number => {
    const leaves = clusterIndex.getLeaves(clusterId, Infinity)
    return leaves.reduce((sum, leaf) => sum + (leaf.properties.photoCount || 0), 0)
  }, [clusterIndex])

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
    <div className="relative w-full h-full">
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
          isFractionalZoomEnabled: false,
        }}
      >
        {/* Issue#39: クラスタリング対応ピン表示 */}
        {zoom >= MIN_ZOOM_FOR_PINS &&
          clusteredFeatures.map((feature) => {
            const [lng, lat] = feature.geometry.coordinates
            const isCluster = feature.properties.cluster

            if (isCluster) {
              const clusterId = feature.id as number
              const totalPhotoCount = getClusterPhotoCount(clusterId)
              const colorClass = determinePinColorClass(totalPhotoCount)
              return (
                <OverlayViewF
                  key={`cluster-${clusterId}`}
                  position={{ lat, lng }}
                  mapPaneName="overlayMouseTarget"
                >
                  <div
                    data-testid={`map-cluster-${clusterId}`}
                    className={`rounded-full ${colorClass} flex items-center justify-center text-white font-bold cursor-pointer shadow-lg transform -translate-x-1/2 -translate-y-1/2 border-2 border-white`}
                    style={{
                      width: `${BASE_CLUSTER_SIZE * getPinScale(zoom)}px`,
                      height: `${BASE_CLUSTER_SIZE * getPinScale(zoom)}px`,
                      fontSize: `${14 * getPinScale(zoom)}px`,
                    }}
                    onClick={() => {
                      const expansionZoom = clusterIndex.getClusterExpansionZoom(clusterId)
                      map?.setZoom(Math.min(expansionZoom, CLUSTER_MAX_ZOOM + 1))
                      map?.panTo({ lat, lng })
                    }}
                  >
                    {totalPhotoCount}
                  </div>
                </OverlayViewF>
              )
            }

            // 個別スポット
            const spot = feature.properties as SpotProperties
            return (
              <OverlayViewF
                key={spot.spotId}
                position={{ lat, lng }}
                mapPaneName="overlayMouseTarget"
              >
                <div
                  data-testid={`map-pin-${spot.spotId}`}
                  className="cursor-pointer"
                  style={{
                    width: `${BASE_PIN_SIZE * getPinScale(zoom)}px`,
                    height: `${BASE_PIN_SIZE * 1.2 * getPinScale(zoom)}px`,
                    transform: 'translate(-50%, -100%)',
                  }}
                  onClick={() => onSpotClick?.(spot.spotId)}
                >
                  <svg viewBox="-2 -2 36 42" width="100%" height="100%">
                    <defs>
                      <filter id="pin-shadow">
                        <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.4" />
                      </filter>
                    </defs>
                    <path
                      d="M16 0C7.16 0 0 7.16 0 16c0 8 16 22 16 22s16-14 16-22C32 7.16 24.84 0 16 0z"
                      fill={PIN_FILL_COLOR_MAP[spot.pinColor]}
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth="1"
                      filter="url(#pin-shadow)"
                    />
                    <text
                      x="16"
                      y="19"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {spot.photoCount}
                    </text>
                  </svg>
                </div>
              </OverlayViewF>
            )
          })}

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
