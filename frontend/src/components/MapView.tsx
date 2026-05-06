import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback'
import { useMapboxLanguageSync } from '../hooks/useMapboxLanguageSync'
import Map, { Marker, AttributionControl } from 'react-map-gl'
import type { MapEvent, ViewStateChangeEvent } from 'react-map-gl'
import type { Map as MapboxMap, ExpressionSpecification } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { API_V1_URL } from '../config/api'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'
import { MAPBOX_LANGUAGE_MAP, type SupportedLanguage } from '../i18n'
import { buildRateLimitApiError, notifyIfRateLimitedBurst } from '../utils/notifyIfRateLimited'
import { PinSvg } from './PinSvg'
import { HeadingIndicator } from './HeadingIndicator'
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
// Issue#106: 初期ズーム0表示時の緯度。
// Issue#111: 経度（INITIAL_VIEW_LNG）は削除し、コンポーネント内で 0〜359 のランダム値に切替える。
// Issue#111-followup: 緯度は「初回マウント時の見た目」と「方位リセット時の戻り先」の2用途で 10 度を使う。
// 回転中は現在の center.lat を維持（ユーザーが緯度をいじれば、その緯度で回転を続ける）。
const INITIAL_VIEW_LAT = 10
const GLOBE_RESET_LAT = INITIAL_VIEW_LAT
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
/** 1秒あたりの経度変化量（度）。1周60秒なら 6度/秒。 */
const DEGREES_PER_SECOND = 360 / GLOBE_ROTATION_SECONDS_PER_REV

// クラスタリング設定（Issue#39, Issue#55, Issue#103: 全ズームレベル対応）
const CLUSTER_RADIUS = 70
const CLUSTER_MAX_ZOOM = 17

// UI設定
const TOAST_DURATION_MS = 3000
const TOP_UI_HEIGHT = 56
/** 長距離移動の閾値（緯度経度の度数、約500km） */
const LONG_DISTANCE_THRESHOLD = 4.5
/** Issue#116: 撮影地点プレビューの目標ズーム（行き先 + 暗転判定基準） */
const SHOOTING_PREVIEW_TARGET_ZOOM = 16
/** Issue#116: 撮影地点プレビューの暗転判定ズーム差（|現在ズーム - 16| ≥ 5 で暗転） */
const SHOOTING_PREVIEW_ZOOM_DIFF_THRESHOLD = 5
/** Issue#116: 場所検索（flyToPlace）の暗転判定ズーム差（|現在ズーム - 飛び先ズーム| ≥ 4 で暗転） */
const FLYTO_ZOOM_DIFF_THRESHOLD = 4
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

/**
 * Issue#116 リファクタリング: 緯度経度の度数空間における2点間距離。
 * 暗転判定（LONG_DISTANCE_THRESHOLD ≒ 4.5度）の比較用なので球面補正は不要。
 * showShootingLocationPin / clearShootingLocationPin / flyToPlace / centerOnUserLocation で共用する。
 */
