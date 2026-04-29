import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback'
import Map, { Marker, AttributionControl } from 'react-map-gl'
import type { MapEvent, ViewStateChangeEvent } from 'react-map-gl'
import type { Map as MapboxMap, ExpressionSpecification } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { API_V1_URL } from '../config/api'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'
import { MAPBOX_LANGUAGE_MAP, type SupportedLanguage } from '../i18n'
import { buildRateLimitApiError, notifyIfRateLimitedBurst } from '../utils/notifyIfRateLimited'
import { PinSvg } from './PinSvg'
import { generatePinImage, getPinImageId, PIN_COLOR_MAP, BASE_PIN_SIZE, PIN_HEIGHT_RATIO, PIN_PIXEL_RATIO, SHADOW_PADDING } from '../utils/pinImageGenerator'

// MapViewの公開メソッド型定義
export interface MapViewHandle {
  centerOnUserLocation: () => void
  refreshSpots: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetNorthHeading: () => void
  showShootingLocationPin: (lat: number, lng: number) => void
  clearShootingLocationPin: () => void
  /** Issue#69: 場所検索結果にマップを移動する */
  flyToPlace: (lng: number, lat: number, zoom: number) => void
}

/**
 * Issue#13: 地図検索機能のインタラクション改善とピン表示制御
 * Issue#16: フィルター機能統合
 * Issue#53: Google Maps API → Mapbox API 移行
 * Issue#55: Symbol Layer移行 + クラスタリングアニメーション
 */

// Spot APIレスポンスの型定義
interface SpotResponse {
  spotId: number
  latitude: number
  longitude: number
  pinColor: 'Green' | 'Yellow' | 'Orange' | 'Red' | 'Purple'
  thumbnailUrl: string
  photoCount: number
}

// フィルター条件の型定義（Issue#16, Issue#46, Issue#87）
export interface MapViewFilterParams {
  subject_categories?: number[]
  months?: number[]
  times_of_day?: number[]
  weathers?: number[]
  device_types?: number[]
  max_age_days?: number
  aspect_ratios?: string[]
  focal_length_ranges?: string[]
  max_iso?: number
}

// 地図の初期設定
const DEFAULT_CENTER = { lat: 35.6585, lng: 139.7454 } // 東京
const DEFAULT_ZOOM = 11

// クラスタリング設定（Issue#39, Issue#55, Issue#103: 全ズームレベル対応）
const CLUSTER_RADIUS = 70
const CLUSTER_MAX_ZOOM = 17

// UI設定
const TOAST_DURATION_MS = 3000
const TOP_UI_HEIGHT = 56
/** 長距離移動の閾値（緯度経度の度数、約1110km） */
const LONG_DISTANCE_THRESHOLD = 4.5
const TRANSITION_FADE_MS = 500

/** 地図遷移完了時のフェードアウト処理を生成（ネスト深度削減用） */
function createTransitionCompleter(
  setMapTransitioning: (v: boolean) => void,
  setMapTransitionFading: (v: boolean) => void
) {
  let completed = false
  return () => {
    if (completed) return
    completed = true
    setMapTransitionFading(true)
    setTimeout(() => {
      setMapTransitioning(false)
      setMapTransitionFading(false)
    }, TRANSITION_FADE_MS)
  }
}
const TRANSITION_TIMEOUT_MS = 5000
/** マップ移動完了時のスポット取得デバウンス（ms） */
const FETCH_SPOTS_DEBOUNCE_MS = 500
const SHOOTING_PIN_SCALE = 1.4

/**
 * 偶数ピクセルに丸める
 */
function roundToEven(n: number): number {
  return Math.round(n / 2) * 2
}

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

// Symbol Layer のID定数
const SOURCE_ID = 'spots'
const CLUSTER_LAYER_ID = 'clusters'
const UNCLUSTERED_LAYER_ID = 'unclustered-point'

// 撮影地点プレビューのホワイト+ブラックボーダー
const SHOOTING_PIN_COLOR = '#ffffff'
const SHOOTING_PIN_STROKE = '#000000'

// ピン画像の生成スケール（最大表示サイズに合わせて生成し、縮小表示で鮮明さを維持）
const PIN_IMAGE_SCALE = 1.4
// Symbol Layer共通: ズームレベルに応じたアイコンサイズ
// Canvas画像は最大スケール(1.4倍)+SHADOW_PADDING分で生成されるため、
// icon-sizeで縮小補正してIssue#55以前のPinSvg（32x38px表示）と同じサイズにする
const PIN_IMAGE_LOGICAL_WIDTH = Math.round(BASE_PIN_SIZE * PIN_IMAGE_SCALE) + SHADOW_PADDING
const PIN_SIZE_CORRECTION = BASE_PIN_SIZE / PIN_IMAGE_LOGICAL_WIDTH

