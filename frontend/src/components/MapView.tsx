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
import { getGeoCountryCache, setGeoCountryCache } from '../utils/geoCountryCache'
import { fetchMyCountry } from '../utils/fetchMyCountry'
import { getCountryCoordinates } from '../utils/countryCoordinates'
import { setLastGeolocationCache } from '../utils/lastGeolocationCache'

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
  /**
   * Issue#106: 初期表示位置をユーザーの現在地またはIP国判定結果に自動的に移動する。
   * Issue#111: skipMinView=true で AUTO_CENTER_MIN_VIEW_MS の最低表示待機をスキップする
   * （位置情報が granted/denied 既知のときにスプラッシュの裏で実行する用途）。
   */
  autoCenter: (options?: { skipMinView?: boolean }) => Promise<void>
  /**
   * Issue#111: 5秒のアイドル待機をせず即時に地球儀回転を開始する。
   * App.tsx で permission=prompt のときにスプラッシュ解除と同時に呼ぶ。
   */
  startGlobeRotationImmediately: () => void
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
// Issue#106: 初期ズームは0（地球全体）。autoCenterで現在地/IP国判定結果にワープする
const DEFAULT_ZOOM = 0
// Issue#106: 初期ズーム0表示時の緯度。赤道（0）にすることで地球儀の中心が画面中央に置かれる。
// Issue#111: 経度（INITIAL_VIEW_LNG）は削除し、コンポーネント内で 0〜359 のランダム値に切替える。
// 緯度はランダム化せず引き続き赤道固定。
const INITIAL_VIEW_LAT = 0
// Issue#106: autoCenter のフォールバック用（位置情報・IP国判定がすべて失敗した場合）
const FALLBACK_TOKYO_ZOOM = 11
// Issue#106: 位置情報取得成功時のズームレベル
const GEOLOCATION_ZOOM = 14
// Issue#106: getCurrentPosition のタイムアウト
const GEOLOCATION_TIMEOUT_MS = 10000
// Issue#106: 初回起動時、ユーザーが「地球全体（ズーム0）」を視認できる最低時間（ミリ秒）。
// 位置情報がすでに許可済みのケースでは getCurrentPosition が即座に成功するため、
// この時間を確保しないとユーザーがズーム0を見る間もなく現在地に飛ばされてしまう。
// Issue#111: skipMinView=true でこの待機をスキップできるようにした。
const AUTO_CENTER_MIN_VIEW_MS = 1000

// Issue#111: 地球儀回転の設定
/** 地球 1 周にかかる秒数 */
const GLOBE_ROTATION_SECONDS_PER_REV = 60
/** マップ操作なしで回転開始するまでの待機時間（ミリ秒） */
const GLOBE_ROTATION_IDLE_DELAY_MS = 5000
/** 回転を行う最大ズームレベル（これ以上に拡大すると停止する） */
const GLOBE_ROTATION_MAX_ZOOM = 4
/** 回転 1 ティックの間隔（ミリ秒）。setInterval で呼ぶ。 */
const ROTATION_TICK_MS = 16
/** 回転 1 ティックあたりの経度の変化量（度） */
const DEGREES_PER_TICK = 360 / GLOBE_ROTATION_SECONDS_PER_REV / (1000 / ROTATION_TICK_MS)

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

/**
 * Issue#106 リファクタリング: ワープアニメーション（フェードアウト → 瞬時ジャンプ → フェードイン）を実行する共通ヘルパー。
 * centerOnUserLocation・flyToPlace（長距離分岐）・autoCenter で重複していた処理を抽出。
 */
