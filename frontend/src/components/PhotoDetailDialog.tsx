import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { X, ChevronLeft, ChevronRight, Star, Camera, Calendar, MapPin, Flag, Trash2, Share2, Pencil } from 'lucide-react'
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
const TEST_ID_DOT_PREFIX = 'dot-indicator-'
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
const MSG_LOCATION_SUGGESTION_SUCCESS = '撮影場所の指摘を送信しました'
const MSG_LOCATION_SUGGESTION_ERROR = '撮影場所の指摘に失敗しました'

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
}

// APIレスポンスの型定義
interface PhotoApiResponse {
  photo: {
    photo_id: number
    title: string
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
  title: string
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
    title: response.photo.title,
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
    },
    spot: {
      spotId: response.spot.spot_id,
      latitude: response.spot.latitude,
      longitude: response.spot.longitude,
    },
  }
}

// Helper Functions
async function fetchPhotoIdsForSpot(spotId: number): Promise<number[]> {
  const response = await fetch(`${API_SPOTS_PHOTOS}/${spotId}/photos`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(ERROR_FETCH_IDS)
  }

  return await response.json()
}

async function fetchPhotoIdsForSpots(spotIds: number[]): Promise<number[]> {
  const results = await Promise.all(spotIds.map(id => fetchPhotoIdsForSpot(id)))
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
}: {
  latitude: number
  longitude: number
  onClick?: () => void
}) {
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
      onClick={onClick}
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
        </>
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
    </div>
  )
}

