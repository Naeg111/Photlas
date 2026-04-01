import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { X, ChevronLeft, ChevronRight, Star, Camera, Calendar, MapPin, Flag, Trash2, Share2, Pencil, User } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import MapGL from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { PinSvg } from './PinSvg'
import { ProtectedImage } from './figma/ProtectedImage'
import { getAuthHeaders } from '../utils/apiClient'
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

// API Endpoints
const API_SPOTS_PHOTOS = `${API_V1_URL}/spots`
const API_PHOTOS = `${API_V1_URL}/photos`

// Test IDs
const TEST_ID_DIALOG = 'photo-detail-dialog'
const TEST_ID_LOADING = 'loading-spinner'

const TEST_ID_FAVORITE_BUTTON = 'favorite-button'
const TEST_ID_FAVORITE_COUNT = 'favorite-count'

// Labels
const LABEL_CLOSE = '閉じる'
const LABEL_PREV = '前の写真'
const LABEL_NEXT = '次の写真'
const LABEL_ADD_FAVORITE = 'お気に入りに追加'
const LABEL_REMOVE_FAVORITE = 'お気に入りから削除'

// Screen reader text
const SR_TITLE = '写真詳細'
const SR_DESCRIPTION = '写真の詳細情報と撮影コンテクスト'

// Issue#65: 撮影場所の指摘メッセージ
const MSG_LOCATION_SUGGESTION_SUCCESS = '指摘を送信しました'
const MSG_LOCATION_SUGGESTION_ERROR = '指摘の送信に失敗しました'

// Weather labels（DB値は日本語・英語どちらもありうるため両方対応）
const WEATHER_LABELS: Record<string, string> = {
  Sunny: '晴れ',
  Cloudy: '曇り',
  Rain: '雨',
  Snow: '雪',
  sunny: '晴れ',
  cloudy: '曇り',
  rainy: '雨',
  snowy: '雪',
  晴れ: '晴れ',
  曇り: '曇り',
  雨: '雨',
  雪: '雪',
}

// Error messages
const ERROR_LOAD_FAILED = '読み込みに失敗しました'
const ERROR_FETCH_IDS = 'Failed to fetch photo IDs'
const ERROR_FETCH_DETAIL = 'Failed to fetch photo detail'

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
}

// APIレスポンスの型定義
interface PhotoApiResponse {
  photo: {
    photo_id: number
    place_name?: string | null
    image_url: string
    shot_at: string
    weather?: string
    is_favorited?: boolean
    favorite_count?: number
    latitude?: number | null
    longitude?: number | null
    exif?: {
      camera_body?: string
      camera_lens?: string
      focal_length_35mm?: number
      f_value?: string
      shutter_speed?: string
      iso?: number
      image_width?: number
      image_height?: number
    } | null
    crop_center_x?: number | null
    crop_center_y?: number | null
    crop_zoom?: number | null
    moderation_status?: string | null
  }
  spot: {
    spot_id: number
    latitude: number
    longitude: number
  }
  user: {
    user_id: number
    username: string
    profile_image_url?: string | null
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
  imageUrl: string
  shotAt: string
  weather?: string
  isFavorited?: boolean
  favoriteCount?: number
  latitude?: number | null
  longitude?: number | null
  exif?: ExifInfo | null
  cropCenterX?: number | null
  cropCenterY?: number | null
  cropZoom?: number | null
  moderationStatus?: string | null
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

// APIレスポンスを内部形式に変換
function transformApiResponse(response: PhotoApiResponse): PhotoDetail {
  const exifRaw = response.photo.exif
  const exif: ExifInfo | null = exifRaw ? {
    cameraBody: exifRaw.camera_body,
    cameraLens: exifRaw.camera_lens,
    focalLength35mm: exifRaw.focal_length_35mm,
    fValue: exifRaw.f_value,
    shutterSpeed: exifRaw.shutter_speed,
    iso: exifRaw.iso,
    imageWidth: exifRaw.image_width,
    imageHeight: exifRaw.image_height,
  } : null

  return {
    photoId: response.photo.photo_id,
    placeName: response.photo.place_name,
    imageUrl: response.photo.image_url,
    shotAt: response.photo.shot_at,
    weather: response.photo.weather,
    isFavorited: response.photo.is_favorited,
    favoriteCount: response.photo.favorite_count,
    latitude: response.photo.latitude,
    longitude: response.photo.longitude,
    exif,
    cropCenterX: response.photo.crop_center_x,
    cropCenterY: response.photo.crop_center_y,
    cropZoom: response.photo.crop_zoom,
    moderationStatus: response.photo.moderation_status,
    user: {
      userId: response.user.user_id,
      username: response.user.username,
      profileImageUrl: response.user.profile_image_url ?? undefined,
    },
    spot: {
      spotId: response.spot.spot_id,
      latitude: response.spot.latitude,
      longitude: response.spot.longitude,
    },
  }
}

// Helper Functions
async function fetchPhotoIdsForSpot(spotId: number, maxAgeDays?: number): Promise<number[]> {
  const params = new URLSearchParams()
  if (maxAgeDays != null) {
    params.append('max_age_days', maxAgeDays.toString())
  }
  const query = params.toString()
  const url = `${API_SPOTS_PHOTOS}/${spotId}/photos${query ? `?${query}` : ''}`

  const response = await fetch(url, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(ERROR_FETCH_IDS)
  }

  return await response.json()
}

async function fetchPhotoIdsForSpots(spotIds: number[], maxAgeDays?: number): Promise<number[]> {
  const results = await Promise.all(spotIds.map(id => fetchPhotoIdsForSpot(id, maxAgeDays)))
  return results.flat()
}

async function fetchPhotoDetailById(photoId: number): Promise<PhotoDetail> {
  const response = await fetch(`${API_PHOTOS}/${photoId}`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(ERROR_FETCH_DETAIL)
  }

  const data: PhotoApiResponse = await response.json()
  return transformApiResponse(data)
}

/**
 * 撮影地点ミニマップコンポーネント
 * Issue#45: 写真詳細ダイアログ内に撮影地点を表示する静的地図
 */
function DetailMiniMap({
  latitude,
  longitude,
  onClick,
}: Readonly<{
  latitude: number
  longitude: number
  onClick?: () => void
}>) {
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
            language="ja"
            interactive={false}
            attributionControl={false}
          />
          {/* ピンをHTML要素として中央に配置（Mapbox Markerのtransform干渉を回避） */}
          <div
            data-testid="minimap-pin"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -100%)',
              width: '27px',
              height: '43px',
              pointerEvents: 'none',
            }}
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
}

