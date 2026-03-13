import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import Map, { Marker } from 'react-map-gl'
import type { MapEvent, ViewStateChangeEvent } from 'react-map-gl'
import type { Map as MapboxMap, ExpressionSpecification } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { API_V1_URL } from '../config/api'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'
import { PinSvg } from './PinSvg'
import { generatePinImage, getPinImageId, PIN_COLOR_MAP, BASE_PIN_SIZE, PIN_HEIGHT_RATIO, PIN_PIXEL_RATIO, SHADOW_PADDING } from '../utils/pinImageGenerator'

// MapViewの公開メソッド型定義
export interface MapViewHandle {
  centerOnUserLocation: () => void
  refreshSpots: () => void
  zoomIn: () => void
  zoomOut: () => void
  showShootingLocationPin: (lat: number, lng: number) => void
  clearShootingLocationPin: () => void
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
  device_type?: string
  max_age_years?: number
  aspect_ratio?: string
  focal_length_range?: string
  max_iso?: number
}

// 地図の初期設定
const DEFAULT_CENTER = { lat: 35.6585, lng: 139.7454 } // 東京
const DEFAULT_ZOOM = 11
const MIN_ZOOM_FOR_PINS = 10

// クラスタリング設定（Issue#39, Issue#55）
const CLUSTER_RADIUS = 70
const CLUSTER_MAX_ZOOM = 17

// UI設定
const TOAST_DURATION_MS = 3000
const SHOOTING_PIN_SCALE = 1.4
// クラスタ展開・集約時の位置アニメーション時間 (ms)
const CLUSTER_ANIMATION_DURATION_MS = 300

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
const ANIMATION_SOURCE_ID = 'spots-animation'
const ANIMATION_LAYER_ID = 'animation-point'

// 撮影地点プレビューのホワイト+ブラックボーダー
const SHOOTING_PIN_COLOR = '#ffffff'
const SHOOTING_PIN_STROKE = '#000000'

// Symbol Layer共通: ズームレベルに応じたアイコンサイズ
// Canvas画像はSHADOW_PADDING分大きいため、icon-sizeで補正して
// Issue#55以前のPinSvg（32x38px表示）と同じサイズにする
const PIN_SIZE_CORRECTION = BASE_PIN_SIZE / (BASE_PIN_SIZE + SHADOW_PADDING)
const ICON_SIZE_EXPRESSION: ExpressionSpecification = [
  'step', ['zoom'],
  PIN_SIZE_CORRECTION,               // zoom < 16: 通常サイズ
  16, PIN_SIZE_CORRECTION * 1.4,     // zoom >= 16: 1.4倍
]

/**
 * 投稿件数プロパティからピン色HEXを決定するMapbox Expression
 * @param countProperty - 件数を取得するプロパティ名
 */
function buildPinColorExpression(countProperty: string): ExpressionSpecification {
  return [
    'case',
    ['>=', ['get', countProperty], 30], PIN_COLOR_MAP.Red,
    ['>=', ['get', countProperty], 10], PIN_COLOR_MAP.Orange,
    ['>=', ['get', countProperty], 5], PIN_COLOR_MAP.Yellow,
    PIN_COLOR_MAP.Green,
  ]
}

/** Cubic ease-out（減速曲線） */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** 候補座標の中からターゲットに最も近い座標を返す */
function findNearestPosition(
  target: [number, number],
  candidates: Array<[number, number]>,
): [number, number] | null {
  if (candidates.length === 0) return null
  let nearest = candidates[0]
  let minDist = Infinity
  for (const c of candidates) {
    const dx = c[0] - target[0]
    const dy = c[1] - target[1]
    const dist = dx * dx + dy * dy
    if (dist < minDist) {
      minDist = dist
      nearest = c
    }
  }
  return nearest
}

/** フィーチャーpropertiesからピン画像IDを生成 */
function buildIconImageId(properties: Record<string, any> | null): string {
  if (!properties) return `pin-${PIN_COLOR_MAP.Green}-1`
  if (properties.totalPhotoCount !== undefined) {
    const count = properties.totalPhotoCount
    const color = count >= 30 ? PIN_COLOR_MAP.Red
      : count >= 10 ? PIN_COLOR_MAP.Orange
      : count >= 5 ? PIN_COLOR_MAP.Yellow
      : PIN_COLOR_MAP.Green
    return `pin-${color}-${count}`
  }
  const color = PIN_COLOR_MAP[properties.pinColor as keyof typeof PIN_COLOR_MAP] || PIN_COLOR_MAP.Green
  return `pin-${color}-${properties.photoCount || 1}`
}