function calculateMapDistance(
  from: { lng: number; lat: number },
  toLng: number,
  toLat: number,
): number {
  return Math.sqrt(Math.pow(toLng - from.lng, 2) + Math.pow(toLat - from.lat, 2))
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
  /**
   * Issue#111-followup §8: 投稿詳細ダイアログが表示中かどうか。
   * true の間は地球儀回転と 5 秒タイマーを停止する。
   * false に戻った時、ズーム 0〜4 なら 5 秒タイマーをセットする。
   */
  isPhotoDialogOpen?: boolean
  /** Issue#115: 方角インジケーターの ON/OFF */
  headingIndicatorEnabled?: boolean
  /** Issue#115: 現在の方角（度数、0=北、時計回り）。null は未取得 */
  heading?: number | null
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

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({ filterParams, onSpotClick, onClusterClick, onMapClick, onMapReady, isPhotoDialogOpen, headingIndicatorEnabled = false, heading = null }, ref) {
  const { t, i18n } = useTranslation()
  const mapboxLang = MAPBOX_LANGUAGE_MAP[i18n.language as SupportedLanguage] || 'en'
  const [spots, setSpots] = useState<SpotResponse[]>([])
  const [map, setMap] = useState<MapboxMap | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [mapTransitioning, setMapTransitioning] = useState(false)
  const [mapTransitionFading, setMapTransitionFading] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  // Issue#115: マップの bearing（0=北上）。HeadingIndicator が画面上の回転角を補正するために使う
  const [mapBearing, setMapBearing] = useState<number>(0)
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
  // - rotationFrameRef: 実行中の requestAnimationFrame ID。null = ループ停止中。
  //   （Issue#111-followup: setInterval から rAF に切り替え。
  //    rAF はブラウザの描画タイミングと同期するため、ユーザー入力イベントとの競合が減る）
  // - lastTickTimestampRef: 直前の rAF コールバックが呼ばれた時刻 (performance.now)。
  //   フレーム間の経過時間に応じて経度を進めることで、フレームレート差異を吸収する。
  // - idleTimerRef: 「マップ操作後 5秒経過したら回転開始」を予約する setTimeout ID。
  // - isRotatingRef: 回転状態フラグ。回転中に発生した moveend で fetchSpots を同期的に
  //   スキップする判定に使う。
  const rotationFrameRef = useRef<number | null>(null)
  const lastTickTimestampRef = useRef<number>(0)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRotatingRef = useRef(false)

  // Issue#111: 初期表示経度をマウント時に一度だけランダム化する（毎回違う面が正面に見える）。
  // モジュールトップレベルで Math.random() を呼ぶと SPA で MapView が再マウントされても
  // 同じ値が使われ続けるため useMemo を使う。
  const initialLongitude = useMemo(() => Math.floor(Math.random() * 360), [])

  // watchPosition / 地球儀回転 / アイドル予約タイマーのクリーンアップ（unmount 時）
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
      if (rotationFrameRef.current !== null) {
        cancelAnimationFrame(rotationFrameRef.current)
        rotationFrameRef.current = null
      }
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }
  }, [])

  // Issue#111: アイドル予約タイマーを止める（再スケジュール経路でも、停止経路でも使う）
  const clearIdleRotationTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  // Issue#111-followup Bug5: rAF ループを止めるだけのヘルパー。
  // 「完全停止」と「角度操作中の一時停止」の両方で使う。
  const cancelRotationFrame = useCallback(() => {
    if (rotationFrameRef.current !== null) {
      cancelAnimationFrame(rotationFrameRef.current)
      rotationFrameRef.current = null
    }
  }, [])

  // Issue#111: 地球儀回転を完全停止する。アイドル予約タイマーも一緒に止めて
  // 「停止したら確実に動かない」状態にする（再開は呼び出し側が明示的に scheduleGlobeRotation を呼ぶ）。
  const stopGlobeRotation = useCallback(() => {
    cancelRotationFrame()
    clearIdleRotationTimer()
    isRotatingRef.current = false
  }, [cancelRotationFrame, clearIdleRotationTimer])

  // Issue#111-followup Bug5: rAF ループのコールバック本体。
  // 直前のフレームから経過した実時間に比例した経度変化を加算する。
  const rotationLoop = useCallback((mapInstance: MapboxMap) => {
    const tick = (now: number) => {
      // Issue#111-followup: 回転中にホイールズームインなどでズームが 5 以上に上がったら
      // 自身でループを終了する（startGlobeRotation のガードは「開始時」しかチェックしないため）
      if (mapInstance.getZoom() > GLOBE_ROTATION_MAX_ZOOM) {
        rotationFrameRef.current = null
        isRotatingRef.current = false
        return
      }
      const elapsedMs = now - lastTickTimestampRef.current
      lastTickTimestampRef.current = now
      const deltaDegrees = (DEGREES_PER_SECOND * elapsedMs) / 1000
      const center = mapInstance.getCenter()
      // Issue#111-followup（仕様変更4回目）: 緯度は強制スナップせず、現在の center.lat を維持する。
      // ユーザーが任意の緯度に panning した場合はその緯度で回転を続ける。
      // 緯度を 10 度に戻すのは方位リセットボタンを押した時のみ。
      mapInstance.setCenter([center.lng + deltaDegrees, center.lat])
      rotationFrameRef.current = requestAnimationFrame(tick)
    }
    lastTickTimestampRef.current = performance.now()
    rotationFrameRef.current = requestAnimationFrame(tick)
  }, [])

  // Issue#111: 地球儀回転を即時開始する。ズームが GLOBE_ROTATION_MAX_ZOOM を超えていたら何もしない。
  const startGlobeRotation = useCallback((mapInstance: MapboxMap) => {
    if (rotationFrameRef.current !== null) return
    if (mapInstance.getZoom() > GLOBE_ROTATION_MAX_ZOOM) return
    // Issue#111-followup §8: 投稿詳細ダイアログ表示中は回転を開始しない
    if (isPhotoDialogOpenRef.current) return
    isRotatingRef.current = true
    // Issue#111-followup（仕様変更4回目）: 回転開始時に緯度をリセットしない。
    // 「現在いる地点を視点に回転を始める」仕様。
    // Issue#111-followup §8: 回転中もピン（クラスタ）を表示し続ける。
    // 既存の spots state は触らず、ピンが画面上で経度方向に流れて見える状態にする。
    rotationLoop(mapInstance)
  }, [rotationLoop])

  // Issue#111: GLOBE_ROTATION_IDLE_DELAY_MS のアイドル待機後に回転を開始するスケジュールを立てる
  const scheduleGlobeRotation = useCallback((mapInstance: MapboxMap) => {
    // Issue#111-followup §8: 投稿詳細ダイアログ表示中はタイマーすら立てない
    if (isPhotoDialogOpenRef.current) return
    clearIdleRotationTimer()
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null
      startGlobeRotation(mapInstance)
    }, GLOBE_ROTATION_IDLE_DELAY_MS)
  }, [clearIdleRotationTimer, startGlobeRotation])

  // Issue#111-followup §8: ユーザー操作完了直後の fetchSpots を呼ぶための ref 経由参照。
  // `debouncedFetchSpots` は本コンポーネント内で後ろの位置に定義されるため、
  // ここから直接参照すると JS の declaration 順序制約に当たる。ref を経由して回避する。
  const debouncedFetchSpotsRef = useRef<((map: MapboxMap) => void) | null>(null)

  // Issue#111-followup §8: 投稿詳細ダイアログ表示状態を ref で常に最新化。
  // handleLoad は MapMock の onLoad / 実 Mapbox の load イベントから同期的に呼ばれる。
  // 初期表示時に prop=true でも、useEffect が走る前に handleLoad → scheduleGlobeRotation
  // が走るため、render 中に ref を更新して最新値を読めるようにする（refs は同期更新可）。
  const isPhotoDialogOpenRef = useRef(false)
  isPhotoDialogOpenRef.current = isPhotoDialogOpen ?? false

  // Issue#111-followup: ユーザーのあらゆるカメラ操作で回転を停止し、5秒タイマーを引き直す。
  // 仕様変更（2回目）: 当初は左クリック/1本指タップだけが停止トリガーだったが、
  // 「右ドラッグや2本指による角度変更、ズーム変更」も停止対象に拡張した。
  // これにより rAF ループとユーザー入力の競合がなくなり、操作の取りこぼしも解消する。
  const stopRotationOnUserInteraction = useCallback((mapInstance: MapboxMap) => {
    if (!isRotatingRef.current && rotationFrameRef.current === null && idleTimerRef.current === null) {
      // 回転していない / 予約もない場合は何もしない（不要な再スケジュールを避ける）
      return
    }
    stopGlobeRotation()
    if (mapInstance.getZoom() <= GLOBE_ROTATION_MAX_ZOOM) {
      scheduleGlobeRotation(mapInstance)
    }
    // Issue#111-followup §8: ユーザー操作完了直後に最新スポットを 1 回 fetch（debounced 500ms）。
    // ズーム/方位リセットの一時停止経路（cancelRotationFrame 単独）では呼ばれないようにこの場所のみ。
    debouncedFetchSpotsRef.current?.(mapInstance)
  }, [stopGlobeRotation, scheduleGlobeRotation])

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

  // Issue#107: 表示言語に追従して地名ラベルを切り替える
  useMapboxLanguageSync(map, mapboxLang)

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

  // Issue#115: マップ bearing 変化を追跡（HeadingIndicator の角度補正用）。
  // headingIndicatorEnabled が false の間は購読しない（不要な再レンダリングを防ぐ）。
  useEffect(() => {
    if (!map || !headingIndicatorEnabled) return
    const handleRotate = () => setMapBearing(map.getBearing())
    // 初期値を反映
    handleRotate()
    map.on('rotate', handleRotate)
    return () => { map.off('rotate', handleRotate) }
  }, [map, headingIndicatorEnabled])

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

      // Issue#115: 旧 requestOrientationPermission 呼出を削除（結果未使用のデッドコードだった）。
      // 方角センサーの許可は useHeadingIndicator のスイッチ ON 時に取得する。

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
              const distance = calculateMapDistance(map.getCenter(), newLocation.lng, newLocation.lat)
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
        // Issue#111-followup Bug1: ズーム下限（DEFAULT_ZOOM=0）にクランプする。
        // easeTo はネイティブ minZoom 制約を無視するため、ボタン経由ではマイナス値にも
        // なれてしまう（ホイールズームは Mapbox 内部でクランプされる）。
        map.easeTo({ zoom: Math.max(DEFAULT_ZOOM, current - 1), duration: 375 })
      }
    },
    resetNorthHeading: () => {
      if (!map) return
      // Issue#111-followup Bug4: 地球儀表示時（ズーム 0〜4）に方位リセットを押した場合、
      // 緯度（lat）も GLOBE_RESET_LAT（北緯10度）に戻す。
      // 写真スポットなど高ズーム時は従来通り bearing/pitch のみリセット。
      //
      // Issue#111-followup（仕様変更5回目）: 回転中の rAF tick による setCenter は
      // easeTo の進行をキャンセルしてしまう（Mapbox 仕様）。緯度差が大きい時に
      // 「方位リセットが効かない」現象を防ぐため、easeTo 中は rAF を一時停止し、
      // moveend で再開する。`+/-` ボタンの zoomstart/zoomend 一時停止と同じパターン。
      const wasRotating = rotationFrameRef.current !== null
      if (wasRotating) {
        cancelAnimationFrame(rotationFrameRef.current!)
        rotationFrameRef.current = null
      }
      if (map.getZoom() <= GLOBE_ROTATION_MAX_ZOOM) {
        const center = map.getCenter()
        map.easeTo({ center: [center.lng, GLOBE_RESET_LAT], bearing: 0, pitch: 0, duration: 500 })
      } else {
        map.easeTo({ bearing: 0, pitch: 0, duration: 500 })
      }
      if (wasRotating) {
        // easeTo 完了（moveend）で回転を再開する。
        // map.once('moveend') は 1回限りで自動解除されるため、後続の通常の moveend には影響しない。
        map.once('moveend', () => {
          if (
            isRotatingRef.current &&
            rotationFrameRef.current === null &&
            map.getZoom() <= GLOBE_ROTATION_MAX_ZOOM
          ) {
            rotationLoop(map)
          }
        })
      }
    },
    showShootingLocationPin: (lat: number, lng: number) => {
      if (!map) return
      savedMapStateRef.current = {
        center: [map.getCenter().lng, map.getCenter().lat],
        zoom: map.getZoom(),
      }
      const distance = calculateMapDistance(map.getCenter(), lng, lat)
      // Issue#116: ズーム差（target=16 との絶対差）も暗転判定の対象にする
      const zoomDiff = Math.abs(map.getZoom() - SHOOTING_PREVIEW_TARGET_ZOOM)
      const padding = { top: TOP_UI_HEIGHT, bottom: 0, left: 0, right: 0 }
      if (
        distance > LONG_DISTANCE_THRESHOLD ||
        zoomDiff >= SHOOTING_PREVIEW_ZOOM_DIFF_THRESHOLD
      ) {
        performWarpAnimation(
          map,
          { center: [lng, lat], zoom: SHOOTING_PREVIEW_TARGET_ZOOM, padding },
          setMapTransitioning,
          setMapTransitionFading,
        )
      } else {
        map.flyTo({ center: [lng, lat], zoom: SHOOTING_PREVIEW_TARGET_ZOOM, speed: 0.8, padding })
      }
      setShootingLocationPin({ lat, lng })
    },
    clearShootingLocationPin: () => {
      if (map && savedMapStateRef.current) {
        const savedZoom = savedMapStateRef.current.zoom
        const savedCenter = savedMapStateRef.current.center
        const distance = calculateMapDistance(map.getCenter(), savedCenter[0], savedCenter[1])
        // Issue#116: 行きと同じ判定基準（距離 OR ズーム差）で戻りも暗転制御する
        const zoomDiff = Math.abs(map.getZoom() - savedZoom)
        const padding = { top: TOP_UI_HEIGHT, bottom: 0, left: 0, right: 0 }
        if (
          distance > LONG_DISTANCE_THRESHOLD ||
          zoomDiff >= SHOOTING_PREVIEW_ZOOM_DIFF_THRESHOLD
        ) {
          performWarpAnimation(
            map,
            { center: savedCenter, zoom: savedZoom, padding },
            setMapTransitioning,
            setMapTransitionFading,
          )
        } else {
          map.flyTo({ center: savedCenter, zoom: savedZoom, speed: 0.8, padding })
        }
        savedMapStateRef.current = null
      }
      setShootingLocationPin(null)
    },
    flyToPlace: (lng: number, lat: number, zoom: number) => {
      if (!map) return
      const distance = calculateMapDistance(map.getCenter(), lng, lat)
      // Issue#116: 飛び先ズームとのズーム差も暗転判定の対象にする
      const zoomDiff = Math.abs(map.getZoom() - zoom)
      const padding = { top: TOP_UI_HEIGHT, bottom: 0, left: 0, right: 0 }

      if (distance > LONG_DISTANCE_THRESHOLD || zoomDiff >= FLYTO_ZOOM_DIFF_THRESHOLD) {
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

      // skipMinView=false の場合（=ポップアップ表示パス）は、getCurrentPosition の前に
      // 確実に zoom 0 へリセットする。位置情報許可ポップアップが表示されている間に
      // 「地球全体（ズーム 0）」を見せるための保険。
      if (!skipMinView) {
        map.jumpTo({ zoom: DEFAULT_ZOOM })
      }

      const warpToLocation = (lng: number, lat: number, zoom: number) => {
        // Issue#111: ワープ開始時に地球儀回転を停止する（idle タイマーも内部で止まる）
        stopGlobeRotation()
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
      clearIdleRotationTimer()
      startGlobeRotation(map)
    },
  }), [map, fetchSpots, stopGlobeRotation, startGlobeRotation, clearIdleRotationTimer, rotationLoop])

  // 地図が読み込まれたときの処理
  const handleLoad = useCallback((e: MapEvent) => {
    const mapInstance = e.target

    // Symbol Layerを初期化
    initializeSymbolLayers(mapInstance)

    // ロード直後に明示的にズーム 0 を強制する。
    // initialViewState だけだとスタイル・projection の初期計算次第で
    // 微妙に異なる camera 位置になることがあるため、保険として固定する。
    mapInstance.setZoom(DEFAULT_ZOOM)

    setMap(mapInstance)

    // Issue#111-followup（仕様変更3回目）: ズーム 0〜4（地球儀表示中）では角度・ピッチ変更ジェスチャーを無効化する。
    // - dragRotate: 右ボタンドラッグでの bearing 変更
    // - touchPitch: 2本指でのピッチ変更（iOS / Android）
    // - touchZoomRotate.disableRotation(): 2本指での回転（ピンチズーム自体は維持）
    // ズーム 5 以上に上がったら再度有効化して、写真スポット閲覧時の操作性を保つ。
    const updateGlobeGestureHandlers = () => {
      const inGlobeView = mapInstance.getZoom() <= GLOBE_ROTATION_MAX_ZOOM
      if (inGlobeView) {
        mapInstance.dragRotate.disable()
        mapInstance.touchPitch.disable()
        mapInstance.touchZoomRotate.disableRotation()
      } else {
        mapInstance.dragRotate.enable()
        mapInstance.touchPitch.enable()
        mapInstance.touchZoomRotate.enableRotation()
      }
    }
    updateGlobeGestureHandlers() // 初期状態を設定
    // zoom イベントは zoom 変化中も連続発火するため、ズームレベル境界をまたいだ瞬間に
    // ジェスチャー有効/無効が切り替わる
    mapInstance.on('zoom', updateGlobeGestureHandlers)

    // Issue#111-followup（仕様変更4回目）: ズームアニメーション中は rAF ループを一時停止する。
    // rAF tick の setCenter が easeTo（+/-ボタンや wheel zoom）の進行をキャンセルしてしまい、
    // ズームインが「ほんの少しずつしか進まない」現象を防ぐため。
    // isRotatingRef は維持し、zoomend で rAF を再開する。
    const cancelRotationFrameForZoom = () => {
      if (rotationFrameRef.current !== null) {
        cancelAnimationFrame(rotationFrameRef.current)
        rotationFrameRef.current = null
      }
    }
    // Issue#111-followup（仕様変更6回目）: wheel イベントを直接 listen して即時 rAF をキャンセルする。
    // scrollZoom が小さな delta を smooth 処理する関係で、zoomstart 発火前に rAF tick の setCenter が
    // 走り、scrollZoom の内部 easeTo を即キャンセルしてしまうケース（特にズーム4境界付近）を防ぐ。
    mapInstance.on('wheel', cancelRotationFrameForZoom)
    mapInstance.on('zoomstart', cancelRotationFrameForZoom)
    mapInstance.on('zoomend', () => {
      // Issue#111-followup（仕様変更6回目）: ズームが回転範囲外（>4）に出た場合、
      // 回転状態フラグをクリアする。rAF tick の auto-stop は rAF が動いている時しか働かないため、
      // 「zoomstart で rAF を止めた直後にズームが 4 を超えた」ケースで isRotatingRef が
      // true のまま残り、handleMoveEnd で fetchSpots がスキップされてピンが表示されない問題を防ぐ。
      if (mapInstance.getZoom() > GLOBE_ROTATION_MAX_ZOOM) {
        isRotatingRef.current = false
        return
      }
      // 回転範囲内なら rAF を再開
      if (isRotatingRef.current && rotationFrameRef.current === null) {
        rotationLoop(mapInstance)
      }
    })

    // Issue#111-followup（仕様変更3回目）: 「タップ/クリック/左ドラッグ」だけで停止する仕様に戻す。
    // ホイールズーム・+/-ボタン・ピンチズームでは回転を継続し、
    // 右ドラッグ・2本指角度操作はそもそも別箇所（updateGestureHandlers）で無効化済み。
    //
    // mousedown: 左ボタン（button=0）のみ対象。中ボタン・右ボタンは対象外。
    //   右ボタンは dragRotate.disable で何も起きないが、念のためフィルタする。
    // touchstart: 1本指のみ対象。2本指（ピンチ）は対象外。
    mapInstance.on('mousedown', (ev: { originalEvent?: MouseEvent }) => {
      if (ev.originalEvent?.button !== 0) return
      stopRotationOnUserInteraction(mapInstance)
    })
    mapInstance.on('touchstart', (ev: { originalEvent?: TouchEvent }) => {
      const touches = ev.originalEvent?.touches
      if (!touches || touches.length !== 1) return
      stopRotationOnUserInteraction(mapInstance)
    })

    // Issue#111: 初期表示はズーム 0（地球全体）のため、5秒経過で地球儀回転を開始するスケジュールを立てる。
    // ただし granted/denied 既知のケースでは autoCenter が即座に warp するため、
    // 回転は始まらない（warp 前にズームが上がる）。
    if (mapInstance.getZoom() <= GLOBE_ROTATION_MAX_ZOOM) {
      scheduleGlobeRotation(mapInstance)
    }

    // Issue#111-followup §8: 全ズームレベルで fetchSpots を許可（Issue#106 のズーム 0 スキップを撤廃）。
    // バックエンドの MAX_SPOTS_LIMIT=50 でレスポンス件数が保護されているため、
    // 世界全体クエリでもペイロードは大きくならない。
    // 巨大クラスタを安全に開く仕組みは Issue#112 のページネーションで担保済み。
    fetchSpots(mapInstance)

    // E2Eテスト用: マップインスタンスをwindowに公開
    ;(globalThis as unknown as Record<string, unknown>).__photlas_map = mapInstance

    onMapReady?.()
  }, [fetchSpots, onMapReady, initializeSymbolLayers, stopRotationOnUserInteraction, scheduleGlobeRotation, rotationLoop])

  // 地図移動完了時のスポット取得（デバウンス: 連続操作を1回のAPI呼び出しにまとめる）
  const debouncedFetchSpots = useDebouncedCallback(
    (mapInstance: MapboxMap) => fetchSpots(mapInstance),
    FETCH_SPOTS_DEBOUNCE_MS
  )
  // Issue#111-followup §8: stopRotationOnUserInteraction から ref 経由で参照するため登録
  debouncedFetchSpotsRef.current = debouncedFetchSpots

  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    const mapInstance = e.target
    const zoom = mapInstance.getZoom()
    // Issue#111-followup（仕様変更6回目）: 回転範囲外に出た時のフェイルセーフ。
    // zoomend が万が一発火しないケースでも、moveend で isRotatingRef をクリアし、
    // fetchSpots が必ず走るようにする。
    if (zoom > GLOBE_ROTATION_MAX_ZOOM && isRotatingRef.current) {
      isRotatingRef.current = false
    }
    // Issue#111-followup: ユーザーが（例えばズームアウトボタンで）ズーム 0〜4 の範囲に入って
    // かつ回転中でも回転予約中でもない場合、5秒後の回転を予約する。
    // movestart リスナーを廃止した影響で、UI ボタン経由のズーム変化では
    // 回転予約のトリガーが失われていた問題（Bug followup）への対策。
    if (
      zoom <= GLOBE_ROTATION_MAX_ZOOM &&
      !isRotatingRef.current &&
      idleTimerRef.current === null
    ) {
      scheduleGlobeRotation(mapInstance)
    }
    // Issue#111-followup §8: ズーム0でも fetchSpots を許可（旧 Issue#106 のスキップ撤廃）。
    // 回転中は moveend が連続で走るためスキップする方は維持。
    if (isRotatingRef.current) return
    debouncedFetchSpots(mapInstance)
  }, [debouncedFetchSpots, scheduleGlobeRotation])

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

  // Issue#111-followup §8: 投稿詳細ダイアログ表示中は地球儀回転と 5 秒タイマーを停止する。
  // ダイアログを閉じた瞬間、ズーム 0〜4 なら 5 秒タイマーを再セットする。
  // 他のダイアログ（FilterPanel, TopMenu 等）は対象外。
  useEffect(() => {
    if (!map) return
    if (isPhotoDialogOpen) {
      // ダイアログ表示中: rAF 一時停止 + idle タイマー停止 + isRotating クリア
      cancelRotationFrame()
      clearIdleRotationTimer()
      isRotatingRef.current = false
    } else {
      // ダイアログ閉鎖: ズーム 0〜4 範囲内なら 5 秒タイマーをセット
      if (map.getZoom() <= GLOBE_ROTATION_MAX_ZOOM) {
        scheduleGlobeRotation(map)
      }
    }
  }, [isPhotoDialogOpen, map, cancelRotationFrame, clearIdleRotationTimer, scheduleGlobeRotation])

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
        // Issue#111-followup Bug1: ズームイン/アウトボタンの下限制約と
        // ホイールズームの下限を一致させる
        minZoom={DEFAULT_ZOOM}
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
              {/* Issue#115: 方角インジケーター（背面に配置、ON 時かつ heading 取得済のみ表示） */}
              {headingIndicatorEnabled && heading !== null && (
                <HeadingIndicator heading={heading} mapBearing={mapBearing} />
              )}
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
