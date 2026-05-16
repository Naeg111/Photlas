import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { X, ChevronLeft, ChevronRight, Star, Camera, Calendar, MapPin, Flag, Trash2, Share2, Pencil, User } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import MapGL, { Marker } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { PinSvg } from './PinSvg'
import { ProtectedImage } from './figma/ProtectedImage'
import { LqipPlaceholder } from './LqipPlaceholder'
import { getAuthHeaders } from '../utils/apiClient'
import { buildRateLimitApiError, notifyIfRateLimited } from '../utils/notifyIfRateLimited'
import { fetchPhotoTags, type PhotoTagDisplay } from '../utils/tagsApi'
import { API_V1_URL } from '../config/api'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'
import { useAuth } from '../contexts/AuthContext'
import { ReportDialog } from './ReportDialog'
import { LocationSuggestionDialog } from './LocationSuggestionDialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { toast } from 'sonner'
import { SearchBoxCore, SessionToken } from '@mapbox/search-js-core'
import { Checkbox } from './ui/checkbox'
import { CategoryIcon } from './CategoryIcon'
import { PHOTO_CATEGORIES } from '../utils/constants'
import {
  WEATHER_LABELS as CODE_WEATHER_LABELS,
  WEATHER_OPTIONS,
  MODERATION_STATUS_QUARANTINED,
  MODERATION_STATUS_PENDING_REVIEW,
} from '../utils/codeConstants'
import { MAPBOX_LANGUAGE_MAP, type SupportedLanguage } from '../i18n'
import { useSwipeDirectionHistory } from '../hooks/useSwipeDirectionHistory'

// API Endpoints
// Issue#112: スポット写真ID一覧は POST /spots/photos に統一（複数スポット横断 + ページネーション）
const API_SPOTS_PHOTOS_LIST = `${API_V1_URL}/spots/photos`
const API_PHOTOS = `${API_V1_URL}/photos`

// Issue#112: ページネーション設定
const PHOTO_PAGE_SIZE = 30
const PHOTO_PAGE_PRELOAD_THRESHOLD = 5

// Issue#122 / Issue#128: 写真詳細ダイアログの prefetch ロジックは useSwipeDirectionHistory に集約
// 中立時の枚数（左右各 2 枚）と進行方向偏重時の枚数（forward=3 / backward=1）は同 hook の定数を参照

// Issue#122 Cycle2: 写真切り替え時の cross-fade 用 Tailwind v4 クラス
// `key={photoId}` と組み合わせて使うことで、新しい <img> がマウントされた瞬間に
// `@starting-style` 相当の `starting:opacity-0` から `opacity-100` へ滑らかに遷移する
const PHOTO_CROSS_FADE_CLASSES = 'transition-opacity duration-300 opacity-100 starting:opacity-0'

// Test IDs
const TEST_ID_DIALOG = 'photo-detail-dialog'
const TEST_ID_LOADING = 'loading-spinner'

const TEST_ID_FAVORITE_BUTTON = 'favorite-button'
const TEST_ID_FAVORITE_COUNT = 'favorite-count'

// Issue#87: 天気ラベルは codeConstants から取得
const ERROR_FETCH_IDS = 'Failed to fetch photo IDs'
const ERROR_FETCH_DETAIL = 'Failed to fetch photo detail'

// Issue#112: スポット写真IDレスポンスの型
interface SpotPhotosResponse {
  ids: number[]
  total: number
}

interface PhotoDetailDialogProps {
  open: boolean
  spotIds: number[]
  onClose: () => void
  onUserClick?: (user: { userId: number; username: string }) => void
  onImageClick?: (imageUrl: string) => void
  isLightboxOpen?: boolean
  onMinimapClick?: (location: { lat: number; lng: number }) => void
  isSlideDown?: boolean
  /** Issue#57: プロフィール投稿一覧から開いた場合にtrueを渡し、削除ボタンを表示する */
  isDeletable?: boolean
  /** Issue#57: 写真削除後のコールバック */
  onPhotoDeleted?: () => void
  /** Issue#58: 単体写真表示モード（ディープリンク用）。指定時はスポットの写真一覧取得をスキップ */
  singlePhotoId?: number
  /** フィルター条件（スポット写真ID取得時に適用） */
  filterMaxAgeDays?: number
  /**
   * Issue#141 Phase 5 (Q-new-6/7): フィルター条件全部 (subject_categories ～ tag_ids) を /spots/photos に転送。
   * 既存の filterMaxAgeDays とは独立して動く (互換性維持)。
   */
  filterParams?: import('./MapView').MapViewFilterParams
  /**
   * Issue#118: 写真詳細を開いた / 別の写真に切り替えた瞬間に呼ばれる。
   * 未ログインユーザーの登録壁トリガーとして閲覧履歴に photoId を記録するために使用する。
   * ログイン済みユーザーが渡しても安全（呼び出し側が冪等性と未ログイン判定を担当）。
   */
  onPhotoViewed?: (photoId: number) => void
}

// Issue#88: APIレスポンスの型定義（PhotoDetailResponse形式）
interface PhotoApiResponse {
  photoId: number
  imageUrls: {
    thumbnail: string | null
    standard: string
    original: string
    /** Issue#125: LQIP（低品質プレースホルダー）の data URL。モデレーション制限中は null。 */
    lqip?: string | null
  }
  placeName?: string | null
  shotAt: string
  weather?: number | null
  isFavorited?: boolean
  favoriteCount?: number
  latitude?: number | null
  longitude?: number | null
  cameraInfo?: {
    body?: string
    lens?: string
    focalLength35mm?: number
    fValue?: string
    shutterSpeed?: string
    iso?: string
    imageWidth?: number
    imageHeight?: number
  } | null
  cropCenterX?: number | null
  cropCenterY?: number | null
  cropZoom?: number | null
  moderationStatus?: number | null
  categories?: string[]
  user: {
    userId: number
    username: string
    profileImageUrl?: string | null
  }
  spot: {
    spotId: number
    latitude: number
    longitude: number
  }
}

// 内部で使用する型定義
interface ExifInfo {
  cameraBody?: string
  cameraLens?: string
  focalLength35mm?: number
  fValue?: string
  shutterSpeed?: string
  iso?: number
  imageWidth?: number
  imageHeight?: number
}

interface PhotoDetail {
  photoId: number
  placeName?: string | null
  thumbnailUrl: string
  originalUrl: string
  /** Issue#125: LQIP（低品質プレースホルダー）の data URL。本物のサムネが読み込まれるまで blur 表示する。 */
  lqip?: string | null
  shotAt: string
  weather?: number | null
  isFavorited?: boolean
  favoriteCount?: number
  latitude?: number | null
  longitude?: number | null
  exif?: ExifInfo | null
  cropCenterX?: number | null
  cropCenterY?: number | null
  cropZoom?: number | null
  moderationStatus?: number | null
  categories?: string[]
  user: {
    userId: number
    username: string
    profileImageUrl?: string
  }
  spot: {
    spotId: number
    latitude: number
    longitude: number
  }
}

/**
 * 撮影日時をフォーマットする（例: 2026年1月15日 18:30）
 */