/** ズーム変更前のスナップショット */
interface PreZoomSnapshot {
  zoom: number
  clusterPositions: Array<[number, number]>
  unclustered: Map<number, { coordinates: [number, number]; properties: Record<string, any> }>
}

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
      const imageData = generatePinImage(color, spot.photoCount, 1.0)
      mapInstance.addImage(imageId, imageData, { pixelRatio: PIN_PIXEL_RATIO })
      registeredIds.add(imageId)
    }
  }
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({ filterParams, onSpotClick, onClusterClick, onMapClick, onMapReady }, ref) {
  const [spots, setSpots] = useState<SpotResponse[]>([])
  const [map, setMap] = useState<MapboxMap | null>(null)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [showToast, setShowToast] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [userHeading, setUserHeading] = useState<number | null>(null)
  const [shootingLocationPin, setShootingLocationPin] = useState<{ lat: number; lng: number } | null>(null)
  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick
  const onSpotClickRef = useRef(onSpotClick)
  onSpotClickRef.current = onSpotClick
  const onClusterClickRef = useRef(onClusterClick)
  onClusterClickRef.current = onClusterClick
  const initialMountRef = useRef(true)
  const watchIdRef = useRef<number | null>(null)
  const layersInitializedRef = useRef(false)
  const animFrameRef = useRef<number | null>(null)
  const preZoomRef = useRef<PreZoomSnapshot | null>(null)

  // watchPositionのクリーンアップ
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  // アニメーションフレームのクリーンアップ
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [])

  // デバイスの向きを取得
  useEffect(() => {
    if (!userLocation) return

    const handleOrientation = (event: DeviceOrientationEvent) => {
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
      const match = e.id.match(/^pin-(#[0-9a-f]+)-(\d+)$/i)
      if (match) {
        const color = match[1]
        const count = parseInt(match[2], 10)
        const imageData = generatePinImage(color, count, 1.0)
        if (!mapInstance.hasImage(e.id)) {
          mapInstance.addImage(e.id, imageData, { pixelRatio: PIN_PIXEL_RATIO })
        }
      }
    })

    // クラスタ用 Symbol Layer
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

    // 個別ピン用 Symbol Layer
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

    // アニメーション用Source・Layer（クラスタリングなし）
    mapInstance.addSource(ANIMATION_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    mapInstance.addLayer({
      id: ANIMATION_LAYER_ID,
      type: 'symbol',
      source: ANIMATION_SOURCE_ID,
      layout: {
        'icon-image': ['get', 'iconImage'],
        'icon-allow-overlap': true,
        'icon-anchor': 'bottom',
        'icon-size': ICON_SIZE_EXPRESSION,
        'visibility': 'none',
      },
    })

    // クラスタ展開・集約アニメーション
    mapInstance.on('zoomstart', () => {
      // 進行中のアニメーションをキャンセル
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
        try {
          mapInstance.setLayoutProperty(UNCLUSTERED_LAYER_ID, 'visibility', 'visible')
          mapInstance.setLayoutProperty(ANIMATION_LAYER_ID, 'visibility', 'none')
          const animSource = mapInstance.getSource(ANIMATION_SOURCE_ID) as any
          if (animSource) animSource.setData({ type: 'FeatureCollection', features: [] })
        } catch { /* Layer未初期化 */ }
      }

      // ズーム前の状態をスナップショット
      try {
        const clusterFeatures = mapInstance.queryRenderedFeatures({ layers: [CLUSTER_LAYER_ID] })
        const unclusteredFeatures = mapInstance.queryRenderedFeatures({ layers: [UNCLUSTERED_LAYER_ID] })

        const unclustered = new Map<number, { coordinates: [number, number]; properties: Record<string, any> }>()
        for (const f of unclusteredFeatures) {
          const spotId = f.properties?.spotId
          if (spotId != null) {
            unclustered.set(spotId, {
              coordinates: (f.geometry as GeoJSON.Point).coordinates as [number, number],
              properties: { ...f.properties },
            })
          }
        }

        preZoomRef.current = {
          zoom: mapInstance.getZoom(),
          clusterPositions: clusterFeatures.map(f =>
            (f.geometry as GeoJSON.Point).coordinates as [number, number]
          ),
          unclustered,
        }
      } catch {
        preZoomRef.current = null
      }
    })

    mapInstance.on('zoomend', () => {
      const preZoom = preZoomRef.current
      if (!preZoom) return
      preZoomRef.current = null

      const currentZoom = mapInstance.getZoom()
      if (Math.abs(currentZoom - preZoom.zoom) < 0.01) return

      const isZoomIn = currentZoom > preZoom.zoom

      try {
        const newUnclusteredFeatures = mapInstance.queryRenderedFeatures({ layers: [UNCLUSTERED_LAYER_ID] })
        const newClusterFeatures = mapInstance.queryRenderedFeatures({ layers: [CLUSTER_LAYER_ID] })

        if (isZoomIn) {
          // ズームイン: 新たに出現した個別ピンを旧クラスタ中心からアニメーション
          const newSpotIds = new Set<number>()
          const allNewUnclustered: Array<{ coordinates: [number, number]; properties: Record<string, any> }> = []
          for (const f of newUnclusteredFeatures) {
            const spotId = f.properties?.spotId
            if (spotId != null && !newSpotIds.has(spotId)) {
              newSpotIds.add(spotId)
              allNewUnclustered.push({
                coordinates: (f.geometry as GeoJSON.Point).coordinates as [number, number],
                properties: { ...f.properties },
              })
            }
          }

          const animatingFeatures: Array<{
            startCoords: [number, number]
            destCoords: [number, number]
            properties: Record<string, any>
          }> = []
          const stationaryFeatures: Array<{
            coordinates: [number, number]
            properties: Record<string, any>
          }> = []

          for (const feat of allNewUnclustered) {
            if (preZoom.unclustered.has(feat.properties.spotId)) {
              stationaryFeatures.push(feat)
            } else {
              const nearestCluster = findNearestPosition(feat.coordinates, preZoom.clusterPositions)
              animatingFeatures.push({
                startCoords: nearestCluster || feat.coordinates,
                destCoords: feat.coordinates,
                properties: feat.properties,
              })
            }
          }

          if (animatingFeatures.length === 0) return

          mapInstance.setLayoutProperty(UNCLUSTERED_LAYER_ID, 'visibility', 'none')
          mapInstance.setLayoutProperty(ANIMATION_LAYER_ID, 'visibility', 'visible')

          const startTime = performance.now()
          const runAnimation = (now: number) => {
            const progress = Math.min((now - startTime) / CLUSTER_ANIMATION_DURATION_MS, 1)
            const eased = easeOutCubic(progress)

            const features: GeoJSON.Feature[] = []
            for (const af of animatingFeatures) {
              features.push({
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [
                    af.startCoords[0] + (af.destCoords[0] - af.startCoords[0]) * eased,
                    af.startCoords[1] + (af.destCoords[1] - af.startCoords[1]) * eased,
                  ],
                },
                properties: { iconImage: buildIconImageId(af.properties) },
              })
            }
            for (const sf of stationaryFeatures) {
              features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: sf.coordinates },
                properties: { iconImage: buildIconImageId(sf.properties) },
              })
            }

            const animSource = mapInstance.getSource(ANIMATION_SOURCE_ID) as any
            if (animSource) {
              animSource.setData({ type: 'FeatureCollection', features })
            }

            if (progress < 1) {
              animFrameRef.current = requestAnimationFrame(runAnimation)
            } else {
              mapInstance.setLayoutProperty(UNCLUSTERED_LAYER_ID, 'visibility', 'visible')
              mapInstance.setLayoutProperty(ANIMATION_LAYER_ID, 'visibility', 'none')
              if (animSource) animSource.setData({ type: 'FeatureCollection', features: [] })
              animFrameRef.current = null
            }
          }
          animFrameRef.current = requestAnimationFrame(runAnimation)
        } else {
          // ズームアウト: 消えた個別ピンを新クラスタ中心へアニメーション
          const newUnclusteredSpotIds = new Set<number>()
          for (const f of newUnclusteredFeatures) {
            const spotId = f.properties?.spotId
            if (spotId != null) newUnclusteredSpotIds.add(spotId)
          }

          const disappeared: Array<{ coordinates: [number, number]; properties: Record<string, any> }> = []
          for (const [spotId, data] of preZoom.unclustered) {
            if (!newUnclusteredSpotIds.has(spotId)) {
              disappeared.push(data)
            }
          }

          if (disappeared.length === 0) return

          const newClusterPositions = newClusterFeatures.map(f =>
            (f.geometry as GeoJSON.Point).coordinates as [number, number]
          )

          const animatingFeatures = disappeared.map(feat => ({
            startCoords: feat.coordinates,
            destCoords: findNearestPosition(feat.coordinates, newClusterPositions) || feat.coordinates,
            properties: feat.properties,
          }))

          mapInstance.setLayoutProperty(ANIMATION_LAYER_ID, 'visibility', 'visible')

          const startTime = performance.now()
          const runAnimation = (now: number) => {
            const progress = Math.min((now - startTime) / CLUSTER_ANIMATION_DURATION_MS, 1)
            const eased = easeOutCubic(progress)

            const features: GeoJSON.Feature[] = animatingFeatures.map(af => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [
                  af.startCoords[0] + (af.destCoords[0] - af.startCoords[0]) * eased,
                  af.startCoords[1] + (af.destCoords[1] - af.startCoords[1]) * eased,
                ],
              },
              properties: { iconImage: buildIconImageId(af.properties) },
            }))

            const animSource = mapInstance.getSource(ANIMATION_SOURCE_ID) as any
            if (animSource) {
              animSource.setData({ type: 'FeatureCollection', features })
            }

            if (progress < 1) {
              animFrameRef.current = requestAnimationFrame(runAnimation)
            } else {
              mapInstance.setLayoutProperty(ANIMATION_LAYER_ID, 'visibility', 'none')
              if (animSource) animSource.setData({ type: 'FeatureCollection', features: [] })
              animFrameRef.current = null
            }
          }
          animFrameRef.current = requestAnimationFrame(runAnimation)
        }
      } catch { /* フィーチャー取得失敗時はアニメーションをスキップ */ }
    })

    // 個別ピンのクリックイベント
    mapInstance.on('click', UNCLUSTERED_LAYER_ID, (e: any) => {
      if (e.features && e.features.length > 0) {
        const spotId = e.features[0].properties.spotId
        onSpotClickRef.current?.(spotId)
      }
    })

    // クラスタのクリックイベント
    mapInstance.on('click', CLUSTER_LAYER_ID, (e: any) => {
      if (e.features && e.features.length > 0) {
        const clusterId = e.features[0].properties.cluster_id
        const source = mapInstance.getSource(SOURCE_ID) as any
        if (source && source.getClusterLeaves) {
          source.getClusterLeaves(clusterId, Infinity, 0, (err: any, leaves: any[]) => {
            if (!err && leaves) {
              const spotIds = leaves.map((leaf: any) => leaf.properties.spotId)
              onClusterClickRef.current?.(spotIds)
            }
          })
        }
      }
    })

    layersInitializedRef.current = true
  }, [])

  // スポットデータが変更されたらSource/画像を更新
  useEffect(() => {
    if (!map || !layersInitializedRef.current) return

    // ピン画像を登録
    registerPinImages(map, spots)

    // GeoJSONデータを更新
    const source = map.getSource(SOURCE_ID) as any
    if (source) {
      source.setData(spotsToGeoJson(spots))
    }
  }, [map, spots])

  // 撮影地点プレビュー時のSymbol Layer表示/非表示
  useEffect(() => {
    if (!map || !layersInitializedRef.current) return

    const visibility = shootingLocationPin ? 'none' : 'visible'
    try {
      map.setLayoutProperty(CLUSTER_LAYER_ID, 'visibility', visibility)
      map.setLayoutProperty(UNCLUSTERED_LAYER_ID, 'visibility', visibility)
      map.setLayoutProperty(ANIMATION_LAYER_ID, 'visibility', 'none')
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
              map.flyTo({ center: [newLocation.lng, newLocation.lat] })
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
        map.setZoom(current + 1)
      }
    },
    zoomOut: () => {
      if (map) {
        const current = map.getZoom() ?? DEFAULT_ZOOM
        map.setZoom(current - 1)
      }
    },
    showShootingLocationPin: (lat: number, lng: number) => {
      if (map) {
        map.flyTo({ center: [lng, lat], zoom: 16 })
        setShootingLocationPin({ lat, lng })
      }
    },
    clearShootingLocationPin: () => {
      setShootingLocationPin(null)
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
    ;(window as unknown as Record<string, unknown>).__photlas_map = mapInstance

    onMapReady?.()
  }, [fetchSpots, onMapReady, initializeSymbolLayers])

  // 地図移動完了時の処理
  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    const mapInstance = e.target
    const currentZoom = mapInstance.getZoom()
    if (currentZoom !== undefined) {
      setZoom(currentZoom)
    }
    fetchSpots(mapInstance)
  }, [fetchSpots])

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
        language="ja"
        fadeDuration={0}
        renderWorldCopies={false}
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
        onClick={() => onMapClickRef.current?.()}
      >
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
