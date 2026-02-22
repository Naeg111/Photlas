import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import Map, { Marker } from 'react-map-gl'
import type { MapEvent, ViewStateChangeEvent } from 'react-map-gl'
import type { Map as MapboxMap } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import Supercluster from 'supercluster'
import { API_V1_URL } from '../config/api'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'
import { PinSvg } from './PinSvg'
import { ShootingDirectionArrow } from './ShootingDirectionArrow'

// MapViewの公開メソッド型定義
export interface MapViewHandle {
  centerOnUserLocation: () => void
  refreshSpots: () => void
  zoomIn: () => void
  zoomOut: () => void
  showShootingLocationPin: (lat: number, lng: number, shootingDirection?: number | null) => void
  clearShootingLocationPin: () => void
}

/**
 * Issue#13: 地図検索機能のインタラクション改善とピン表示制御
 * Issue#16: フィルター機能統合
 * Issue#53: Google Maps API → Mapbox API 移行
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
  device_type?: string
  max_age_years?: number
  aspect_ratio?: string
  focal_length_range?: string
  max_iso?: number
}

// ピンの色をHEXカラーにマッピング（カスタムビビッドカラー）
const PIN_COLOR_MAP: Record<SpotResponse['pinColor'], string> = {
  Green: '#00d68f',
  Yellow: '#ffbe0b',
  Orange: '#ff6b35',
  Red: '#ff006e',
}

// 地図の初期設定
const DEFAULT_CENTER = { lat: 35.6585, lng: 139.7454 } // 東京
const DEFAULT_ZOOM = 11
const MIN_ZOOM_FOR_PINS = 10

// クラスタリング設定（Issue#39）
// Mapbox GL JSではデバイスピクセル比を考慮してradiusが適用されるため、
// Google Maps時代のCLUSTER_RADIUS=120相当の表示密度にするには60程度が適切
const CLUSTER_RADIUS = 60
const CLUSTER_MAX_ZOOM = 17

// UI設定
const TOAST_DURATION_MS = 3000
const PIN_HEIGHT_RATIO = 1.2
const SHOOTING_PIN_SCALE = 1.4
const PIN_ANCHOR_TRANSFORM = 'translate(-50%, -100%)'

/**
 * 投稿件数からピン色のHEXカラーを決定
 * Issue#12のピン色ルールに準拠
 */
function determinePinColor(count: number): string {
  if (count >= 30) return PIN_COLOR_MAP.Red
  if (count >= 10) return PIN_COLOR_MAP.Orange
  if (count >= 5) return PIN_COLOR_MAP.Yellow
  return PIN_COLOR_MAP.Green
}

/** 999件超の表示上限 */
const PIN_COUNT_DISPLAY_LIMIT = 999

/**
 * ピン内の件数テキストをSVG要素として返す
 * 999件超の場合は「999」と「+」を2段で表示する
 */
function renderPinCountText(count: number): React.ReactNode {
  if (count > PIN_COUNT_DISPLAY_LIMIT) {
    return (
      <>
        <text
          x="16" y="17" textAnchor="middle" fill="#ffffff"
          fontSize="14" fontWeight="bold"
          stroke="rgba(0,0,0,0.6)" strokeWidth="3" paintOrder="stroke"
        >
          {PIN_COUNT_DISPLAY_LIMIT}
        </text>
        <text
          x="16" y="28" textAnchor="middle" fill="#ffffff"
          fontSize="10" fontWeight="bold"
          stroke="rgba(0,0,0,0.6)" strokeWidth="2" paintOrder="stroke"
        >
          +
        </text>
      </>
    )
  }
  return (
    <text
      x="16" y="19" textAnchor="middle" fill="#ffffff"
      fontSize="14" fontWeight="bold"
      stroke="rgba(0,0,0,0.6)" strokeWidth="3" paintOrder="stroke"
    >
      {count}
    </text>
  )
}

/**
 * ズームレベルに応じたピンのスケール倍率を返す
 */
function getPinScale(zoom: number): number {
  if (zoom >= 16) return SHOOTING_PIN_SCALE
  return 1.0
}

// ピンの基準サイズ (px) - クラスタ・個別ピン共通
const BASE_PIN_SIZE = 32

/** URLSearchParamsに配列型フィルター値を追加 */
function appendArrayParams(params: URLSearchParams, key: string, values?: (string | number)[]) {
  values?.forEach(v => params.append(key, v.toString()))
}

/** URLSearchParamsにスカラー型フィルター値を追加 */
function appendScalarParam(params: URLSearchParams, key: string, value?: string | number | null) {
  if (value != null) {
    params.append(key, value.toString())
  }
}

// supercluster用のプロパティ型
interface SpotProperties extends SpotResponse {
  [key: string]: unknown
}