// Symbol Layer 共通: ズームレベルに応じたアイコンサイズ
// 全ピン（紫ピン含む）共通で、zoom >= 16 から 1.4 倍に拡大する
const ICON_SIZE_EXPRESSION: ExpressionSpecification = [
  'step', ['zoom'],
  PIN_SIZE_CORRECTION,                          // zoom < 16: 通常サイズ
  16, PIN_SIZE_CORRECTION * PIN_IMAGE_SCALE,    // zoom >= 16: 1.4 倍
]

/**
 * 投稿件数プロパティからピン色HEXを決定するMapbox Expression
 * Issue#103: 閾値を引き上げ、1,000 件以上の Purple を追加
 * @param countProperty - 件数を取得するプロパティ名
 */
function buildPinColorExpression(countProperty: string): ExpressionSpecification {
  return [
    'case',
    ['>=', ['get', countProperty], 1000], PIN_COLOR_MAP.Purple,
    ['>=', ['get', countProperty], 100], PIN_COLOR_MAP.Red,
    ['>=', ['get', countProperty], 50], PIN_COLOR_MAP.Orange,
    ['>=', ['get', countProperty], 10], PIN_COLOR_MAP.Yellow,
    PIN_COLOR_MAP.Green,
  ]
}

// クラスタリングフェードアニメーション時間 (ms)
const CLUSTER_FADE_DURATION_MS = 300

interface MapViewProps {
  filterParams?: MapViewFilterParams
  onSpotClick?: (spotId: number) => void
  onClusterClick?: (spotIds: number[]) => void
  onMapClick?: () => void
  onMapReady?: () => void
}

/**
 * フォールバック地図UI
 * APIキーが設定されていない場合に表示
 */
function FallbackMapView() {
  return (
    <div className="w-full h-full relative bg-gradient-to-br from-gray-100 to-gray-200">
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
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-6 py-4 rounded-lg shadow-lg text-center">
        <p className="text-gray-700 font-semibold mb-2">地図を表示できません</p>
        <p className="text-gray-500 text-sm">Mapbox アクセストークンが設定されていません</p>
      </div>
    </div>
  )
}

/**
 * スポットデータをGeoJSON FeatureCollectionに変換
 */
function spotsToGeoJson(spots: SpotResponse[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: spots.map(spot => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [spot.longitude, spot.latitude],
      },
      properties: {
        spotId: spot.spotId,
        pinColor: spot.pinColor,
        photoCount: spot.photoCount,
        thumbnailUrl: spot.thumbnailUrl,
      },
    })),
  }
}

/**
 * スポットデータに必要なピン画像をすべて生成してmapに登録する
 */
function registerPinImages(mapInstance: MapboxMap, spots: SpotResponse[]): void {
  // 個別スポットのピン画像を登録
  const registeredIds = new Set<string>()

  for (const spot of spots) {
    const color = PIN_COLOR_MAP[spot.pinColor]
    const imageId = getPinImageId(color, spot.photoCount)
    if (!registeredIds.has(imageId) && !mapInstance.hasImage(imageId)) {
      const imageData = generatePinImage(color, spot.photoCount, PIN_IMAGE_SCALE)
      mapInstance.addImage(imageId, imageData, { pixelRatio: PIN_PIXEL_RATIO })
      registeredIds.add(imageId)
    }
  }
}