export default function PhotoDetailDialog({ open, spotIds, onClose, onUserClick, onImageClick, isLightboxOpen, onMinimapClick, isSlideDown, isDeletable = false, onPhotoDeleted, singlePhotoId, filterMaxAgeDays }: Readonly<PhotoDetailDialogProps>) {
  const { isAuthenticated, user } = useAuth()
  const [photoIds, setPhotoIds] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [photoDetails, setPhotoDetails] = useState<Map<number, PhotoDetail>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emblaRef, emblaApi] = useEmblaCarousel()

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
  const [editWeather, setEditWeather] = useState('')
  const [editPlaceName, setEditPlaceName] = useState('')
  const [editCategories, setEditCategories] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

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

  // 最後に表示した写真情報を保持（点滅防止）
  const [displayedPhoto, setDisplayedPhoto] = useState<PhotoDetail | null>(null)

  // スポットの写真ID一覧を取得
  useEffect(() => {
    if (!open) {
      setPhotoIds([])
      setPhotoDetails(new Map())
      setCurrentIndex(0)
      setError(null)
      setLoading(true)
      setDisplayedPhoto(null)
      fetchingIdsRef.current.clear()
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Issue#58: 単体写真モード
        if (singlePhotoId) {
          const detail = await fetchPhotoDetailById(singlePhotoId)
          setPhotoIds([singlePhotoId])
          setPhotoDetails(new Map().set(singlePhotoId, detail))
          setDisplayedPhoto(detail)
          setCurrentIndex(0)
          setLoading(false)
          return
        }

        const ids = await fetchPhotoIdsForSpots(spotIds, filterMaxAgeDays)
        setPhotoIds(ids)
        setCurrentIndex(0)

        if (ids.length > 0) {
          const detail = await fetchPhotoDetailById(ids[0])
          setPhotoDetails(new Map().set(ids[0], detail))
          setDisplayedPhoto(detail)
        }

        setLoading(false)
      } catch {
        setError(ERROR_LOAD_FAILED)
        setLoading(false)
      }
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(spotIds), singlePhotoId])

  // 写真詳細を取得（refで依存配列ループを回避、429時にエラー表示しない）
  const fetchPhotoDetail = useCallback(async (photoId: number) => {
    if (photoDetailsRef.current.has(photoId)) return
    if (fetchingIdsRef.current.has(photoId)) return

    fetchingIdsRef.current.add(photoId)

    try {
      const detail = await fetchPhotoDetailById(photoId)
      setPhotoDetails(prev => new Map(prev).set(photoId, detail))
    } catch {
      // 429等のエラーは無視（ダイアログ全体をエラーにしない）
    } finally {
      fetchingIdsRef.current.delete(photoId)
    }
  }, [])

  // カルーセル操作
  const scrollPrev = useCallback(() => {
    if (!emblaApi) return
    emblaApi.scrollPrev()
    const prevIndex = currentIndex - 1
    if (prevIndex >= 0) {
      fetchPhotoDetail(photoIds[prevIndex])
    }
  }, [emblaApi, currentIndex, photoIds, fetchPhotoDetail])

  const scrollNext = useCallback(() => {
    if (!emblaApi) return
    emblaApi.scrollNext()
    const nextIndex = currentIndex + 1
    if (nextIndex < photoIds.length) {
      fetchPhotoDetail(photoIds[nextIndex])
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

  const currentPhotoId = photoIds[currentIndex]
  const currentPhoto = currentPhotoId ? photoDetails.get(currentPhotoId) : null

  // 現在のスライドの写真詳細を取得
  useEffect(() => {
    if (currentPhotoId && !photoDetails.has(currentPhotoId)) {
      fetchPhotoDetail(currentPhotoId)
    }
  }, [currentPhotoId, photoDetails, fetchPhotoDetail])

  // 表示用の写真情報を更新（nullにはしない→点滅防止）
  useEffect(() => {
    if (currentPhoto) {
      setDisplayedPhoto(currentPhoto)
    }
  }, [currentPhoto])

  // Issue#30: お気に入り状態を写真詳細から同期
  useEffect(() => {
    if (currentPhoto) {
      setIsFavorited(currentPhoto.isFavorited ?? false)
      setFavoriteCount(currentPhoto.favoriteCount ?? 0)
    }
  }, [currentPhoto])

  // Issue#65: 指摘済みステータスを取得
  useEffect(() => {
    if (!currentPhotoId || !isAuthenticated) {
      setHasAlreadySuggested(false)
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
          setHasAlreadySuggested(data.hasSuggested === true)
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
      }
    } catch {
      // ネットワークエラー時もリバート
      setIsFavorited(prevFavorited)
      setFavoriteCount(prevCount)
    } finally {
      setIsFavoriteLoading(false)
    }
  }, [currentPhotoId, isFavorited, favoriteCount, isFavoriteLoading])

  // Issue#54: 通報送信処理
  const handleReport = useCallback(async (data: { reason: string; details?: string }) => {
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
        toast.success(MSG_LOCATION_SUGGESTION_SUCCESS)
        setIsLocationSuggestionOpen(false)
      } else if (response.status === 400) {
        const data = await response.json()
        toast.error(data.message || MSG_LOCATION_SUGGESTION_ERROR)
        setIsLocationSuggestionOpen(false)
      } else {
        toast.error(MSG_LOCATION_SUGGESTION_ERROR)
      }
    } catch {
      toast.error(MSG_LOCATION_SUGGESTION_ERROR)
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
        toast.success('写真を削除しました')
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
    setEditWeather(currentPhoto.weather || '')
    setEditPlaceName(currentPhoto.placeName || '')
    setEditCategories([]) // カテゴリは現在APIレスポンスに含まれないため空で初期化
    setIsEditing(true)
  }, [currentPhoto])

  // Issue#61: 編集キャンセル
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setPlaceNameSuggestions([])
    setIsPlaceNameDropdownOpen(false)
  }, [])

  // Issue#61: カテゴリ切替
  const handleEditCategoryToggle = useCallback((category: string) => {
    setEditCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
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
          language: 'ja',
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
          weather: editWeather || null,
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
              weather: data.photo.weather,
              placeName: data.photo.place_name,
              moderationStatus: data.photo.moderation_status,
            })
          }
          return next
        })
        setDisplayedPhoto(prev => prev ? {
          ...prev,
          weather: data.photo.weather,
          placeName: data.photo.place_name,
          moderationStatus: data.photo.moderation_status,
        } : prev)
        setIsEditing(false)
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
    <Dialog open={open} onOpenChange={onClose} modal={isDeletable}>
      <DialogContent
        data-testid={TEST_ID_DIALOG}
        className="max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden border-0"
        style={{
          maxHeight: '90dvh',
          ...(isSlideDown ? {
            top: 'calc(100dvh - 30px)',
            translate: '-50% 0',
          } : {
            translate: '-50% -50%',
          }),
          transition: 'top 0.4s ease-in-out, translate 0.4s ease-in-out',
        }}
        overlayClassName={isSlideDown ? 'bg-transparent pointer-events-none' : isDeletable ? 'bg-transparent' : undefined}
        hideCloseButton
        onPointerDownOutside={(e) => { if (isLightboxOpen || wasSlideDownRef.current) e.preventDefault() }}
        onFocusOutside={(e) => { if (isLightboxOpen || wasSlideDownRef.current) e.preventDefault() }}
        onInteractOutside={(e) => { if (isLightboxOpen || wasSlideDownRef.current) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (isLightboxOpen || wasSlideDownRef.current) e.preventDefault() }}
      >
        <DialogTitle className="sr-only">{SR_TITLE}</DialogTitle>
        <DialogDescription className="sr-only">{SR_DESCRIPTION}</DialogDescription>
        <div className="relative flex flex-col min-h-0 h-full">
          {/* 閉じるボタン */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10"
            onClick={onClose}
            aria-label={LABEL_CLOSE}
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
                    {photoIds.map((photoId) => {
                      const photo = photoDetails.get(photoId)
                      const cx = photo?.cropCenterX ?? 0.5
                      const cy = photo?.cropCenterY ?? 0.5
                      const zoom = photo?.cropZoom ?? 1
                      return (
                        <div key={photoId} className="flex-[0_0_100%] min-w-0 flex items-center justify-center">
                          {photo ? (
                            <div
                              data-testid="photo-crop-container"
                              className="aspect-square w-full overflow-hidden cursor-pointer"
                              onClick={() => onImageClick?.(photo.imageUrl)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  onImageClick?.(photo.imageUrl)
                                }
                              }}
                            >
                              <ProtectedImage
                                src={photo.imageUrl}
                                alt="画像"
                                className="w-full h-full"
                                style={{
                                  objectFit: 'cover',
                                  objectPosition: `${cx * 100}% ${cy * 100}%`,
                                  transform: `scale(${zoom})`,
                                  transformOrigin: `${cx * 100}% ${cy * 100}%`,
                                }}
                              />
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
                        className="absolute left-4 top-1/2 -translate-y-1/2"
                        onClick={scrollPrev}
                        aria-label={LABEL_PREV}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                    )}
                    {currentIndex < photoIds.length - 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                        onClick={scrollNext}
                        aria-label={LABEL_NEXT}
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
                        <label htmlFor="edit-categories" className="text-sm text-gray-500">カテゴリ</label>
                        <div id="edit-categories" className="grid grid-cols-2 gap-2 mt-1">
                          {PHOTO_CATEGORIES.map((category) => (
                            <div
                              key={category}
                              className={`flex items-center space-x-2 border rounded-lg p-2 cursor-pointer transition-colors text-sm ${
                                editCategories.includes(category)
                                  ? 'border-primary bg-primary/5'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") handleEditCategoryToggle(category) }} onClick={() => handleEditCategoryToggle(category)}
                            >
                              <Checkbox
                                checked={editCategories.includes(category)}
                                onCheckedChange={() => handleEditCategoryToggle(category)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={category}
                              />
                              <CategoryIcon category={category} className="w-4 h-4" />
                              <span className="flex-1">{category}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 天気選択 */}
                      <div>
                        <label htmlFor="edit-weather" className="text-sm text-gray-500">天気</label>
                        <select
                          id="edit-weather"
                          data-testid="edit-weather-select"
                          value={editWeather}
                          onChange={(e) => setEditWeather(e.target.value)}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                        >
                          <option value="">未設定</option>
                          <option value="晴れ">晴れ</option>
                          <option value="曇り">曇り</option>
                          <option value="雨">雨</option>
                          <option value="雪">雪</option>
                        </select>
                      </div>

                      {/* 場所名（Mapbox Search Box） */}
                      <div>
                        <label htmlFor="edit-place-name" className="text-sm text-gray-500">場所名</label>
                        <div className="relative">
                          <input
                            id="edit-place-name"
                            data-testid="edit-place-name-input"
                            type="text"
                            value={editPlaceName}
                            onChange={(e) => handleEditPlaceNameSearch(e.target.value)}
                            className="w-full border rounded-md px-3 py-2 text-sm"
                            maxLength={100}
                            placeholder="例：東京タワー、スターバックス渋谷店"
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
                          {isSaving ? '保存中...' : '保存'}
                        </Button>
                        <Button
                          variant="outline"
                          data-testid="edit-cancel-button"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                        >
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Issue#54: モデレーションステータスバナー */}
                  {displayedPhoto.moderationStatus === 'QUARANTINED' && (
                    <div
                      className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"
                      data-testid="quarantined-banner"
                    >
                      この投稿はコンテンツポリシーに違反している可能性があるため、現在非公開です。
                    </div>
                  )}
                  {displayedPhoto.moderationStatus === 'PENDING_REVIEW' && (
                    <div
                      className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700"
                      data-testid="pending-review-banner"
                    >
                      この投稿は審査中です。審査完了後に公開されます。
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
                    {displayedPhoto.weather && (
                      <div className="text-sm text-gray-600">
                        天気: {WEATHER_LABELS[displayedPhoto.weather] ?? displayedPhoto.weather}
                      </div>
                    )}

                  </div>

                  {/* EXIF情報ブロック */}
                  {displayedPhoto.exif && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        撮影情報
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {displayedPhoto.exif.cameraBody && (
                            <div>
                              <span className="text-gray-500">カメラ</span>
                              <p className="font-medium">{displayedPhoto.exif.cameraBody}</p>
                            </div>
                          )}
                          {displayedPhoto.exif.cameraLens && (
                            <div>
                              <span className="text-gray-500">レンズ</span>
                              <p className="font-medium">{displayedPhoto.exif.cameraLens}</p>
                            </div>
                          )}
                          {displayedPhoto.exif.focalLength35mm != null && (
                            <div>
                              <span className="text-gray-500">焦点距離</span>
                              <p className="font-medium">{displayedPhoto.exif.focalLength35mm}mm</p>
                            </div>
                          )}
                          {displayedPhoto.exif.fValue && (
                            <div>
                              <span className="text-gray-500">絞り</span>
                              <p className="font-medium">{displayedPhoto.exif.fValue}</p>
                            </div>
                          )}
                          {displayedPhoto.exif.shutterSpeed && (
                            <div>
                              <span className="text-gray-500">シャッタースピード</span>
                              <p className="font-medium">{displayedPhoto.exif.shutterSpeed}</p>
                            </div>
                          )}
                          {displayedPhoto.exif.iso != null && (
                            <div>
                              <span className="text-gray-500">ISO</span>
                              <p className="font-medium">ISO {displayedPhoto.exif.iso}</p>
                            </div>
                          )}
                          {displayedPhoto.exif.imageWidth != null && displayedPhoto.exif.imageHeight != null && (
                            <div>
                              <span className="text-gray-500">解像度</span>
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

                  {/* 写真枚数インジケーター */}
                  {photoIds.length > 1 && (
                    <p className="text-center text-sm text-gray-500">
                      {currentIndex + 1} / {photoIds.length}
                    </p>
                  )}

                  {/* Issue#30: お気に入りボタン / Issue#54: 通報ボタン */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className={`flex-1 ${
                        isFavorited ? 'bg-yellow-100 border-yellow-400' : ''
                      }`}
                      data-testid={TEST_ID_FAVORITE_BUTTON}
                      onClick={handleToggleFavorite}
                      disabled={isFavoriteLoading || !isAuthenticated}
                      aria-label={isFavorited ? LABEL_REMOVE_FAVORITE : LABEL_ADD_FAVORITE}
                    >
                      <Star
                        className={`w-5 h-5 mr-2 ${
                          isFavorited ? 'fill-yellow-400 text-yellow-400' : ''
                        }`}
                      />
                      お気に入り
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
                        aria-label="この写真を削除"
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
                        aria-label="写真情報を編集"
                      >
                        <Pencil className="w-5 h-5" />
                      </Button>
                    )}
                    {/* 共有ボタン（認証状態に関係なく常に表示） */}
                    <Button
                      variant="outline"
                      data-testid="share-button"
                      onClick={handleShare}
                      aria-label="この写真を共有"
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
                        aria-label="撮影場所の指摘"
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
                        aria-label="この写真を通報"
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
                        <AlertDialogTitle>写真の削除</AlertDialogTitle>
                        <AlertDialogDescription>
                          この写真を削除しますか？この操作は取り消せません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleteLoading}>キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeletePhoto}
                          disabled={isDeleteLoading}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {isDeleteLoading ? '削除中...' : '削除する'}
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