export default function PhotoDetailDialog({ open, spotIds, onClose, onUserClick, onImageClick, isLightboxOpen, onMinimapClick, isSlideDown, isDeletable = false, onPhotoDeleted, singlePhotoId }: PhotoDetailDialogProps) {
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
  const [editTitle, setEditTitle] = useState('')
  const [editWeather, setEditWeather] = useState('')
  const [editPlaceName, setEditPlaceName] = useState('')
  const [editCategories, setEditCategories] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isTitleChangeWarningOpen, setIsTitleChangeWarningOpen] = useState(false)

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

        const ids = await fetchPhotoIdsForSpots(spotIds)
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
        toast.error('この写真は既に通報済みです')
        setIsReportOpen(false)
      } else if (response.status === 400) {
        toast.error('自分の写真は通報できません')
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

    const shareUrl = `${window.location.origin}/photo-viewer/${currentPhotoId}`

    try {
      if (navigator.share) {
        await navigator.share({ title: currentPhoto?.title || 'Photlas', url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('URLをコピーしました')
      }
    } catch (error) {
      // ユーザーが共有シートをキャンセルした場合（AbortError）は無視
      if (error instanceof Error && error.name === 'AbortError') return
      toast.error('共有に失敗しました')
    }
  }, [currentPhotoId, currentPhoto?.title])

  // Issue#61: 編集モード開始
  const handleStartEdit = useCallback(() => {
    if (!currentPhoto) return
    setEditTitle(currentPhoto.title || '')
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

  // Issue#61: 保存前チェック（タイトル変更時は警告表示）
  const handleSaveClick = useCallback(() => {
    if (!currentPhoto) return
    const isTitleChanged = editTitle !== (currentPhoto.title || '')
    if (isTitleChanged && currentPhoto.moderationStatus === 'PUBLISHED') {
      setIsTitleChangeWarningOpen(true)
    } else {
      handleSaveEdit()
    }
  }, [currentPhoto, editTitle])

  // Issue#61: 編集保存
  const handleSaveEdit = useCallback(async () => {
    if (!currentPhotoId) return

    setIsTitleChangeWarningOpen(false)
    setIsSaving(true)
    try {
      const response = await fetch(`${API_PHOTOS}/${currentPhotoId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editTitle,
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
              title: data.photo.title,
              weather: data.photo.weather,
              placeName: data.photo.place_name,
              moderationStatus: data.photo.moderation_status,
            })
          }
          return next
        })
        setDisplayedPhoto(prev => prev ? {
          ...prev,
          title: data.photo.title,
          weather: data.photo.weather,
          placeName: data.photo.place_name,
          moderationStatus: data.photo.moderation_status,
        } : prev)
        toast.success('写真情報を更新しました')
        setIsEditing(false)
      } else {
        toast.error('更新に失敗しました')
      }
    } catch {
      toast.error('更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }, [currentPhotoId, editTitle, editWeather, editPlaceName, editCategories])

  return (
    <Dialog open={open} onOpenChange={onClose} modal={false}>
      <DialogContent
        data-testid={TEST_ID_DIALOG}
        className="max-w-4xl max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden border-0"
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
        overlayClassName={isSlideDown ? 'bg-transparent pointer-events-none' : undefined}
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
                                alt={photo.title}
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
                <div className="min-h-0 p-6 pb-8 space-y-4 overflow-y-auto">
                  {/* Issue#61: タイトル（表示/編集モード切替） */}
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input
                        data-testid="edit-title-input"
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-2xl font-bold min-h-[2rem] flex-1 border-b-2 border-primary outline-none bg-transparent"
                        maxLength={20}
                      />
                    ) : (
                      <h2 className="text-2xl font-bold min-h-[2rem] flex-1">{displayedPhoto.title}</h2>
                    )}
                    {isAuthenticated && currentPhoto?.user?.userId === user?.userId && !isEditing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid="edit-photo-button"
                        onClick={handleStartEdit}
                        aria-label="写真情報を編集"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Issue#61: 編集モード */}
                  {isEditing && (
                    <div className="space-y-3">
                      {/* カテゴリ選択 */}
                      <div>
                        <label className="text-sm text-gray-500">カテゴリ</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {PHOTO_CATEGORIES.map((category) => (
                            <div
                              key={category}
                              className={`flex items-center space-x-2 border rounded-lg p-2 cursor-pointer transition-colors text-sm ${
                                editCategories.includes(category)
                                  ? 'border-primary bg-primary/5'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              onClick={() => handleEditCategoryToggle(category)}
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
                        <label className="text-sm text-gray-500">天気</label>
                        <select
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
                        <label className="text-sm text-gray-500">場所名</label>
                        <div className="relative">
                          <input
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
                                  onClick={() => handleSelectPlaceNameSuggestion(suggestion)}
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

                  {/* Issue#61: タイトル変更時の再モデレーション警告ダイアログ */}
                  <AlertDialog open={isTitleChangeWarningOpen} onOpenChange={setIsTitleChangeWarningOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>タイトルの変更</AlertDialogTitle>
                        <AlertDialogDescription>
                          タイトルを変更すると再審査が行われ、審査完了まで写真が非公開になります。保存しますか？
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSaveEdit}>
                          保存する
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

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
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium">
                      {displayedPhoto.user.username.charAt(0).toUpperCase()}
                    </div>
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
                    {isAuthenticated && !isDeletable && (
                      <Button
                        variant="outline"
                        data-testid="report-button"
                        onClick={() => setIsReportOpen(true)}
                        aria-label="この写真を通報"
                      >
                        <Flag className="w-5 h-5" />
                      </Button>
                    )}
                    {/* Issue#65: 撮影場所の指摘ボタン（ログイン済み・他人の写真・未指摘のみ） */}
                    {isAuthenticated && !isDeletable && !hasAlreadySuggested && (
                      <Button
                        variant="outline"
                        data-testid="location-suggestion-button"
                        onClick={() => setIsLocationSuggestionOpen(true)}
                        aria-label="撮影場所の指摘"
                      >
                        <MapPin className="w-5 h-5" />
                      </Button>
                    )}
                    {/* Issue#58: 共有ボタン（認証状態に関係なく常に表示） */}
                    <Button
                      variant="outline"
                      data-testid="share-button"
                      onClick={handleShare}
                      aria-label="この写真を共有"
                    >
                      <Share2 className="w-5 h-5" />
                    </Button>
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