function formatShotAt(shotAt: string): string {
  const date = new Date(shotAt)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}年${month}月${day}日 ${hours}:${minutes}`
}

// Mapbox アクセストークン

// Issue#88: APIレスポンスを内部形式に変換（PhotoDetailResponse形式対応）
function transformApiResponse(response: PhotoApiResponse): PhotoDetail {
  const cam = response.cameraInfo
  const exif: ExifInfo | null = cam ? {
    cameraBody: cam.body,
    cameraLens: cam.lens,
    focalLength35mm: cam.focalLength35mm,
    fValue: cam.fValue,
    shutterSpeed: cam.shutterSpeed,
    iso: cam.iso != null ? Number(cam.iso) : undefined,
    imageWidth: cam.imageWidth,
    imageHeight: cam.imageHeight,
  } : null

  // Issue#88: サムネイルフォールバック: thumbnail → standard → original
  const thumbnailUrl = response.imageUrls.thumbnail ?? response.imageUrls.standard ?? response.imageUrls.original
  const originalUrl = response.imageUrls.original ?? response.imageUrls.standard

  return {
    photoId: response.photoId,
    placeName: response.placeName,
    thumbnailUrl,
    originalUrl,
    lqip: response.imageUrls.lqip ?? null,
    shotAt: response.shotAt,
    weather: response.weather,
    isFavorited: response.isFavorited,
    favoriteCount: response.favoriteCount,
    latitude: response.latitude,
    longitude: response.longitude,
    exif,
    cropCenterX: response.cropCenterX,
    cropCenterY: response.cropCenterY,
    cropZoom: response.cropZoom,
    moderationStatus: response.moderationStatus,
    categories: response.categories,
    user: {
      userId: response.user.userId,
      username: response.user.username,
      profileImageUrl: response.user.profileImageUrl ?? undefined,
    },
    spot: {
      spotId: response.spot.spotId,
      latitude: response.spot.latitude,
      longitude: response.spot.longitude,
    },
  }
}

// Helper Functions
/**
 * Issue#112: スポット写真ID一覧を1ページ取得する。
 * 複数スポットを横断して撮影日時降順でマージしたページが返る。
 */
async function fetchPhotoIdsPage(
  spotIds: number[],
  limit: number,
  offset: number,
  maxAgeDays?: number,
  filterParams?: import('./MapView').MapViewFilterParams,
): Promise<SpotPhotosResponse> {
  const body: Record<string, unknown> = {
    spotIds,
    limit,
    offset,
  }
  if (maxAgeDays != null) {
    body.maxAgeDays = maxAgeDays
  }
  // Issue#141 Phase 5 (Q-new-6/7): 全フィルタを Body に詰めて転送
  if (filterParams) {
    if (filterParams.subject_categories?.length) body.subjectCategories = filterParams.subject_categories
    if (filterParams.months?.length) body.months = filterParams.months
    if (filterParams.times_of_day?.length) body.timesOfDay = filterParams.times_of_day
    if (filterParams.weathers?.length) body.weathers = filterParams.weathers
    if (filterParams.device_types?.length) body.deviceTypes = filterParams.device_types
    if (filterParams.aspect_ratios?.length) body.aspectRatios = filterParams.aspect_ratios
    if (filterParams.focal_length_ranges?.length) body.focalLengthRanges = filterParams.focal_length_ranges
    if (filterParams.max_iso != null) body.maxIso = filterParams.max_iso
    if (filterParams.tag_ids?.length) body.tagIds = filterParams.tag_ids
  }

  const response = await fetch(API_SPOTS_PHOTOS_LIST, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw buildRateLimitApiError(response, ERROR_FETCH_IDS)
    }
    throw new Error(ERROR_FETCH_IDS)
  }

  return await response.json()
}

async function fetchPhotoDetailById(photoId: number): Promise<PhotoDetail> {
  const response = await fetch(`${API_PHOTOS}/${photoId}`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw buildRateLimitApiError(response, ERROR_FETCH_DETAIL)
    }
    throw new Error(ERROR_FETCH_DETAIL)
  }

  const data: PhotoApiResponse = await response.json()
  return transformApiResponse(data)
}

/**
 * Issue#122 Cycle3: 複数の photoId をまとめて取得するバッチエンドポイントを呼ぶ。
 * 認可されていない写真はサーバ側で silent skip され、認可された写真だけが返る
 * （順序は保証されないので呼び出し側で photoId を見て対応付ける）。
 */
async function fetchPhotoDetailsBatchApi(photoIds: number[]): Promise<PhotoDetail[]> {
  const response = await fetch(`${API_PHOTOS}/batch`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ photoIds }),
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw buildRateLimitApiError(response, ERROR_FETCH_DETAIL)
    }
    throw new Error(ERROR_FETCH_DETAIL)
  }

  const data: PhotoApiResponse[] = await response.json()
  return data.map(transformApiResponse)
}

/**
 * Issue#122: thumbnail 画像をブラウザキャッシュへ先読みする。
 * `new Image()` で Image オブジェクトを生成し src を代入することで、
 * 実際に <img> 要素が DOM にマウントされる前にネットワークフェッチを開始させ、
 * スライド切り替え時の表示遅延を解消する。url が空の場合は何もしない。
 */
function preloadThumbnail(thumbnailUrl: string | null | undefined): void {
  if (!thumbnailUrl) return
  const img = new Image()
  img.src = thumbnailUrl
}

/**
 * 撮影地点ミニマップコンポーネント
 * Issue#45: 写真詳細ダイアログ内に撮影地点を表示する静的地図
 */
const DetailMiniMap = React.memo(function DetailMiniMap({
  latitude,
  longitude,
  onClick,
}: Readonly<{
  latitude: number
  longitude: number
  onClick?: () => void
}>) {
  const { i18n } = useTranslation()
  const mapboxLang = MAPBOX_LANGUAGE_MAP[i18n.language as SupportedLanguage] || 'en'
  const [isAttributionOpen, setIsAttributionOpen] = useState(false)

  // ダイアログの開閉アニメーション完了を待ってからMapGLを描画する。
  // singlePhotoIdモード（ディープリンク）ではデータ取得が速く、
  // アニメーション中にMapGLが初期化されるとMarkerの位置計算が失敗する。
  const [isMapReady, setIsMapReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setIsMapReady(true), 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      data-testid="detail-minimap"
      className={`relative w-full h-[200px] rounded-lg overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onClick?.() }} onClick={onClick}
    >
      {isMapReady ? (
        <>
          <MapGL
            key={`${latitude}-${longitude}`}
            mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
            initialViewState={{
              longitude: longitude,
              latitude: latitude,
              zoom: 15,
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={MAPBOX_STYLE}
            language={mapboxLang}
            interactive={false}
            attributionControl={false}
          >
            {/* Mapbox Markerで正確な座標にピンを配置（CSS配置はズームレベルでずれる） */}
            <Marker longitude={longitude} latitude={latitude} anchor="bottom">
              <div
                data-testid="minimap-pin"
                style={{ width: '27px', height: '30px', pointerEvents: 'none' }}
              >
                <PinSvg
                  fill="#ffffff"
                  stroke="#000000"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  shapeRendering="geometricPrecision"
                >
                  <circle cx="16" cy="14" r="6" fill="#000000" stroke="#000000" strokeWidth="1" />
                </PinSvg>
              </div>
            </Marker>
          </MapGL>
          {/* Mapboxロゴ（左下） */}
          <div style={{ position: 'absolute', bottom: 4, left: 4, pointerEvents: 'auto', zIndex: 1 }}>
            <a href="https://www.mapbox.com/" target="_blank" rel="noopener noreferrer" aria-label="Mapbox ホームページ">
              <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" fillRule="evenodd" viewBox="0 0 88 23" width="88" height="23">
                <defs>
                  <path id="dm-logo-icon" d="M11.5 2.25c5.105 0 9.25 4.145 9.25 9.25s-4.145 9.25-9.25 9.25-9.25-4.145-9.25-9.25 4.145-9.25 9.25-9.25zM6.997 15.983c-.051-.338-.828-5.802 2.233-8.873a4.395 4.395 0 013.13-1.28c1.27 0 2.49.51 3.39 1.42.91.9 1.42 2.12 1.42 3.39 0 1.18-.449 2.301-1.28 3.13C12.72 16.93 7 16 7 16l-.003-.017zM15.3 10.5l-2 .8-.8 2-.8-2-2-.8 2-.8.8-2 .8 2 2 .8z" />
                  <path id="dm-logo-text" d="M50.63 8c.13 0 .23.1.23.23V9c.7-.76 1.7-1.18 2.73-1.18 2.17 0 3.95 1.85 3.95 4.17s-1.77 4.19-3.94 4.19c-1.04 0-2.03-.43-2.74-1.18v3.77c0 .13-.1.23-.23.23h-1.4c-.13 0-.23-.1-.23-.23V8.23c0-.12.1-.23.23-.23h1.4zm-3.86.01c.01 0 .01 0 .01-.01.13 0 .22.1.22.22v7.55c0 .12-.1.23-.23.23h-1.4c-.13 0-.23-.1-.23-.23V15c-.7.76-1.69 1.19-2.73 1.19-2.17 0-3.94-1.87-3.94-4.19 0-2.32 1.77-4.19 3.94-4.19 1.03 0 2.02.43 2.73 1.18v-.75c0-.12.1-.23.23-.23h1.4zm26.375-.19a4.24 4.24 0 00-4.16 3.29c-.13.59-.13 1.19 0 1.77a4.233 4.233 0 004.17 3.3c2.35 0 4.26-1.87 4.26-4.19 0-2.32-1.9-4.17-4.27-4.17zM60.63 5c.13 0 .23.1.23.23v3.76c.7-.76 1.7-1.18 2.73-1.18 1.88 0 3.45 1.4 3.84 3.28.13.59.13 1.2 0 1.8-.39 1.88-1.96 3.29-3.84 3.29-1.03 0-2.02-.43-2.73-1.18v.77c0 .12-.1.23-.23.23h-1.4c-.13 0-.23-.1-.23-.23V5.23c0-.12.1-.23.23-.23h1.4zm-34 11h-1.4c-.13 0-.23-.11-.23-.23V8.22c.01-.13.1-.22.23-.22h1.4c.13 0 .22.11.23.22v.68c.5-.68 1.3-1.09 2.16-1.1h.03c1.09 0 2.09.6 2.6 1.55.45-.95 1.4-1.55 2.44-1.56 1.62 0 2.93 1.25 2.9 2.78l.03 5.2c0 .13-.1.23-.23.23h-1.41c-.13 0-.23-.11-.23-.23v-4.59c0-.98-.74-1.71-1.62-1.71-.8 0-1.46.7-1.59 1.62l.01 4.68c0 .13-.11.23-.23.23h-1.41c-.13 0-.23-.11-.23-.23v-4.59c0-.98-.74-1.71-1.62-1.71-.85 0-1.54.79-1.6 1.8v4.5c0 .13-.1.23-.23.23zm53.615 0h-1.61c-.04 0-.08-.01-.12-.03-.09-.06-.13-.19-.06-.28l2.43-3.71-2.39-3.65a.213.213 0 01-.03-.12c0-.12.09-.21.21-.21h1.61c.13 0 .24.06.3.17l1.41 2.37 1.4-2.37a.34.34 0 01.3-.17h1.6c.04 0 .08.01.12.03.09.06.13.19.06.28l-2.37 3.65 2.43 3.7c0 .05.01.09.01.13 0 .12-.09.21-.21.21h-1.61c-.13 0-.24-.06-.3-.17l-1.44-2.42-1.44 2.42a.34.34 0 01-.3.17zm-7.12-1.49c-1.33 0-2.42-1.12-2.42-2.51 0-1.39 1.08-2.52 2.42-2.52 1.33 0 2.42 1.12 2.42 2.51 0 1.39-1.08 2.51-2.42 2.52zm-19.865 0c-1.32 0-2.39-1.11-2.42-2.48v-.07c.02-1.38 1.09-2.49 2.4-2.49 1.32 0 2.41 1.12 2.41 2.51 0 1.39-1.07 2.52-2.39 2.53zm-8.11-2.48c-.01 1.37-1.09 2.47-2.41 2.47s-2.42-1.12-2.42-2.51c0-1.39 1.08-2.52 2.4-2.52 1.33 0 2.39 1.11 2.41 2.48l.02.08zm18.12 2.47c-1.32 0-2.39-1.11-2.41-2.48v-.06c.02-1.38 1.09-2.48 2.41-2.48s2.42 1.12 2.42 2.51c0 1.39-1.09 2.51-2.42 2.51z" />
                </defs>
                <mask id="dm-logo-clip"><rect x="0" y="0" width="100%" height="100%" fill="white" /><use xlinkHref="#dm-logo-icon" /><use xlinkHref="#dm-logo-text" /></mask>
                <g opacity="0.3" stroke="#000" strokeWidth="3"><circle mask="url(#dm-logo-clip)" cx="11.5" cy="11.5" r="9.25" /><use xlinkHref="#dm-logo-text" mask="url(#dm-logo-clip)" /></g>
                <g opacity="0.9" fill="#fff"><use xlinkHref="#dm-logo-icon" /><use xlinkHref="#dm-logo-text" /></g>
              </svg>
            </a>
          </div>
          {/* 帰属情報（右下） */}
          <div style={{ position: 'absolute', bottom: 4, right: 4, pointerEvents: 'auto', zIndex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            {isAttributionOpen && (
              <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 4, padding: '2px 6px', fontSize: 10, whiteSpace: 'nowrap' }}>
                <a href="https://www.mapbox.com/about/maps" target="_blank" rel="noopener noreferrer" style={{ color: '#333', textDecoration: 'none' }}>© Mapbox</a>
                {' '}
                <a href="https://www.openstreetmap.org/copyright/" target="_blank" rel="noopener noreferrer" style={{ color: '#333', textDecoration: 'none' }}>© OpenStreetMap</a>
              </div>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsAttributionOpen(prev => !prev) }}
              aria-label="帰属情報"
              style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
            >
              <svg viewBox="0 0 20 20" width="20" height="20" fill="black" fillRule="evenodd">
                <path d="M4 10a6 6 0 1 0 12 0 6 6 0 1 0-12 0m5-3a1 1 0 1 0 2 0 1 1 0 1 0-2 0m0 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0" />
              </svg>
            </button>
          </div>
        </>
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
    </div>
  )
})

export default function PhotoDetailDialog({ open, spotIds, onClose, onUserClick, onImageClick, isLightboxOpen, onMinimapClick, isSlideDown, isDeletable = false, onPhotoDeleted, singlePhotoId, filterMaxAgeDays, filterParams, onPhotoViewed }: Readonly<PhotoDetailDialogProps>) {
  const { t, i18n } = useTranslation()
  const mapboxLang = MAPBOX_LANGUAGE_MAP[i18n.language as SupportedLanguage] || 'en'
  const { isAuthenticated, user } = useAuth()
  const [photoIds, setPhotoIds] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [photoDetails, setPhotoDetails] = useState<Map<number, PhotoDetail>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emblaRef, emblaApi] = useEmblaCarousel()

  // Issue#112: ページネーション用 state
  const [totalPhotoCount, setTotalPhotoCount] = useState(0)
  const isFetchingNextPageRef = useRef(false)

  // Issue#50: isSlideDownのref版（Radix flushSync対策）
  // Radix DismissableLayerのdispatchDiscreteCustomEventはflushSyncでstate更新を強制コミットするため、
  // モバイルタッチ時にisSlideDown propがfalseになった状態でイベントハンドラが評価される。
  // このrefはuseEffectでのみ更新されるため、flushSyncの影響を受けず、
  // プレビュー復帰時の全イベント（pointer-down-outside, focus-outside等）を確実にブロックする。
  const wasSlideDownRef = useRef(false)
  useEffect(() => {
    if (isSlideDown) {
      wasSlideDownRef.current = true
    } else if (wasSlideDownRef.current) {
      const timer = setTimeout(() => {
        wasSlideDownRef.current = false
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isSlideDown])

  // Issue#30: お気に入り状態管理
  const [isFavorited, setIsFavorited] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)

  // Issue#135: 写真ごとのキーワード（ミニマップと件数表示の間に表示）
  // useEffect 本体は displayedPhoto の宣言後に置く（前方参照エラー回避のため）
  const [photoTags, setPhotoTags] = useState<PhotoTagDisplay[]>([])

  // Issue#54: 通報状態管理
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isReportLoading, setIsReportLoading] = useState(false)

  // Issue#65: 撮影場所の指摘状態管理
  const [isLocationSuggestionOpen, setIsLocationSuggestionOpen] = useState(false)
  const [hasAlreadySuggested, setHasAlreadySuggested] = useState(false)

  // Issue#57: 写真削除状態管理
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleteLoading, setIsDeleteLoading] = useState(false)

  // Issue#61: 写真メタデータ編集状態管理
  const [isEditing, setIsEditing] = useState(false)
  const [editWeather, setEditWeather] = useState<number | ''>('')
  const [editPlaceName, setEditPlaceName] = useState('')
  const [editCategories, setEditCategories] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // スクロール時の選択取り消し機構（モバイルタッチ対応）
  const lastEditToggleRef = useRef<(() => void) | null>(null)
  const handleEditScrollDuringToggle = useCallback(() => {
    if (lastEditToggleRef.current) {
      lastEditToggleRef.current()
      lastEditToggleRef.current = null
    }
  }, [])
  const handleEditPointerUp = useCallback(() => {
    lastEditToggleRef.current = null
  }, [])

  // Issue#61: Mapbox Search Box（場所名検索）
  const [placeNameSuggestions, setPlaceNameSuggestions] = useState<{ name: string; full_address?: string; mapbox_id: string }[]>([])
  const [isPlaceNameDropdownOpen, setIsPlaceNameDropdownOpen] = useState(false)
  const placeNameSearchBox = useMemo(() => {
    if (MAPBOX_ACCESS_TOKEN) {
      return new SearchBoxCore({ accessToken: MAPBOX_ACCESS_TOKEN })
    }
    return null
  }, [])
  const placeNameSessionTokenRef = useRef(new SessionToken())
  const placeNameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // refで最新のphotoDetailsを参照（依存配列ループ回避）
  const photoDetailsRef = useRef(photoDetails)
  photoDetailsRef.current = photoDetails

  // 取得中のphotoIdを追跡（重複リクエスト防止）
  const fetchingIdsRef = useRef(new Set<number>())

  // 指摘ステータスのキャッシュ（#8: 同じ写真に戻った時の再API呼び出し防止）
  const suggestionCacheRef = useRef(new Map<number, boolean>())

  // 最後に表示した写真情報を保持（点滅防止）
  const [displayedPhoto, setDisplayedPhoto] = useState<PhotoDetail | null>(null)

  // Issue#135: 表示写真が変わるたびにキーワードを再フェッチ
  useEffect(() => {
    if (!displayedPhoto?.photoId) {
      setPhotoTags([])
      return
    }
    const controller = new AbortController()
    fetchPhotoTags(displayedPhoto.photoId, i18n.language, { signal: controller.signal })
      .then((res) => setPhotoTags(Array.isArray(res?.tags) ? res.tags : []))
      .catch(() => {
        setPhotoTags([])
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedPhoto?.photoId, i18n.language])

  // スポットの写真ID一覧を取得（Issue#112: ページネーション対応）
  useEffect(() => {
    if (!open) {
      setPhotoIds([])
      setPhotoDetails(new Map())
      setCurrentIndex(0)
      setError(null)
      setLoading(true)
      setDisplayedPhoto(null)
      setTotalPhotoCount(0)
      isFetchingNextPageRef.current = false
      fetchingIdsRef.current.clear()
      suggestionCacheRef.current.clear()
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Issue#58: 単体写真モード（Issue#112 ではページネーション対象外）
        if (singlePhotoId) {
          const detail = await fetchPhotoDetailById(singlePhotoId)
          setPhotoIds([singlePhotoId])
          setTotalPhotoCount(1)
          setPhotoDetails(new Map().set(singlePhotoId, detail))
          setDisplayedPhoto(detail)
          setCurrentIndex(0)
          preloadThumbnail(detail.thumbnailUrl)
          setLoading(false)
          return
        }

        // Issue#112: 1ページ目（30件）を取得
        const page = await fetchPhotoIdsPage(spotIds, PHOTO_PAGE_SIZE, 0, filterMaxAgeDays, filterParams)
        setPhotoIds(page.ids)
        setTotalPhotoCount(page.total)
        setCurrentIndex(0)

        if (page.ids.length > 0) {
          const detail = await fetchPhotoDetailById(page.ids[0])
          setPhotoDetails(new Map().set(page.ids[0], detail))
          setDisplayedPhoto(detail)
          preloadThumbnail(detail.thumbnailUrl)
        }

        setLoading(false)
      } catch {
        setError(t('photo.loadFailed'))
        setLoading(false)
      }
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(spotIds), singlePhotoId])

  // 写真詳細を取得（refで依存配列ループを回避、429時はトーストのみ表示してエラー表示しない）
  const fetchPhotoDetail = useCallback(async (photoId: number) => {
    if (photoDetailsRef.current.has(photoId)) return
    if (fetchingIdsRef.current.has(photoId)) return

    fetchingIdsRef.current.add(photoId)

    try {
      const detail = await fetchPhotoDetailById(photoId)
      setPhotoDetails(prev => new Map(prev).set(photoId, detail))
      // Issue#122: 取得直後に thumbnail をブラウザキャッシュへ先読みする。
      // useEffect 側で post-hoc に preload しようとすると、fetch が非同期のため
      // 最初の通過では photoDetailsRef がまだ空で空振りする。fetch 成功時に
      // 必ずキャッシュ投入することで、後続のスライド切り替え時の即時表示を保証する。
      preloadThumbnail(detail.thumbnailUrl)
    } catch (e) {
      // 429 のみトースト通知。それ以外のエラーは無視（ダイアログ全体をエラーにしない）
      notifyIfRateLimited(e, t)
    } finally {
      fetchingIdsRef.current.delete(photoId)
    }
  }, [t])

  // Issue#122 Cycle3: prefetch をバッチエンドポイントで集約する
  // 既にキャッシュ済み・取得中の photoId は除外してリクエストを最小化する
  const fetchPhotoDetailsBatch = useCallback(async (photoIds: number[]) => {
    if (photoIds.length === 0) return
    const idsToFetch = photoIds.filter(id =>
      !photoDetailsRef.current.has(id) && !fetchingIdsRef.current.has(id)
    )
    if (idsToFetch.length === 0) return

    idsToFetch.forEach(id => fetchingIdsRef.current.add(id))
    try {
      const details = await fetchPhotoDetailsBatchApi(idsToFetch)
      setPhotoDetails(prev => {
        const next = new Map(prev)
        details.forEach(d => next.set(d.photoId, d))
        return next
      })
      details.forEach(d => preloadThumbnail(d.thumbnailUrl))
    } catch (e) {
      notifyIfRateLimited(e, t)
    } finally {
      idsToFetch.forEach(id => fetchingIdsRef.current.delete(id))
    }
  }, [t])

  // カルーセル操作
  // Issue#128: ボタンクリック経路でも currentIndex を即時更新する。
  // Embla の select イベントは jsdom で発火しないケースがあるため、
  // emblaApi.scrollPrev/scrollNext と setCurrentIndex を併用する。
  // ドラッグスワイプ時は onSelect 経由で setCurrentIndex が同じ値で再呼び出しされるが、
  // React の state 更新は同値の場合 no-op なので問題ない。
  const scrollPrev = useCallback(() => {
    if (!emblaApi) return
    emblaApi.scrollPrev()
    const prevIndex = currentIndex - 1
    if (prevIndex >= 0) {
      fetchPhotoDetail(photoIds[prevIndex])
      setCurrentIndex(prevIndex)
    }
  }, [emblaApi, currentIndex, photoIds, fetchPhotoDetail])

  const scrollNext = useCallback(() => {
    if (!emblaApi) return
    emblaApi.scrollNext()
    const nextIndex = currentIndex + 1
    if (nextIndex < photoIds.length) {
      fetchPhotoDetail(photoIds[nextIndex])
      setCurrentIndex(nextIndex)
    }
  }, [emblaApi, currentIndex, photoIds, fetchPhotoDetail])

  // カルーセルのスライド切り替え時にインデックスを更新し、写真詳細を取得
  useEffect(() => {
    if (!emblaApi) return

    const onSelect = () => {
      const selectedIndex = emblaApi.selectedScrollSnap()
      setCurrentIndex(selectedIndex)
    }

    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi])

  // Issue#128: スワイプ方向に応じた非対称 prefetch
  // currentIndex 変化を監視して履歴を管理し、現在の進行方向に応じた forward / backward の枚数を返す
  const { forwardCount, backwardCount } = useSwipeDirectionHistory(currentIndex)

  const currentPhotoId = photoIds[currentIndex]
  const currentPhoto = currentPhotoId ? photoDetails.get(currentPhotoId) : null

  // 現在のスライドの写真詳細を取得 + 前後 PHOTO_PREFETCH_RADIUS 枚をプリフェッチ
  // photoDetailsをrefで参照し、依存配列ループを防止（#7）
  // Issue#122: thumbnail 画像のブラウザキャッシュ先読みは fetchPhotoDetail 内に移動
  // Issue#122 Cycle3: prefetch はバッチエンドポイントで 1 リクエストに集約
  useEffect(() => {
    if (currentPhotoId && !photoDetailsRef.current.has(currentPhotoId)) {
      fetchPhotoDetail(currentPhotoId)
    }
    // Issue#118: 現在の写真IDを登録壁カウントへ通知（重複は呼び出し側で吸収される）
    // Issue#122: prefetch 対象には呼ばない（実際に閲覧した写真のみ通知）
    if (currentPhotoId) {
      onPhotoViewed?.(currentPhotoId)
    }
    // Issue#122 Cycle3: 前後 PHOTO_PREFETCH_RADIUS 枚をバッチエンドポイントでまとめて取得
    // Issue#128: 履歴の方向偏重に応じて forward / backward の枚数を非対称化（useSwipeDirectionHistory 経由）
    const idsToPrefetch: number[] = []
    for (let offset = 1; offset <= forwardCount; offset++) {
      const id = photoIds[currentIndex + offset]
      if (id) idsToPrefetch.push(id)
    }
    for (let offset = 1; offset <= backwardCount; offset++) {
      const id = photoIds[currentIndex - offset]
      if (id) idsToPrefetch.push(id)
    }
    if (idsToPrefetch.length > 0) {
      fetchPhotoDetailsBatch(idsToPrefetch)
    }
  }, [currentPhotoId, currentIndex, photoIds, fetchPhotoDetail, fetchPhotoDetailsBatch, onPhotoViewed, forwardCount, backwardCount])

  // Issue#112: 末尾 PHOTO_PAGE_PRELOAD_THRESHOLD 枚以内に近づいたら次ページを裏で取得
  useEffect(() => {
    if (singlePhotoId) return // 単体写真モードは対象外
    if (photoIds.length === 0) return
    if (photoIds.length >= totalPhotoCount) return // 全件取得済み
    if (isFetchingNextPageRef.current) return // 取得中は重複呼び出しを抑制

    const remaining = photoIds.length - currentIndex - 1
    if (remaining > PHOTO_PAGE_PRELOAD_THRESHOLD) return

    isFetchingNextPageRef.current = true
    const offset = photoIds.length
    fetchPhotoIdsPage(spotIds, PHOTO_PAGE_SIZE, offset, filterMaxAgeDays, filterParams)
      .then((page) => {
        // ダイアログが閉じている、または前提が変わった場合は捨てる
        setPhotoIds((prev) => {
          // 既に追加済みなら何もしない（StrictMode 二重呼び出し対策）
          if (prev.length !== offset) return prev
          return [...prev, ...page.ids]
        })
        // total はサーバーが返した最新値で更新（条件適用後の総件数）
        setTotalPhotoCount(page.total)
      })
      .catch(() => {
        toast.error(t('photo.loadMoreFailed'))
      })
      .finally(() => {
        isFetchingNextPageRef.current = false
      })
  }, [currentIndex, photoIds, totalPhotoCount, spotIds, filterMaxAgeDays, filterParams, singlePhotoId, t])

  // 表示用の写真情報を更新 + お気に入り状態を同期（1つのuseEffectで再レンダリング削減: #9）
  useEffect(() => {
    if (currentPhoto) {
      setDisplayedPhoto(currentPhoto)
      setIsFavorited(currentPhoto.isFavorited ?? false)
      setFavoriteCount(currentPhoto.favoriteCount ?? 0)
    }
  }, [currentPhoto])

  // Issue#65: 指摘済みステータスを取得（キャッシュ付き: #8）
  useEffect(() => {
    if (!currentPhotoId || !isAuthenticated) {
      setHasAlreadySuggested(false)
      return
    }
    // キャッシュにあればAPIを呼ばない
    if (suggestionCacheRef.current.has(currentPhotoId)) {
      setHasAlreadySuggested(suggestionCacheRef.current.get(currentPhotoId)!)
      return
    }
    const checkSuggestionStatus = async () => {
      try {
        const response = await fetch(
          `${API_PHOTOS}/${currentPhotoId}/location-suggestions/status`,
          { headers: getAuthHeaders() }
        )
        if (response.ok) {
          const data = await response.json()
          const hasSuggested = data.hasSuggested === true
          suggestionCacheRef.current.set(currentPhotoId, hasSuggested)
          setHasAlreadySuggested(hasSuggested)
        }
      } catch {
        // エラー時はデフォルト（非表示にしない）
      }
    }
    checkSuggestionStatus()
  }, [currentPhotoId, isAuthenticated])

  // Issue#30: お気に入りトグル処理（エラー時リバート）
  const handleToggleFavorite = useCallback(async () => {
    if (!currentPhotoId || isFavoriteLoading) return

    setIsFavoriteLoading(true)

    // 楽観的UI更新前に現在の状態を保存
    const prevFavorited = isFavorited
    const prevCount = favoriteCount

    // 楽観的UI更新
    setIsFavorited(!isFavorited)
    setFavoriteCount(isFavorited ? favoriteCount - 1 : favoriteCount + 1)

    try {
      const method = prevFavorited ? 'DELETE' : 'POST'
      const response = await fetch(
        `${API_PHOTOS}/${currentPhotoId}/favorite`,
        {
          method,
          headers: getAuthHeaders(),
        }
      )

      if (!response.ok) {
        // APIエラー時はリバート
        setIsFavorited(prevFavorited)
        setFavoriteCount(prevCount)
        if (response.status === 429) {
          notifyIfRateLimited(buildRateLimitApiError(response), t)
        }
      }
    } catch {
      // ネットワークエラー時もリバート
      setIsFavorited(prevFavorited)
      setFavoriteCount(prevCount)
    } finally {
      setIsFavoriteLoading(false)
    }
  }, [currentPhotoId, isFavorited, favoriteCount, isFavoriteLoading, t])

  // Issue#54: 通報送信処理
  const handleReport = useCallback(async (data: { reason: number; details?: string }) => {
    if (!currentPhotoId) return

    setIsReportLoading(true)
    try {
      const response = await fetch(`${API_PHOTOS}/${currentPhotoId}/report`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: data.reason,
          details: data.details,
        }),
      })

      if (response.ok) {
        toast.success('通報を受け付けました')
        setIsReportOpen(false)
      } else if (response.status === 409) {
        setIsReportOpen(false)
      } else if (response.status === 400) {
        setIsReportOpen(false)
      } else {
        toast.error('通報に失敗しました')
      }
    } catch {
      toast.error('通報に失敗しました')
    } finally {
      setIsReportLoading(false)
    }
  }, [currentPhotoId])

  // Issue#65: 撮影場所の指摘送信処理
  const handleLocationSuggestion = useCallback(async (latitude: number, longitude: number) => {
    if (!currentPhotoId) return

    try {
      const response = await fetch(`${API_PHOTOS}/${currentPhotoId}/location-suggestions`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitude, longitude }),
      })

      if (response.ok) {
        toast.success(t('photo.suggestionSent'))
        setIsLocationSuggestionOpen(false)
      } else if (response.status === 400) {
        const data = await response.json()
        toast.error(data.message || t('photo.suggestionFailed'))
        setIsLocationSuggestionOpen(false)
      } else {
        toast.error(t('photo.suggestionFailed'))
      }
    } catch {
      toast.error(t('photo.suggestionFailed'))
    }
  }, [currentPhotoId])

  // Issue#57: 写真削除処理
  const handleDeletePhoto = useCallback(async () => {
    if (!currentPhotoId) return

    setIsDeleteLoading(true)
    try {
      const response = await fetch(`${API_PHOTOS}/${currentPhotoId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (response.ok) {
        toast.success(t('photo.deleteSuccess'))
        setIsDeleteDialogOpen(false)
        onPhotoDeleted?.()
        onClose()
      } else {
        toast.error('写真の削除に失敗しました')
      }
    } catch {
      toast.error('写真の削除に失敗しました')
    } finally {
      setIsDeleteLoading(false)
    }
  }, [currentPhotoId, onClose, onPhotoDeleted])

  // Issue#58: 共有処理
  const handleShare = useCallback(async () => {
    if (!currentPhotoId) return

    const shareUrl = `${globalThis.location.origin}/photo-viewer/${currentPhotoId}`

    try {
      if (navigator.share) {
        await navigator.share({ title: currentPhoto?.placeName || 'Photlas', url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
      }
    } catch (error) {
      // ユーザーが共有シートをキャンセルした場合（AbortError）は無視
      if (error instanceof Error && error.name === 'AbortError') return
      toast.error('共有に失敗しました')
    }
  }, [currentPhotoId, currentPhoto?.placeName])

  // Issue#61: 編集モード開始
  const handleStartEdit = useCallback(() => {
    if (!currentPhoto) return
    setEditWeather(currentPhoto.weather ?? '')
    setEditPlaceName(currentPhoto.placeName || '')
    setEditCategories(currentPhoto.categories || [])
    setIsEditing(true)
  }, [currentPhoto])

  // Issue#61: 編集キャンセル
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setPlaceNameSuggestions([])
    setIsPlaceNameDropdownOpen(false)
  }, [])

  // Issue#61: カテゴリ切替（最低1つ必須、スクロール取り消し対応）
  const handleEditCategoryToggle = useCallback((category: string) => {
    setEditCategories(prev => {
      const next = prev.includes(category)
        ? prev.length > 1 ? prev.filter(c => c !== category) : prev
        : [...prev, category]
      // スクロール取り消し用に逆操作を記録
      lastEditToggleRef.current = () => setEditCategories(prev)
      return next
    })
  }, [])

  // Issue#61: 場所名検索（Mapbox Search Box）
  const handleEditPlaceNameSearch = useCallback((value: string) => {
    setEditPlaceName(value)

    if (placeNameDebounceRef.current) {
      clearTimeout(placeNameDebounceRef.current)
    }

    if (!value.trim() || !placeNameSearchBox) {
      setPlaceNameSuggestions([])
      setIsPlaceNameDropdownOpen(false)
      return
    }

    placeNameDebounceRef.current = setTimeout(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const options: any = {
          sessionToken: placeNameSessionTokenRef.current,
          language: mapboxLang,
          types: 'poi',
        }

        const result = await placeNameSearchBox.suggest(value, options)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = (result.suggestions || []) as any[]
        setPlaceNameSuggestions(items)
        setIsPlaceNameDropdownOpen(items.length > 0)
      } catch {
        setPlaceNameSuggestions([])
        setIsPlaceNameDropdownOpen(false)
      }
    }, 300)
  }, [placeNameSearchBox])

  // Issue#61: 場所名候補選択
  const handleSelectPlaceNameSuggestion = useCallback((suggestion: { name: string }) => {
    setEditPlaceName(suggestion.name)
    setPlaceNameSuggestions([])
    setIsPlaceNameDropdownOpen(false)
    placeNameSessionTokenRef.current = new SessionToken()
  }, [])

  // Issue#61: 保存前チェック
  const handleSaveClick = useCallback(() => {
    if (!currentPhoto) return
    handleSaveEdit()
  }, [currentPhoto])

  // Issue#61: 編集保存
  const handleSaveEdit = useCallback(async () => {
    if (!currentPhotoId) return

    setIsSaving(true)
    try {
      const response = await fetch(`${API_PHOTOS}/${currentPhotoId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          weather: editWeather !== '' ? editWeather : null,
          placeName: editPlaceName || null,
          categories: editCategories.length > 0 ? editCategories : null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setPhotoDetails(prev => {
          const next = new Map(prev)
          const existing = next.get(currentPhotoId)
          if (existing) {
            next.set(currentPhotoId, {
              ...existing,
              weather: data.weather,
              placeName: data.placeName,
              moderationStatus: data.moderationStatus,
            })
          }
          return next
        })
        setDisplayedPhoto(prev => prev ? {
          ...prev,
          weather: data.weather,
          placeName: data.placeName,
          moderationStatus: data.moderationStatus,
        } : prev)
        setIsEditing(false)
        toast.success('保存しました')
      } else {
        toast.error('更新に失敗しました')
      }
    } catch {
      toast.error('更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }, [currentPhotoId, editWeather, editPlaceName, editCategories])

  return (
    <Dialog open={open} onOpenChange={onClose} modal={false}>
      <DialogContent
        data-testid={TEST_ID_DIALOG}
        className="max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden border-0"
        style={{
          maxHeight: '90dvh',
          pointerEvents: 'auto',
          ...(isSlideDown ? {
            top: 'calc(100dvh - 30px)',
            translate: '-50% 0',
          } : {
            translate: '-50% -50%',
          }),
          transition: 'top 0.4s ease-in-out, translate 0.4s ease-in-out',
        }}
        overlayClassName={isSlideDown ? 'bg-transparent pointer-events-none' : undefined}
        hideCloseButton
        onPointerDownOutside={(e) => { if (isLightboxOpen || wasSlideDownRef.current) e.preventDefault() }}
        onFocusOutside={(e) => { if (isLightboxOpen || wasSlideDownRef.current) e.preventDefault() }}
        onInteractOutside={(e) => { if (isLightboxOpen || wasSlideDownRef.current) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (isLightboxOpen || wasSlideDownRef.current) e.preventDefault() }}
      >
        <DialogTitle className="sr-only">{t('photo.detailTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('photo.detailDescription')}</DialogDescription>
        <div className="relative flex flex-col min-h-0 h-full">
          {/* 閉じるボタン */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 bg-gray-500/40 hover:bg-gray-500/60"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </Button>

          {loading && (
            <div className="flex items-center justify-center min-h-[40vh]" data-testid={TEST_ID_LOADING}>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-96">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && photoIds.length > 0 && (
            <div className="flex flex-col min-h-0 flex-1">
              {/* カルーセル - Issue#49: 正方形表示エリア */}
              <div className="relative flex-shrink-0 max-h-[60vh] overflow-hidden flex items-center" style={{ maxHeight: '60dvh' }}>
                <div className="overflow-hidden w-full" ref={emblaRef}>
                  <div className="flex items-center">
                    {photoIds.map((photoId, index) => {
                      // 仮想化: 現在の前後1枚のみ画像コンテンツをレンダリング
                      const isNearCurrent = Math.abs(index - currentIndex) <= 1
                      const photo = isNearCurrent ? photoDetails.get(photoId) : null
                      return (
                        <div key={photoId} className="flex-[0_0_100%] min-w-0 flex items-center justify-center">
                          {photo ? (
                            <div
                              data-testid="photo-crop-container"
                              className="aspect-square w-full overflow-hidden cursor-pointer"
                              onClick={() => onImageClick?.(photo.originalUrl)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  onImageClick?.(photo.originalUrl)
                                }
                              }}
                            >
                              {/* Issue#131: サムネイル自体がユーザー指定範囲で生成されるため、
                                  以前 objectPosition / transform: scale でクロップを再現していた
                                  ロジックは撤去。サムネイルをそのまま正方形枠に表示する。 */}
                              {/* Issue#122 Cycle2: key={photoId} で写真切り替え時に再マウントを発生させ、
                                  PHOTO_CROSS_FADE_CLASSES でフェードインさせる。 */}
                              {/* Issue#125: LQIP を本物の下に絶対配置（LqipPlaceholder が
                                  src 未設定時の null フォールバックも兼ねる） */}
                              <div className="relative w-full h-full">
                                <LqipPlaceholder src={photo.lqip} />
                                <ProtectedImage
                                  key={photo.photoId}
                                  src={photo.thumbnailUrl}
                                  alt="画像"
                                  loading="eager"
                                  className={`relative w-full h-full object-cover ${PHOTO_CROSS_FADE_CLASSES}`}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center aspect-square w-full">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ナビゲーションボタン */}
                {photoIds.length > 1 && (
                  <>
                    {currentIndex > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-gray-500/40 hover:bg-gray-500/60"
                        onClick={scrollPrev}
                        aria-label={t('photo.prevPhoto')}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                    )}
                    {currentIndex < photoIds.length - 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-gray-500/40 hover:bg-gray-500/60"
                        onClick={scrollNext}
                        aria-label={t('photo.nextPhoto')}
                      >
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* 写真情報（displayedPhotoで表示し、スライド切替時の点滅を防止） */}
              {displayedPhoto && (
                <div className="min-h-0 px-6 pt-[26px] pb-8 space-y-4 overflow-y-auto">
                  {/* 編集ボタンはアクションバーに移動 */}

                  {/* Issue#61: 編集モード */}
                  {isEditing && (
                    <div className="space-y-3">
                      {/* カテゴリ選択 */}
                      <div>
                        <label htmlFor="edit-categories" className="text-sm text-gray-500">{t('photo.categoryRequired')}</label>
                        <div id="edit-categories" className="grid grid-cols-2 gap-2 mt-1" onScroll={handleEditScrollDuringToggle} onTouchMove={handleEditScrollDuringToggle} onPointerUp={handleEditPointerUp}>
                          {PHOTO_CATEGORIES.map((category) => (
                            <div
                              key={category}
                              className={`flex items-center space-x-2 border rounded-lg p-2 cursor-pointer transition-colors touch-manipulation select-none text-sm ${
                                editCategories.includes(category)
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") handleEditCategoryToggle(category) }} onPointerDown={(e) => { e.preventDefault(); handleEditCategoryToggle(category) }}
                            >
                              <Checkbox
                                checked={editCategories.includes(category)}
                                aria-label={category}
                                tabIndex={-1}
                                style={{ pointerEvents: 'none' }}
                              />
                              <CategoryIcon category={category} className="w-4 h-4" />
                              <span className="flex-1">{category}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 天気選択 */}
                      <div>
                        <label htmlFor="edit-weather" className="text-sm text-gray-500">{t('photo.weatherLabel')}</label>
                        <select
                          id="edit-weather"
                          data-testid="edit-weather-select"
                          value={editWeather}
                          onChange={(e) => setEditWeather(e.target.value ? Number(e.target.value) : '')}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                        >
                          <option value="">未設定</option>
                          {WEATHER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* 場所名（Mapbox Search Box） */}
                      <div>
                        <label htmlFor="edit-place-name" className="text-sm text-gray-500">{t('photo.locationName')}</label>
                        <div className="relative">
                          <input
                            id="edit-place-name"
                            data-testid="edit-place-name-input"
                            type="text"
                            value={editPlaceName}
                            onChange={(e) => handleEditPlaceNameSearch(e.target.value)}
                            className="w-full border rounded-md px-3 py-2 text-sm"
                            maxLength={100}
                            placeholder={t('photo.locationNamePlaceholder')}
                          />
                          {isPlaceNameDropdownOpen && placeNameSuggestions.length > 0 && (
                            <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {placeNameSuggestions.map((suggestion) => (
                                <li
                                  key={suggestion.mapbox_id}
                                  onMouseDown={(e) => e.preventDefault()}
                                  role="option" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") handleSelectPlaceNameSuggestion(suggestion) }} onClick={() => handleSelectPlaceNameSuggestion(suggestion)}
                                  className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="font-medium">{suggestion.name}</div>
                                  {suggestion.full_address && (
                                    <div className="text-xs text-gray-500">{suggestion.full_address}</div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      {/* 保存・キャンセル */}
                      <div className="flex gap-2">
                        <Button
                          data-testid="edit-save-button"
                          onClick={handleSaveClick}
                          disabled={isSaving}
                          className="flex-1"
                        >
                          {t('common.save')}
                        </Button>
                        <Button
                          variant="outline"
                          data-testid="edit-cancel-button"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Issue#54: モデレーションステータスバナー */}
                  {displayedPhoto.moderationStatus === MODERATION_STATUS_QUARANTINED && (
                    <div
                      className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"
                      data-testid="quarantined-banner"
                    >
                      {t('photo.quarantined')}
                    </div>
                  )}
                  {displayedPhoto.moderationStatus === MODERATION_STATUS_PENDING_REVIEW && (
                    <div
                      className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700"
                      data-testid="pending-review-banner"
                    >
                      {t('photo.pendingReview')}
                    </div>
                  )}

                  {/* ユーザー情報 */}
                  <div
                    className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => onUserClick?.({
                      userId: displayedPhoto.user.userId,
                      username: displayedPhoto.user.username,
                    })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onUserClick?.({
                          userId: displayedPhoto.user.userId,
                          username: displayedPhoto.user.username,
                        })
                      }
                    }}
                  >
                    {displayedPhoto.user.profileImageUrl ? (
                      <img
                        src={displayedPhoto.user.profileImageUrl}
                        alt={displayedPhoto.user.username}
                        loading="lazy"
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <span className="font-medium">{displayedPhoto.user.username}</span>
                  </div>

                  {/* 撮影コンテクスト情報 */}
                  <div className="space-y-2">
                    {/* 撮影日時 */}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{formatShotAt(displayedPhoto.shotAt)}</span>
                    </div>

                    {/* 施設名・店名 */}
                    {displayedPhoto.placeName && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>{displayedPhoto.placeName}</span>
                      </div>
                    )}

                    {/* 天気情報 */}
                    {displayedPhoto.weather != null && (
                      <div className="text-sm text-gray-600">
                        {t('photo.weatherLabel')}: {CODE_WEATHER_LABELS[displayedPhoto.weather] ?? displayedPhoto.weather}
                      </div>
                    )}

                  </div>

                  {/* EXIF情報ブロック */}
                  {displayedPhoto.exif && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        {t('photo.shootingInfo')}
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {displayedPhoto.exif.cameraBody && (
                            <div>
                              <span className="text-gray-500">{t('photo.camera')}</span>
                              <p className="font-medium">{displayedPhoto.exif.cameraBody}</p>
                            </div>
                          )}
                          {displayedPhoto.exif.cameraLens && (
                            <div>
                              <span className="text-gray-500">{t('photo.lens')}</span>
                              <p className="font-medium">{displayedPhoto.exif.cameraLens}</p>
                            </div>
                          )}
                          {displayedPhoto.exif.focalLength35mm != null && (
                            <div>
                              <span className="text-gray-500">{t('photo.focalLength')}</span>
                              <p className="font-medium">{displayedPhoto.exif.focalLength35mm}mm</p>
                            </div>
                          )}
                          {displayedPhoto.exif.fValue && (
                            <div>
                              <span className="text-gray-500">{t('photo.aperture')}</span>
                              <p className="font-medium">{displayedPhoto.exif.fValue}</p>
                            </div>
                          )}
                          {displayedPhoto.exif.shutterSpeed && (
                            <div>
                              <span className="text-gray-500">{t('photo.shutterSpeed')}</span>
                              <p className="font-medium">{displayedPhoto.exif.shutterSpeed}</p>
                            </div>
                          )}
                          {displayedPhoto.exif.iso != null && (
                            <div>
                              <span className="text-gray-500">{t('photo.iso')}</span>
                              <p className="font-medium">ISO {displayedPhoto.exif.iso}</p>
                            </div>
                          )}
                          {displayedPhoto.exif.imageWidth != null && displayedPhoto.exif.imageHeight != null && (
                            <div>
                              <span className="text-gray-500">{t('photo.resolution')}</span>
                              <p className="font-medium">{displayedPhoto.exif.imageWidth} x {displayedPhoto.exif.imageHeight}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ミニマップ */}
                  <DetailMiniMap
                    latitude={displayedPhoto.latitude ?? displayedPhoto.spot.latitude}
                    longitude={displayedPhoto.longitude ?? displayedPhoto.spot.longitude}
                    onClick={onMinimapClick ? () => onMinimapClick({
                      lat: displayedPhoto.latitude ?? displayedPhoto.spot.latitude,
                      lng: displayedPhoto.longitude ?? displayedPhoto.spot.longitude,
                    }) : undefined}
                  />

                  {/* Issue#135: キーワードチップ（ランディングページへ遷移、SEO 内部リンク） */}
                  {photoTags.length > 0 && (
                    <div data-testid="photo-detail-tags" className="flex flex-wrap gap-2 pt-2">
                      {photoTags.map((tag) => (
                        <a
                          key={tag.tagId}
                          href={`/tags/${tag.slug}?lang=${encodeURIComponent(i18n.language)}`}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs border border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100"
                        >
                          {tag.displayName}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* 写真枚数インジケーター（Issue#112: total を使用） */}
                  {totalPhotoCount > 1 && (
                    <p className="text-center text-sm text-gray-500">
                      {currentIndex + 1} / {totalPhotoCount}
                    </p>
                  )}

                  {/* Issue#30: お気に入りボタン / Issue#54: 通報ボタン */}
                  {/* Issue#131: ボタンが画面横幅を超える場合は折り返す（横スクロール抑止） */}
                  <div className="flex flex-wrap gap-2 pt-4">
                    <Button
                      variant="outline"
                      className={`flex-1 ${
                        isFavorited ? 'bg-yellow-100 border-yellow-400' : ''
                      }`}
                      data-testid={TEST_ID_FAVORITE_BUTTON}
                      onClick={handleToggleFavorite}
                      disabled={isFavoriteLoading || !isAuthenticated}
                      aria-label={isFavorited ? t('photo.removeFavorite') : t('photo.addFavorite')}
                    >
                      <Star
                        className={`w-5 h-5 mr-2 ${
                          isFavorited ? 'fill-yellow-400 text-yellow-400' : ''
                        }`}
                      />
                      {t('photo.favorite')}
                      <span
                        data-testid={TEST_ID_FAVORITE_COUNT}
                        className="ml-1 text-sm text-gray-500"
                      >
                        ({favoriteCount})
                      </span>
                    </Button>
                    {/* 削除ボタン（投稿者本人のみ） */}
                    {isAuthenticated && isDeletable && currentPhoto?.user?.userId === user?.userId && (
                      <Button
                        variant="outline"
                        data-testid="delete-photo-button"
                        onClick={() => setIsDeleteDialogOpen(true)}
                        className="text-red-500 border-red-300 hover:bg-red-50"
                        aria-label={t('photo.deletePhoto')}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                    {/* 編集ボタン（投稿者本人かつプロフィールから開いた場合のみ、編集中は非表示） */}
                    {isAuthenticated && isDeletable && currentPhoto?.user?.userId === user?.userId && !isEditing && (
                      <Button
                        variant="outline"
                        data-testid="edit-photo-button"
                        onClick={handleStartEdit}
                        aria-label={t('photo.editPhoto')}
                      >
                        <Pencil className="w-5 h-5" />
                      </Button>
                    )}
                    {/* 共有ボタン（認証状態に関係なく常に表示） */}
                    <Button
                      variant="outline"
                      data-testid="share-button"
                      onClick={handleShare}
                      aria-label={t('photo.sharePhoto')}
                    >
                      <Share2 className="w-5 h-5" />
                    </Button>
                    {/* Issue#78: 撮影場所の指摘ボタン（投稿者本人は非活性） */}
                    {isAuthenticated && !hasAlreadySuggested && (
                      <Button
                        variant="outline"
                        data-testid="location-suggestion-button"
                        onClick={() => setIsLocationSuggestionOpen(true)}
                        disabled={currentPhoto?.user?.userId === user?.userId}
                        aria-label={t('location.suggestLocation')}
                      >
                        <MapPin className="w-5 h-5" />
                      </Button>
                    )}
                    {/* Issue#78: 通報ボタン（投稿者本人は非活性） */}
                    {isAuthenticated && (
                      <Button
                        variant="outline"
                        data-testid="report-button"
                        onClick={() => setIsReportOpen(true)}
                        disabled={currentPhoto?.user?.userId === user?.userId}
                        aria-label={t('report.title')}
                      >
                        <Flag className="w-5 h-5" />
                      </Button>
                    )}
                  </div>

                  {/* Issue#54: 通報ダイアログ */}
                  <ReportDialog
                    open={isReportOpen}
                    onOpenChange={setIsReportOpen}
                    onSubmit={handleReport}
                    isLoading={isReportLoading}
                  />

                  {/* Issue#65: 撮影場所の指摘ダイアログ */}
                  {currentPhoto && (
                    <LocationSuggestionDialog
                      open={isLocationSuggestionOpen}
                      onOpenChange={setIsLocationSuggestionOpen}
                      photoId={currentPhoto.photoId}
                      currentLatitude={currentPhoto.spot.latitude}
                      currentLongitude={currentPhoto.spot.longitude}
                      onSubmit={handleLocationSuggestion}
                    />
                  )}

                  {/* Issue#57: 写真削除確認ダイアログ */}
                  <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('photo.deletePhoto')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('photo.deleteConfirm')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleteLoading}>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeletePhoto}
                          disabled={isDeleteLoading}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {isDeleteLoading ? t('settings.deleting') : t('settings.deleteAction')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
