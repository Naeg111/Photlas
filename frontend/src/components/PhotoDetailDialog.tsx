import { useEffect, useState, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { X, ChevronLeft, ChevronRight, Star, Camera, Compass, Tag, Calendar } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import MapGL, { Marker } from 'react-map-gl'
import type { MapEvent } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { PinSvg } from './PinSvg'
import { ShootingDirectionArrow } from './ShootingDirectionArrow'
import { getAuthHeaders } from '../utils/apiClient'
import { API_V1_URL } from '../config/api'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'
import { useAuth } from '../contexts/AuthContext'

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
  onMinimapClick?: (location: { lat: number; lng: number; shootingDirection?: number | null }) => void
  isSlideDown?: boolean
}

// APIレスポンスの型定義
interface PhotoApiResponse {
  photo: {
    photo_id: number
    title: string
    image_url: string
    shot_at: string
    weather?: string
    is_favorited?: boolean
    favorite_count?: number
    shooting_direction?: number | null
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
    tags?: { tag_id: number; name: string }[]
    crop_center_x?: number | null
    crop_center_y?: number | null
    crop_zoom?: number | null
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

interface TagInfo {
  tagId: number
  name: string
}

interface PhotoDetail {
  photoId: number
  title: string
  imageUrl: string
  shotAt: string
  weather?: string
  isFavorited?: boolean
  favoriteCount?: number
  shootingDirection?: number | null
  latitude?: number | null
  longitude?: number | null
  exif?: ExifInfo | null
  tags: TagInfo[]
  cropCenterX?: number | null
  cropCenterY?: number | null
  cropZoom?: number | null
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
 * 角度を8方位の日本語に変換する
 */
function directionToLabel(deg: number): string {
  const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西']
  const index = Math.round(deg / 45) % 8
  return directions[index]
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
    imageUrl: response.photo.image_url,
    shotAt: response.photo.shot_at,
    weather: response.photo.weather,
    isFavorited: response.photo.is_favorited,
    favoriteCount: response.photo.favorite_count,
    shootingDirection: response.photo.shooting_direction,
    latitude: response.photo.latitude,
    longitude: response.photo.longitude,
    exif,
    cropCenterX: response.photo.crop_center_x,
    cropCenterY: response.photo.crop_center_y,
    cropZoom: response.photo.crop_zoom,
    tags: (response.photo.tags ?? []).map(t => ({ tagId: t.tag_id, name: t.name })),
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
  shootingDirection,
  onClick,
}: {
  latitude: number
  longitude: number
  shootingDirection?: number | null
  onClick?: () => void
}) {
  return (
    <div
      data-testid="detail-minimap"
      className={`w-full h-[200px] rounded-lg overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <MapGL
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{
          longitude: longitude,
          latitude: latitude,
          zoom: 15,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAPBOX_STYLE}
        interactive={false}
        onLoad={(e: MapEvent) => e.target.setLanguage('ja')}
      >
        <Marker longitude={longitude} latitude={latitude} anchor="bottom">
          <div
            style={{
              width: '27px',
              height: '43px',
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
        </Marker>
        {shootingDirection != null && (
          <Marker longitude={longitude} latitude={latitude} anchor="center">
            <div style={{ pointerEvents: 'none' }}>
              <ShootingDirectionArrow direction={shootingDirection} />
            </div>
          </Marker>
        )}
      </MapGL>
      {shootingDirection != null && <div data-testid="minimap-direction-arrow" className="hidden" />}
    </div>
  )
}

export default function PhotoDetailDialog({ open, spotIds, onClose, onUserClick, onImageClick, isLightboxOpen, onMinimapClick, isSlideDown }: PhotoDetailDialogProps) {
  const { isAuthenticated } = useAuth()
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
  }, [open, JSON.stringify(spotIds)])

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
                              <img
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
                  <h2 className="text-2xl font-bold min-h-[2rem]">{displayedPhoto.title}</h2>

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

                    {/* 天気情報 */}
                    {displayedPhoto.weather && (
                      <div className="text-sm text-gray-600">
                        天気: {WEATHER_LABELS[displayedPhoto.weather] ?? displayedPhoto.weather}
                      </div>
                    )}

                    {/* 撮影方向 */}
                    {displayedPhoto.shootingDirection != null && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Compass className="w-4 h-4" />
                        <span>撮影方向: {directionToLabel(displayedPhoto.shootingDirection)} ({displayedPhoto.shootingDirection}°)</span>
                      </div>
                    )}

                    {/* タグ */}
                    {displayedPhoto.tags.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Tag className="w-4 h-4 text-gray-500" />
                        {displayedPhoto.tags.map((tag) => (
                          <span
                            key={tag.tagId}
                            data-testid="detail-tag-chip"
                            className="inline-flex items-center px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-700"
                          >
                            {tag.name}
                          </span>
                        ))}
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
                    shootingDirection={displayedPhoto.shootingDirection}
                    onClick={onMinimapClick ? () => onMinimapClick({
                      lat: displayedPhoto.latitude ?? displayedPhoto.spot.latitude,
                      lng: displayedPhoto.longitude ?? displayedPhoto.spot.longitude,
                      shootingDirection: displayedPhoto.shootingDirection,
                    }) : undefined}
                  />

                  {/* ドットインジケーター */}
                  {photoIds.length > 1 && (
                    <div className="flex justify-center gap-2">
                      {photoIds.map((_, index) => (
                        <div
                          key={index}
                          data-testid={`${TEST_ID_DOT_PREFIX}${index}`}
                          className={`w-2 h-2 rounded-full ${
                            index === currentIndex ? 'bg-gray-900' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Issue#30: お気に入りボタン（design-assets準拠） */}
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
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
