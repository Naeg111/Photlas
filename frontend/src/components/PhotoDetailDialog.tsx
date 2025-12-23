import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'

interface PhotoDetailDialogProps {
  open: boolean
  spotId: number
  onClose: () => void
}

interface PhotoDetail {
  photoId: number
  title: string
  imageUrls: {
    thumbnail: string
    standard: string
    original: string
  }
  shotAt: string
  weather?: string
  timeOfDay?: string
  subjectCategory?: string
  cameraInfo?: {
    body?: string
    lens?: string
    fValue?: string
    shutterSpeed?: string
    iso?: string
  }
  user: {
    userId: number
    username: string
    profileImageUrl?: string
    snsLinks?: {
      twitter?: string
      instagram?: string
    }
  }
  spot: {
    spotId: number
  }
}

export default function PhotoDetailDialog({ open, spotId, onClose }: PhotoDetailDialogProps) {
  const [photoIds, setPhotoIds] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [photoDetails, setPhotoDetails] = useState<Map<number, PhotoDetail>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emblaRef, emblaApi] = useEmblaCarousel()

  // スポットの写真ID一覧を取得
  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setPhotoIds([])
      setPhotoDetails(new Map())
      setCurrentIndex(0)
      setError(null)
      setLoading(true)
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch photo IDs
        const idsResponse = await fetch(`/api/v1/spots/${spotId}/photos`, {
          headers: {
            ...(typeof localStorage !== 'undefined' && localStorage.getItem('token')
              ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
              : {}),
          },
        })

        if (!idsResponse.ok) {
          throw new Error('Failed to fetch photo IDs')
        }

        const ids: number[] = await idsResponse.json()
        setPhotoIds(ids)
        setCurrentIndex(0)

        // Fetch first photo detail
        if (ids.length > 0) {
          const detailResponse = await fetch(`/api/v1/photos/${ids[0]}`, {
            headers: {
              ...(typeof localStorage !== 'undefined' && localStorage.getItem('token')
                ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
                : {}),
            },
          })

          if (!detailResponse.ok) {
            throw new Error('Failed to fetch photo detail')
          }

          const detail: PhotoDetail = await detailResponse.json()
          setPhotoDetails(new Map().set(ids[0], detail))
        }

        setLoading(false)
      } catch (err) {
        setError('読み込みに失敗しました')
        setLoading(false)
      }
    }

    fetchData()
  }, [open, spotId])

  // 写真詳細を取得
  const fetchPhotoDetail = useCallback(async (photoId: number) => {
    if (photoDetails.has(photoId)) return

    try {
      const response = await fetch(`/api/v1/photos/${photoId}`, {
        headers: {
          ...(typeof localStorage !== 'undefined' && localStorage.getItem('token')
            ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
            : {}),
        },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch photo detail')
      }
      const detail: PhotoDetail = await response.json()
      setPhotoDetails(prev => new Map(prev).set(photoId, detail))
    } catch (err) {
      setError('読み込みに失敗しました')
    }
  }, [photoDetails])

  // カルーセル操作
  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(async () => {
    if (emblaApi) emblaApi.scrollNext()
    // 次の写真の詳細を事前取得
    if (currentIndex < photoIds.length - 1) {
      await fetchPhotoDetail(photoIds[currentIndex + 1])
    }
  }, [emblaApi, currentIndex, photoIds, fetchPhotoDetail])

  useEffect(() => {
    if (!emblaApi) return

    emblaApi.on('select', () => {
      setCurrentIndex(emblaApi.selectedScrollSnap())
    })
  }, [emblaApi])

  const currentPhotoId = photoIds[currentIndex]
  const currentPhoto = currentPhotoId ? photoDetails.get(currentPhotoId) : null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid="photo-detail-dialog" className="max-w-4xl max-h-[90vh] p-0">
        <DialogTitle className="sr-only">写真詳細</DialogTitle>
        <DialogDescription className="sr-only">写真の詳細情報と撮影コンテクスト</DialogDescription>
        <div className="relative h-full">
          {/* 閉じるボタン */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </Button>

          {loading && (
            <div className="flex items-center justify-center h-96" data-testid="loading-spinner">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-96">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && currentPhoto && (
            <div className="flex flex-col h-full">
              {/* カルーセル */}
              <div className="relative flex-1">
                <div className="overflow-hidden h-full" ref={emblaRef}>
                  <div className="flex h-full">
                    <div className="flex-[0_0_100%] min-w-0">
                      <img
                        src={currentPhoto.imageUrls.standard}
                        alt={currentPhoto.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
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
                        aria-label="前の写真"
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
                        aria-label="次の写真"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* 写真情報 */}
              <div className="p-6 space-y-4">
                <h2 className="text-2xl font-bold">{currentPhoto.title}</h2>

                {/* ユーザー情報 */}
                <div className="flex items-center gap-3">
                  {currentPhoto.user.profileImageUrl && (
                    <img
                      src={currentPhoto.user.profileImageUrl}
                      alt={currentPhoto.user.username}
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                  <span className="font-medium">{currentPhoto.user.username}</span>
                </div>

                {/* カメラ情報 */}
                {currentPhoto.cameraInfo && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">カメラ情報</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {currentPhoto.cameraInfo.body && (
                        <div>
                          <span className="text-gray-600">ボディ: </span>
                          <span>{currentPhoto.cameraInfo.body}</span>
                        </div>
                      )}
                      {currentPhoto.cameraInfo.lens && (
                        <div>
                          <span className="text-gray-600">レンズ: </span>
                          <span>{currentPhoto.cameraInfo.lens}</span>
                        </div>
                      )}
                      {currentPhoto.cameraInfo.fValue && (
                        <div>
                          <span className="text-gray-600">F値: </span>
                          <span>{currentPhoto.cameraInfo.fValue}</span>
                        </div>
                      )}
                      {currentPhoto.cameraInfo.shutterSpeed && (
                        <div>
                          <span className="text-gray-600">シャッタースピード: </span>
                          <span>{currentPhoto.cameraInfo.shutterSpeed}</span>
                        </div>
                      )}
                      {currentPhoto.cameraInfo.iso && (
                        <div>
                          <span className="text-gray-600">ISO: </span>
                          <span>{currentPhoto.cameraInfo.iso}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ドットインジケーター */}
                {photoIds.length > 1 && (
                  <div className="flex justify-center gap-2">
                    {photoIds.map((_, index) => (
                      <div
                        key={index}
                        data-testid={`dot-indicator-${index}`}
                        className={`w-2 h-2 rounded-full ${
                          index === currentIndex ? 'bg-gray-900' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
