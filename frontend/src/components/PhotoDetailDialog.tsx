import { useEffect, useState, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { X, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import { getAuthHeaders } from '../utils/apiClient'
import { API_V1_URL } from '../config/api'

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

// Weather labels
const WEATHER_LABELS: Record<string, string> = {
  sunny: '晴れ',
  cloudy: '曇り',
  rainy: '雨',
  snowy: '雪',
}

// Error messages
const ERROR_LOAD_FAILED = '読み込みに失敗しました'
const ERROR_FETCH_IDS = 'Failed to fetch photo IDs'
const ERROR_FETCH_DETAIL = 'Failed to fetch photo detail'

interface PhotoDetailDialogProps {
  open: boolean
  spotId: number
  onClose: () => void
  onUserClick?: (user: { userId: number; username: string }) => void
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
interface PhotoDetail {
  photoId: number
  title: string
  imageUrl: string
  shotAt: string
  weather?: string
  isFavorited?: boolean
  favoriteCount?: number
  user: {
    userId: number
    username: string
    profileImageUrl?: string
  }
  spot: {
    spotId: number
  }
}

// APIレスポンスを内部形式に変換
function transformApiResponse(response: PhotoApiResponse): PhotoDetail {
  return {
    photoId: response.photo.photo_id,
    title: response.photo.title,
    imageUrl: response.photo.image_url,
    shotAt: response.photo.shot_at,
    weather: response.photo.weather,
    isFavorited: response.photo.is_favorited,
    favoriteCount: response.photo.favorite_count,
    user: {
      userId: response.user.user_id,
      username: response.user.username,
    },
    spot: {
      spotId: response.spot.spot_id,
    },
  }
}

// Helper Functions
async function fetchPhotoIds(spotId: number): Promise<number[]> {
  const response = await fetch(`${API_SPOTS_PHOTOS}/${spotId}/photos`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(ERROR_FETCH_IDS)
  }

  return await response.json()
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

export default function PhotoDetailDialog({ open, spotId, onClose, onUserClick }: PhotoDetailDialogProps) {
  const [photoIds, setPhotoIds] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [photoDetails, setPhotoDetails] = useState<Map<number, PhotoDetail>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emblaRef, emblaApi] = useEmblaCarousel()

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
        const ids = await fetchPhotoIds(spotId)
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
  }, [open, spotId])

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

  // Issue#30: お気に入りトグル処理
  const handleToggleFavorite = useCallback(async () => {
    if (!currentPhotoId || isFavoriteLoading) return

    setIsFavoriteLoading(true)

    try {
      const method = isFavorited ? 'DELETE' : 'POST'
      const response = await fetch(
        `${API_PHOTOS}/${currentPhotoId}/favorite`,
        {
          method,
          headers: getAuthHeaders(),
        }
      )

      if (response.ok) {
        // 楽観的UI更新
        setIsFavorited(!isFavorited)
        setFavoriteCount(prev => isFavorited ? prev - 1 : prev + 1)
      }
    } catch {
      // エラー時は状態を戻さない（楽観的更新なし）
    } finally {
      setIsFavoriteLoading(false)
    }
  }, [currentPhotoId, isFavorited, isFavoriteLoading])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid={TEST_ID_DIALOG} className="max-w-4xl max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden" hideCloseButton>
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
            <div className="flex items-center justify-center h-96" data-testid={TEST_ID_LOADING}>
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
              {/* カルーセル */}
              <div className="relative flex-shrink-0 min-h-[40vh] max-h-[60vh] overflow-hidden">
                <div className="overflow-hidden h-full" ref={emblaRef}>
                  <div className="flex h-full">
                    {photoIds.map((photoId) => {
                      const photo = photoDetails.get(photoId)
                      return (
                        <div key={photoId} className="flex-[0_0_100%] min-w-0 h-full">
                          {photo ? (
                            <img
                              src={photo.imageUrl}
                              alt={photo.title}
                              className="w-full h-full object-contain cursor-pointer"
                              onClick={() => window.open(`/photo-viewer/${photo.photoId}`, '_blank')}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  window.open(`/photo-viewer/${photo.photoId}`, '_blank')
                                }
                              }}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
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
                <div className="flex-shrink-0 p-6 space-y-4 overflow-y-auto">
                  <h2 className="text-2xl font-bold">{displayedPhoto.title}</h2>

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

                  {/* 天気情報 */}
                  {displayedPhoto.weather && (
                    <div className="text-sm text-gray-600">
                      天気: {WEATHER_LABELS[displayedPhoto.weather] ?? displayedPhoto.weather}
                    </div>
                  )}

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
                      disabled={isFavoriteLoading}
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