// Mapbox アクセストークン

// 撮影地点プレビューのホワイト+ブラックボーダー
const SHOOTING_PIN_COLOR = '#ffffff'
const SHOOTING_PIN_STROKE = '#000000'

interface MapViewProps {
  filterParams?: MapViewFilterParams
  onSpotClick?: (spotId: number) => void
  onClusterClick?: (spotIds: number[]) => void
  onMapClick?: () => void
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
        <p className="text-gray-500 text-sm">Mapbox アクセストークンが設定されていません</p>
      </div>
    </div>
  )
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({ filterParams, onSpotClick, onClusterClick, onMapClick }, ref) {
  const [spots, setSpots] = useState<SpotResponse[]>([])
  const [map, setMap] = useState<MapboxMap | null>(null)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [showToast, setShowToast] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [userHeading, setUserHeading] = useState<number | null>(null)
  const [shootingLocationPin, setShootingLocationPin] = useState<{ lat: number; lng: number; shootingDirection?: number | null } | null>(null)
  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick
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

  // スポットデータを取得（mapInstanceとフィルター条件をパラメータで受け取る）
  const fetchSpots = useCallback(async (mapInstance: MapboxMap) => {
    try {
      const bounds = mapInstance.getBounds()
      if (!bounds) return

      const params = new URLSearchParams({
        north: bounds.getNorth().toString(),
        south: bounds.getSouth().toString(),
        east: bounds.getEast().toString(),
        west: bounds.getWest().toString(),
      })

      // Issue#16: フィルター条件を追加
      if (filterParams) {
        appendArrayParams(params, 'subject_categories', filterParams.subject_categories)
        appendArrayParams(params, 'months', filterParams.months)
        appendArrayParams(params, 'times_of_day', filterParams.times_of_day)
        appendArrayParams(params, 'weathers', filterParams.weathers)
        appendArrayParams(params, 'tags', filterParams.tags)
        appendScalarParam(params, 'device_type', filterParams.device_type)
        appendScalarParam(params, 'max_age_years', filterParams.max_age_years)
        appendScalarParam(params, 'aspect_ratio', filterParams.aspect_ratio)
        appendScalarParam(params, 'focal_length_range', filterParams.focal_length_range)
        appendScalarParam(params, 'max_iso', filterParams.max_iso)
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
      setTimeout(() => setShowToast(false), TOAST_DURATION_MS)
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
            // 初回のみ地図を現在地にフライ
            if (isFirstUpdate) {
              map.flyTo({ center: [newLocation.lng, newLocation.lat] })
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
    zoomIn: () => {
      if (map) {
        const current = map.getZoom() ?? DEFAULT_ZOOM
        map.setZoom(current + 1)
      }
    },
    zoomOut: () => {
      if (map) {
        const current = map.getZoom() ?? DEFAULT_ZOOM
        map.setZoom(current - 1)
      }
    },
    showShootingLocationPin: (lat: number, lng: number, shootingDirection?: number | null) => {
      if (map) {
        map.flyTo({ center: [lng, lat], zoom: 16 })
        setShootingLocationPin({ lat, lng, shootingDirection })
      }
    },
    clearShootingLocationPin: () => {
      setShootingLocationPin(null)
    },
  }), [map, requestOrientationPermission, fetchSpots])

  // 地図が読み込まれたときの処理
  const handleLoad = useCallback((e: MapEvent) => {
    const mapInstance = e.target
    mapInstance.setLanguage('ja')
    setMap(mapInstance)

    // E2Eテスト用: マップインスタンスをwindowに公開（ズーム制御等）
    ;(window as unknown as Record<string, unknown>).__photlas_map = mapInstance
  }, [])

  // 地図移動完了時の処理（旧idle イベント相当）
  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    const mapInstance = e.target
    const currentZoom = mapInstance.getZoom()
    if (currentZoom !== undefined) {
      setZoom(currentZoom)
    }
    fetchSpots(mapInstance)
  }, [fetchSpots])

  // Issue#16: フィルター条件が変更されたときにスポットを再取得
  // 初回マウント時はskip（onMoveEndで既に呼ばれるため）
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
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
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

  /**
   * クラスタ内の全SpotIDを取得
   */
  const getClusterSpotIds = useCallback((clusterId: number): number[] => {
    const leaves = clusterIndex.getLeaves(clusterId, Infinity)
    return leaves.map(leaf => leaf.properties.spotId)
  }, [clusterIndex])

  // ズームバナーをクリックしたときの処理
  const handleZoomBannerClick = () => {
    if (map) {
      map.setZoom(MIN_ZOOM_FOR_PINS)
    }
  }

  // アクセストークンが空の場合はフォールバックUIを表示
  if (!MAPBOX_ACCESS_TOKEN) {
    return <FallbackMapView />
  }

  return (
    <div className="relative w-full h-full">
      <Map
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{
          longitude: DEFAULT_CENTER.lng,
          latitude: DEFAULT_CENTER.lat,
          zoom: DEFAULT_ZOOM,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAPBOX_STYLE}
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
        onClick={() => onMapClickRef.current?.()}
      >
        {/* Issue#39: クラスタリング対応ピン表示（プレビュー中は非表示） */}
        {zoom >= MIN_ZOOM_FOR_PINS && !shootingLocationPin &&
          clusteredFeatures.map((feature) => {
            const [lng, lat] = feature.geometry.coordinates
            const isCluster = feature.properties.cluster

            if (isCluster) {
              const clusterId = feature.id as number
              const totalPhotoCount = getClusterPhotoCount(clusterId)
              const pinColor = determinePinColor(totalPhotoCount)
              return (
                <Marker
                  key={`cluster-${clusterId}`}
                  longitude={lng}
                  latitude={lat}
                  anchor="bottom"
                >
                  <div
                    data-testid={`map-cluster-${clusterId}`}
                    className="cursor-pointer"
                    style={{
                      width: `${BASE_PIN_SIZE * getPinScale(zoom)}px`,
                      height: `${BASE_PIN_SIZE * PIN_HEIGHT_RATIO * getPinScale(zoom)}px`,
                      transform: PIN_ANCHOR_TRANSFORM,
                    }}
                    onClick={() => {
                      const spotIds = getClusterSpotIds(clusterId)
                      onClusterClick?.(spotIds)
                    }}
                  >
                    <PinSvg filterId={`cluster-shadow-${clusterId}`} fill={pinColor} stroke="rgba(0,0,0,0.3)">
                      {renderPinCountText(totalPhotoCount)}
                    </PinSvg>
                  </div>
                </Marker>
              )
            }

            // 個別スポット
            const spot = feature.properties as SpotProperties
            return (
              <Marker
                key={spot.spotId}
                longitude={lng}
                latitude={lat}
                anchor="bottom"
              >
                <div
                  data-testid={`map-pin-${spot.spotId}`}
                  className="cursor-pointer"
                  style={{
                    width: `${BASE_PIN_SIZE * getPinScale(zoom)}px`,
                    height: `${BASE_PIN_SIZE * PIN_HEIGHT_RATIO * getPinScale(zoom)}px`,
                    transform: PIN_ANCHOR_TRANSFORM,
                  }}
                  onClick={() => onSpotClick?.(spot.spotId)}
                >
                  <PinSvg filterId="pin-shadow" fill={PIN_COLOR_MAP[spot.pinColor]} stroke="rgba(0,0,0,0.3)">
                    {renderPinCountText(spot.photoCount)}
                  </PinSvg>
                </div>
              </Marker>
            )
          })}

        {/* 撮影地点プレビューピン（ピンクのピン + ドロップアニメーション） */}
        {shootingLocationPin && (
          <>
            <Marker
              longitude={shootingLocationPin.lng}
              latitude={shootingLocationPin.lat}
              anchor="bottom"
            >
              <div
                data-testid="shooting-location-pin"
                className="cursor-pointer"
                style={{
                  width: `${Math.round(BASE_PIN_SIZE * SHOOTING_PIN_SCALE)}px`,
                  height: `${Math.round(BASE_PIN_SIZE * PIN_HEIGHT_RATIO * SHOOTING_PIN_SCALE)}px`,
                  transform: PIN_ANCHOR_TRANSFORM,
                }}
                onClick={() => onMapClickRef.current?.()}
              >
                <div className="pin-drop">
                  <PinSvg
                    filterId="shooting-pin-shadow"
                    fill={SHOOTING_PIN_COLOR}
                    stroke={SHOOTING_PIN_STROKE}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    shapeRendering="geometricPrecision"
                  >
                    <circle cx="16" cy="14" r="6" fill={SHOOTING_PIN_STROKE} stroke={SHOOTING_PIN_STROKE} strokeWidth="1" />
                  </PinSvg>
                </div>
              </div>
            </Marker>
            {shootingLocationPin.shootingDirection != null && (
              <Marker
                longitude={shootingLocationPin.lng}
                latitude={shootingLocationPin.lat}
                anchor="center"
              >
                <div style={{ pointerEvents: 'none' }}>
                  <ShootingDirectionArrow direction={shootingLocationPin.shootingDirection} />
                </div>
              </Marker>
            )}
          </>
        )}

        {/* 現在地マーカー（パルスエフェクト + ビーム + 青い円） */}
        {userLocation && (
          <Marker
            longitude={userLocation.lng}
            latitude={userLocation.lat}
            anchor="center"
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
          </Marker>
        )}
      </Map>

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