function performWarpAnimation(
  map: MapboxMap,
  jumpToOptions: Parameters<MapboxMap['jumpTo']>[0],
  setMapTransitioning: (v: boolean) => void,
  setMapTransitionFading: (v: boolean) => void
) {
  setMapTransitioning(true)
  const completeTransition = createTransitionCompleter(setMapTransitioning, setMapTransitionFading)
  requestAnimationFrame(() => {
    map.jumpTo(jumpToOptions)
    map.once('idle', completeTransition)
    setTimeout(completeTransition, TRANSITION_TIMEOUT_MS)
  })
}
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

  // Issue#111: 地球儀回転の制御用 ref。
  // - rotationIntervalRef: 実行中の setInterval ID。null = 停止中。
  // - idleTimerRef: 「マップ操作後 5秒経過したら回転開始」を予約する setTimeout ID。
  // - isRotatingRef: state ではなく ref を使う理由は、回転中に発生した moveend で fetchSpots を
  //   スキップする判定で同期的にチェックする必要があるため。
  const rotationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRotatingRef = useRef(false)

  // Issue#111: 初期表示経度をマウント時に一度だけランダム化する（毎回違う面が正面に見える）。
  // モジュールトップレベルで Math.random() を呼ぶと SPA で MapView が再マウントされても
  // 同じ値が使われ続けるため useMemo を使う。
  const initialLongitude = useMemo(() => Math.floor(Math.random() * 360), [])

  // watchPositionのクリーンアップ
  useEffect(() => {
    return () => {
      // 防御的チェック: テスト環境では unmount 時に navigator.geolocation の clearWatch が
      // 差し替えにより undefined になっている場合があるため、関数として呼び出せるか確認する。
      if (watchIdRef.current !== null) {
        if (typeof navigator.geolocation?.clearWatch === 'function') {
          navigator.geolocation.clearWatch(watchIdRef.current)
        }
        watchIdRef.current = null
      }
      if (rotationIntervalRef.current !== null) {
        clearInterval(rotationIntervalRef.current)
        rotationIntervalRef.current = null
      }
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }
  }, [])

  // Issue#111: 地球儀回転を停止する
  const stopGlobeRotation = useCallback(() => {
    if (rotationIntervalRef.current !== null) {
      clearInterval(rotationIntervalRef.current)
      rotationIntervalRef.current = null
    }
    isRotatingRef.current = false
  }, [])

  // Issue#111: 地球儀回転を即時開始する。ズームが GLOBE_ROTATION_MAX_ZOOM を超えていたら何もしない。
  const startGlobeRotation = useCallback((mapInstance: MapboxMap) => {
    if (rotationIntervalRef.current !== null) return
    if (mapInstance.getZoom() > GLOBE_ROTATION_MAX_ZOOM) return
    isRotatingRef.current = true
    // 回転中はピン（クラスタ）を非表示にする。React state を空にすることで
    // GeoJSON Source の setData が空配列で更新され、ピンが消える。
    setSpots([])
    rotationIntervalRef.current = setInterval(() => {
      const center = mapInstance.getCenter()
      mapInstance.setCenter([center.lng + DEGREES_PER_TICK, center.lat])
    }, ROTATION_TICK_MS)
  }, [])

  // Issue#111: アイドル待機後に回転を開始するスケジュールを立てる
  const scheduleGlobeRotation = useCallback((mapInstance: MapboxMap) => {
    if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null
      startGlobeRotation(mapInstance)
    }, GLOBE_ROTATION_IDLE_DELAY_MS)
  }, [startGlobeRotation])

  // Issue#111: ユーザーがマップを操作した時のハンドラ（movestart）。
  // - 回転による setCenter で発火する movestart は originalEvent が undefined なので無視
  // - ユーザー操作（ドラッグ、ピンチ等）では originalEvent がセットされる
  const handleUserMapInteraction = useCallback((mapInstance: MapboxMap, e: { originalEvent?: unknown } | undefined) => {
    if (!e?.originalEvent) return // 回転自身が起こした programmatic な move は無視
    stopGlobeRotation()
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    // ズーム 0〜4 の範囲なら 5秒後に再度回転を開始するスケジュールを立てる
    if (mapInstance.getZoom() <= GLOBE_ROTATION_MAX_ZOOM) {
      scheduleGlobeRotation(mapInstance)
    }
  }, [stopGlobeRotation, scheduleGlobeRotation])

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
            // Issue#111: 現在位置ボタンで取得した位置も lastGeolocationCache に保存し、
            // 写真投稿マップ（InlineMapPicker）が同期的に読み出せるようにする。
            setLastGeolocationCache(newLocation.lat, newLocation.lng)
            if (isFirstUpdate) {
              const currentCenter = map.getCenter()
              const distance = Math.sqrt(
                Math.pow(newLocation.lng - currentCenter.lng, 2) + Math.pow(newLocation.lat - currentCenter.lat, 2)
              )
              if (distance > LONG_DISTANCE_THRESHOLD) {
                performWarpAnimation(
                  map,
                  { center: [newLocation.lng, newLocation.lat] },
                  setMapTransitioning,
                  setMapTransitionFading,
                )
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
        performWarpAnimation(
          map,
          { center: [lng, lat], zoom, padding },
          setMapTransitioning,
          setMapTransitionFading,
        )
      } else {
        map.flyTo({ center: [lng, lat], zoom, speed: 0.8, padding })
      }
    },
    /**
     * Issue#106: 初期表示位置をユーザーの現在地またはIP国判定結果に自動的に移動する。
     * スプラッシュ画面が閉じた後に App.tsx から呼び出される想定。
     *
     * フロー:
     * 1. getCurrentPosition で位置取得を試行（成功 → 現在地ズーム14でワープ + 現在地マーカー表示）
     * 2. 失敗時: localStorage キャッシュまたはAPIから国コードを取得 → 国の中心座標にワープ（ズーム5）
     * 3. すべて失敗: 東京（ズーム11）にワープ
     *
     * UX: ワープ前に最低 AUTO_CENTER_MIN_VIEW_MS だけズーム0（地球全体）を表示し続けて、
     * ユーザーが「地球全体 → 自分の場所」という視覚的な移行を認識できるようにする。
     * 位置情報のポップアップが表示されている間にユーザーが待機する場合は、その時間が
     * カウント対象に含まれるため、追加の待機は発生しない。
     */
    autoCenter: async (options?: { skipMinView?: boolean }) => {
      if (!map) return

      const startedAt = Date.now()
      const skipMinView = options?.skipMinView === true

      const warpToLocation = (lng: number, lat: number, zoom: number) => {
        // Issue#111: ワープ開始時に地球儀回転を停止する
        stopGlobeRotation()
        if (idleTimerRef.current !== null) {
          clearTimeout(idleTimerRef.current)
          idleTimerRef.current = null
        }
        // Mapbox の jumpTo は moveend イベントを発火するため、handleMoveEnd 経由で
        // fetchSpots が呼ばれる（zoom > 0 のフィルタにより、autoCenter 後のズーム5～14で動作）
        performWarpAnimation(
          map,
          { center: [lng, lat], zoom },
          setMapTransitioning,
          setMapTransitionFading,
        )
      }

      // ズーム0（地球全体）を最低一定時間表示するための待機ヘルパー
      const waitForMinViewDuration = async () => {
        if (skipMinView) return
        const elapsed = Date.now() - startedAt
        if (elapsed < AUTO_CENTER_MIN_VIEW_MS) {
          await new Promise((resolve) => setTimeout(resolve, AUTO_CENTER_MIN_VIEW_MS - elapsed))
        }
      }

      // 1. ブラウザの位置情報APIを試行
      const geolocationResult = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!('geolocation' in navigator)) {
          resolve(null)
          return
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_MS },
        )
      })

      if (geolocationResult) {
        // バグ修正: 現在地マーカー（青い点）を表示するため userLocation を設定する
        const userPos = {
          lat: geolocationResult.coords.latitude,
          lng: geolocationResult.coords.longitude,
        }
        setUserLocation(userPos)
        // Issue#111: ユーザーの最後の位置情報を localStorage に保存し、
        // 写真投稿マップ（InlineMapPicker）が同期的に初期表示位置として使えるようにする
        setLastGeolocationCache(userPos.lat, userPos.lng)
        await waitForMinViewDuration()
        warpToLocation(userPos.lng, userPos.lat, GEOLOCATION_ZOOM)
        return
      }

      // 2. IP国判定（キャッシュ → API）
      let countryCode = getGeoCountryCache()
      if (!countryCode) {
        countryCode = await fetchMyCountry()
        if (countryCode) {
          setGeoCountryCache(countryCode)
        }
      }
      const countryCoords = getCountryCoordinates(countryCode)

      await waitForMinViewDuration()

      if (countryCoords) {
        warpToLocation(countryCoords.lng, countryCoords.lat, countryCoords.zoom)
        return
      }

      // 3. すべて失敗 → 東京（ズーム11）にフォールバック
      warpToLocation(DEFAULT_CENTER.lng, DEFAULT_CENTER.lat, FALLBACK_TOKYO_ZOOM)
    },
    /**
     * Issue#111: 5秒のアイドル待機をスキップして地球儀回転を即時開始する。
     * 位置情報の許可状態が prompt の場合に、許可ポップアップ表示中の待ち時間を
     * 視覚的に楽しませるため、App.tsx から呼び出す。
     */
    startGlobeRotationImmediately: () => {
      if (!map) return
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      startGlobeRotation(map)
    },
  }), [map, requestOrientationPermission, fetchSpots, stopGlobeRotation, startGlobeRotation])

  // 地図が読み込まれたときの処理
  const handleLoad = useCallback((e: MapEvent) => {
    const mapInstance = e.target

    // Symbol Layerを初期化
    initializeSymbolLayers(mapInstance)

    setMap(mapInstance)

    // Issue#111: ユーザー操作（ドラッグ／ピンチ等）を検知して回転を停止する。
    // `originalEvent` の有無で programmatic / user 由来を区別する（handleUserMapInteraction 内で判定）。
    mapInstance.on('movestart', (ev: { originalEvent?: unknown }) => {
      handleUserMapInteraction(mapInstance, ev)
    })

    // Issue#111: 初期表示はズーム 0（地球全体）のため、5秒経過で地球儀回転を開始するスケジュールを立てる。
    // ただし granted/denied 既知のケースでは autoCenter が即座に warp するため、
    // 回転は始まらない（warp 前にズームが上がる）。
    if (mapInstance.getZoom() <= GLOBE_ROTATION_MAX_ZOOM) {
      scheduleGlobeRotation(mapInstance)
    }

    // Issue#106: ズーム0（地球全体）では全世界のスポットを取得しないためスキップ。
    // autoCenter のワープ完了後（mapInstance.getZoom() > 0 になった時点）の moveend / idle イベントで
    // 通常通り fetchSpots が走る。
    if (mapInstance.getZoom() > 0) {
      fetchSpots(mapInstance)
    }

    // E2Eテスト用: マップインスタンスをwindowに公開
    ;(globalThis as unknown as Record<string, unknown>).__photlas_map = mapInstance

    onMapReady?.()
  }, [fetchSpots, onMapReady, initializeSymbolLayers, handleUserMapInteraction, scheduleGlobeRotation])

  // 地図移動完了時のスポット取得（デバウンス: 連続操作を1回のAPI呼び出しにまとめる）
  const debouncedFetchSpots = useDebouncedCallback(
    (mapInstance: MapboxMap) => fetchSpots(mapInstance),
    FETCH_SPOTS_DEBOUNCE_MS
  )

  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    const mapInstance = e.target
    // Issue#106: ズーム0では全世界のスポットを取得しないためスキップ
    if (mapInstance.getZoom() <= 0) return
    // Issue#111: 地球儀回転中は moveend が連続で走るためスポット取得をスキップする
    if (isRotatingRef.current) return
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
          longitude: initialLongitude,
          latitude: INITIAL_VIEW_LAT,
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