function handleClusterClick(mapInstance: MapboxMap, e: any, callbackRef: React.RefObject<((ids: number[]) => void) | undefined>) {
  if (!e.features || e.features.length === 0) return
  const clusterId = e.features[0].properties.cluster_id
  const source = mapInstance.getSource(SOURCE_ID) as any
  if (!source?.getClusterLeaves) return
  source.getClusterLeaves(clusterId, Infinity, 0, (err: any, leaves: any[]) => {
    if (!err && leaves) {
      const spotIds = leaves.map((leaf: any) => leaf.properties.spotId)
      callbackRef.current?.(spotIds)
    }
  })
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({ filterParams, onSpotClick, onClusterClick, onMapClick, onMapReady }, ref) {
  const { t, i18n } = useTranslation()
  const mapboxLang = MAPBOX_LANGUAGE_MAP[i18n.language as SupportedLanguage] || 'en'
  const [spots, setSpots] = useState<SpotResponse[]>([])
  const [map, setMap] = useState<MapboxMap | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [mapTransitioning, setMapTransitioning] = useState(false)
  const [mapTransitionFading, setMapTransitionFading] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [shootingLocationPin, setShootingLocationPin] = useState<{ lat: number; lng: number } | null>(null)
  const savedMapStateRef = useRef<{ center: [number, number]; zoom: number } | null>(null)
  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick
  const onSpotClickRef = useRef(onSpotClick)
  onSpotClickRef.current = onSpotClick
  const onClusterClickRef = useRef(onClusterClick)
  onClusterClickRef.current = onClusterClick
  const initialMountRef = useRef(true)
  const watchIdRef = useRef<number | null>(null)
  const layersInitializedRef = useRef(false)

  // watchPositionのクリーンアップ
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

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
    return true
  }, [])

  // Symbol Layerの初期化
  const initializeSymbolLayers = useCallback((mapInstance: MapboxMap) => {
    if (layersInitializedRef.current) return

    // GeoJSON Sourceを追加（クラスタリングON）
    mapInstance.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterRadius: CLUSTER_RADIUS,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterProperties: {
        totalPhotoCount: ['+', ['get', 'photoCount']],
      },
    })

    // styleimagemissing イベント: 動的にピン画像を生成
    mapInstance.on('styleimagemissing', (e: { id: string }) => {
      const match = /^pin-(#[0-9a-f]+)-(\d+)$/i.exec(e.id)
      if (match) {
        const color = match[1]
        const count = Number.parseInt(match[2], 10)
        const imageData = generatePinImage(color, count, PIN_IMAGE_SCALE)
        if (!mapInstance.hasImage(e.id)) {
          mapInstance.addImage(e.id, imageData, { pixelRatio: PIN_PIXEL_RATIO })
        }
      }
    })

    // クラスタ用 Symbol Layer (Issue#103: minzoom 制約を撤廃)
    mapInstance.addLayer({
      id: CLUSTER_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': [
          'concat',
          'pin-',
          buildPinColorExpression('totalPhotoCount'),
          '-',
          ['to-string', ['get', 'totalPhotoCount']],
        ],
        'icon-allow-overlap': true,
        'icon-anchor': 'bottom',
        'icon-size': ICON_SIZE_EXPRESSION,
      },
    })

    // 個別ピン用 Symbol Layer (Issue#103: minzoom 制約を撤廃, Purple 追加)
    mapInstance.addLayer({
      id: UNCLUSTERED_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': [
          'concat',
          'pin-',
          [
            'case',
            ['==', ['get', 'pinColor'], 'Purple'], PIN_COLOR_MAP.Purple,
            ['==', ['get', 'pinColor'], 'Red'], PIN_COLOR_MAP.Red,
            ['==', ['get', 'pinColor'], 'Orange'], PIN_COLOR_MAP.Orange,
            ['==', ['get', 'pinColor'], 'Yellow'], PIN_COLOR_MAP.Yellow,
            PIN_COLOR_MAP.Green,
          ],
          '-',
          ['to-string', ['get', 'photoCount']],
        ],
        'icon-allow-overlap': true,
        'icon-anchor': 'bottom',
        'icon-size': ICON_SIZE_EXPRESSION,
      },
    })

    // 個別ピンのクリックイベント
    mapInstance.on('click', UNCLUSTERED_LAYER_ID, (e: any) => {
      if (e.features && e.features.length > 0) {
        const spotId = e.features[0].properties.spotId
        onSpotClickRef.current?.(spotId)
      }
    })

    // クラスタのクリックイベント
    mapInstance.on('click', CLUSTER_LAYER_ID, (e: any) => handleClusterClick(mapInstance, e, onClusterClickRef))

    layersInitializedRef.current = true
  }, [])

  // spotsをGeoJSON形式にメモ化（spots参照が変わっても中身が同じなら再生成しない）
  const geoJsonData = useMemo(() => spotsToGeoJson(spots), [spots])

  // スポットデータが変更されたらSource/画像を更新
  useEffect(() => {
    if (!map || !layersInitializedRef.current) return

    // ピン画像を登録
    registerPinImages(map, spots)

    // GeoJSONデータを更新
    const source = map.getSource(SOURCE_ID) as any
    if (source) {
      source.setData(geoJsonData)
    }
  }, [map, spots, geoJsonData])

  // 撮影地点プレビュー時のSymbol Layer表示/非表示
  useEffect(() => {
    if (!map || !layersInitializedRef.current) return

    const visibility = shootingLocationPin ? 'none' : 'visible'
    try {
      map.setLayoutProperty(CLUSTER_LAYER_ID, 'visibility', visibility)
      map.setLayoutProperty(UNCLUSTERED_LAYER_ID, 'visibility', visibility)
    } catch {
      // Layer未初期化の場合はスキップ
    }
  }, [map, shootingLocationPin])

  // スポットデータを取得
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

      if (filterParams) {
        appendArrayParams(params, 'subject_categories', filterParams.subject_categories)
        appendArrayParams(params, 'months', filterParams.months)
        appendArrayParams(params, 'times_of_day', filterParams.times_of_day)
        appendArrayParams(params, 'weathers', filterParams.weathers)
        appendArrayParams(params, 'device_types', filterParams.device_types)
        appendScalarParam(params, 'max_age_days', filterParams.max_age_days)
        appendArrayParams(params, 'aspect_ratios', filterParams.aspect_ratios)
        appendArrayParams(params, 'focal_length_ranges', filterParams.focal_length_ranges)
        appendScalarParam(params, 'max_iso', filterParams.max_iso)
      }

      const response = await fetch(`${API_V1_URL}/spots?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 429) {
          notifyIfRateLimitedBurst(buildRateLimitApiError(response), t)
          return
        }
        throw new Error('API request failed')
      }

      const data = await response.json()
      setSpots(data)
    } catch {
      setShowToast(true)
      setTimeout(() => setShowToast(false), TOAST_DURATION_MS)
    }
  }, [filterParams, t])

  // 現在位置に移動するメソッドとスポット再取得メソッドを公開
  useImperativeHandle(ref, () => ({
    centerOnUserLocation: async () => {
      if (!map) return

      await requestOrientationPermission()

      if ('geolocation' in navigator) {
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
            if (isFirstUpdate) {
              const currentCenter = map.getCenter()
              const distance = Math.sqrt(
                Math.pow(newLocation.lng - currentCenter.lng, 2) + Math.pow(newLocation.lat - currentCenter.lat, 2)
              )
              if (distance > LONG_DISTANCE_THRESHOLD) {
                setMapTransitioning(true)
                const completeTransition = createTransitionCompleter(setMapTransitioning, setMapTransitionFading)
                requestAnimationFrame(() => {
                  map.jumpTo({ center: [newLocation.lng, newLocation.lat] })
                  map.once('idle', completeTransition)
                  setTimeout(completeTransition, TRANSITION_TIMEOUT_MS)
                })
              } else {
                map.flyTo({ center: [newLocation.lng, newLocation.lat] })
              }
              isFirstUpdate = false
            }
          },
          () => {},
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
        map.easeTo({ zoom: current + 1, duration: 375 })
      }
    },
    zoomOut: () => {
      if (map) {
        const current = map.getZoom() ?? DEFAULT_ZOOM
        map.easeTo({ zoom: current - 1, duration: 375 })
      }
    },
    resetNorthHeading: () => {
      if (map) {
        map.easeTo({ bearing: 0, pitch: 0, duration: 500 })
      }
    },
    showShootingLocationPin: (lat: number, lng: number) => {
      if (map) {
        savedMapStateRef.current = {
          center: [map.getCenter().lng, map.getCenter().lat],
          zoom: map.getZoom(),
        }
        const currentCenter = map.getCenter()
        const distance = Math.sqrt(
          Math.pow(lng - currentCenter.lng, 2) + Math.pow(lat - currentCenter.lat, 2)
        )
        if (distance > LONG_DISTANCE_THRESHOLD) {
          setMapTransitioning(true)
          const completeTransition = createTransitionCompleter(setMapTransitioning, setMapTransitionFading)
          requestAnimationFrame(() => {
            map.jumpTo({ center: [lng, lat], zoom: 16 })
            map.once('idle', completeTransition)
            setTimeout(completeTransition, TRANSITION_TIMEOUT_MS)
          })
        } else {
          map.flyTo({ center: [lng, lat], zoom: 16 })
        }
        setShootingLocationPin({ lat, lng })
      }
    },
    clearShootingLocationPin: () => {
      if (map && savedMapStateRef.current) {
        map.flyTo({
          center: savedMapStateRef.current.center,
          zoom: savedMapStateRef.current.zoom,
        })
        savedMapStateRef.current = null
      }
      setShootingLocationPin(null)
    },
    flyToPlace: (lng: number, lat: number, zoom: number) => {
      if (!map) return
      const currentCenter = map.getCenter()
      const distance = Math.sqrt(
        Math.pow(lng - currentCenter.lng, 2) + Math.pow(lat - currentCenter.lat, 2)
      )
      const padding = { top: TOP_UI_HEIGHT, bottom: 0, left: 0, right: 0 }

      if (distance > LONG_DISTANCE_THRESHOLD) {
        setMapTransitioning(true)
        const completeTransition = createTransitionCompleter(setMapTransitioning, setMapTransitionFading)
        requestAnimationFrame(() => {
          map.jumpTo({ center: [lng, lat], zoom, padding })
          map.once('idle', completeTransition)
          setTimeout(completeTransition, TRANSITION_TIMEOUT_MS)
        })
      } else {
        map.flyTo({ center: [lng, lat], zoom, speed: 0.8, padding })
      }
    },
  }), [map, requestOrientationPermission, fetchSpots])

  // 地図が読み込まれたときの処理
  const handleLoad = useCallback((e: MapEvent) => {
    const mapInstance = e.target

    // Symbol Layerを初期化
    initializeSymbolLayers(mapInstance)

    setMap(mapInstance)

    fetchSpots(mapInstance)

    // E2Eテスト用: マップインスタンスをwindowに公開
    ;(globalThis as unknown as Record<string, unknown>).__photlas_map = mapInstance

    onMapReady?.()
  }, [fetchSpots, onMapReady, initializeSymbolLayers])

  // 地図移動完了時のスポット取得（デバウンス: 連続操作を1回のAPI呼び出しにまとめる）
  const debouncedFetchSpots = useDebouncedCallback(
    (mapInstance: MapboxMap) => fetchSpots(mapInstance),
    FETCH_SPOTS_DEBOUNCE_MS
  )

  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    const mapInstance = e.target
    debouncedFetchSpots(mapInstance)
  }, [debouncedFetchSpots])

  // フィルター条件が変更されたときにスポットを再取得
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
        language={mapboxLang}
        fadeDuration={CLUSTER_FADE_DURATION_MS}
        renderWorldCopies={false}
        attributionControl={false}
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
        onClick={() => onMapClickRef.current?.()}
      >
        <AttributionControl position="bottom-left" />
        {/* Issue#55: スポットピンはSymbol Layerで描画（DOMなし） */}
        {/* クラスタリングはMapbox GL JSネイティブのGeoJSON Source cluster機能で処理 */}

        {/* 撮影地点プレビューピン（DOM Marker維持） */}
        {shootingLocationPin && (
          <Marker
            longitude={shootingLocationPin.lng}
            latitude={shootingLocationPin.lat}
            anchor="bottom"
          >
            <div
              data-testid="shooting-location-pin"
              role="presentation"
              className="cursor-pointer"
              style={{
                width: `${roundToEven(BASE_PIN_SIZE * SHOOTING_PIN_SCALE)}px`,
                height: `${roundToEven(BASE_PIN_SIZE * PIN_HEIGHT_RATIO * SHOOTING_PIN_SCALE)}px`,
              }}
              onClick={() => onMapClickRef.current?.()}
            >
              <div className="pin-drop">
                <PinSvg
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
              <div
                className="location-pulse absolute top-1/2 left-1/2 w-8 h-8 rounded-full bg-blue-400"
                style={{ transform: 'translate(-50%, -50%)' }}
              />
              <div
                className="location-pulse absolute top-1/2 left-1/2 w-8 h-8 rounded-full bg-blue-400"
                style={{ transform: 'translate(-50%, -50%)', animationDelay: '0.5s' }}
              />

              <div
                className="absolute top-1/2 left-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg"
                style={{ transform: 'translate(-50%, -50%)' }}
              />
            </div>
          </Marker>
        )}
      </Map>

      {/* 長距離移動時のフェードオーバーレイ */}
      {mapTransitioning && (
        <div
          data-testid="map-transition-overlay"
          className={`absolute inset-0 z-30 bg-black transition-opacity duration-500 ${
            mapTransitionFading ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}

      {/* エラートースト */}
      {showToast && (
        <div
          data-testid="toast-container"
          className="top-center absolute top-[calc(1rem+env(safe-area-inset-top,0px))] left-1/2 transform -translate-x-1/2 z-50"
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
