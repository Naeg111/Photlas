import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import { Button } from './ui/button'
import { LIGHTBOX } from '../utils/constants'
import { toast } from 'sonner'

/**
 * PhotoLightbox コンポーネント
 * Issue#27: パネル・ダイアログ群の移行
 * Issue#88: オリジナル画像のfetch+ReadableStreamローディング表示
 */

/** ローディング画面を表示するまでの遅延（ms） */
const LOADING_DELAY_MS = 200

function getCursorStyle(scale: number, isDragging: boolean): string {
  if (scale <= 1) return 'default'
  return isDragging ? 'grabbing' : 'grab'
}

interface PhotoLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
}

export function PhotoLightbox({ open, onOpenChange, imageUrl }: PhotoLightboxProps) {
  const [scale, setScale] = useState<number>(LIGHTBOX.INITIAL_SCALE)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const pinchRef = useRef<{ initialDistance: number; initialScale: number } | null>(null)

  // Issue#88: ローディング状態管理
  const [isLoading, setIsLoading] = useState(false)
  const [showLoading, setShowLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Issue#88: fetch + ReadableStream でオリジナル画像を読み込む
  const fetchImage = useCallback(async (url: string) => {
    setIsLoading(true)
    setShowLoading(false)
    setProgress(0)
    setLoadError(false)

    // 200ms後にまだロード中ならローディング画面を表示
    const delayTimer = setTimeout(() => {
      setShowLoading(true)
    }, LOADING_DELAY_MS)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error('Image fetch failed')

      const contentLength = response.headers.get('Content-Length')
      const total = contentLength ? parseInt(contentLength, 10) : 0

      if (!response.body) {
        // ReadableStream非対応の場合はBlobとして読み込み
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)
        clearTimeout(delayTimer)
        setBlobUrl(objectUrl)
        setIsLoading(false)
        setShowLoading(false)
        return
      }

      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (total > 0) {
          setProgress(Math.min(received / total, 1))
        }
      }

      const blob = new Blob(chunks)
      const objectUrl = URL.createObjectURL(blob)
      clearTimeout(delayTimer)
      setBlobUrl(objectUrl)
      setIsLoading(false)
      setShowLoading(false)
      setProgress(1)
    } catch (err) {
      clearTimeout(delayTimer)
      if ((err as Error).name === 'AbortError') return
      setLoadError(true)
      setIsLoading(false)
      setShowLoading(false)
      toast.error('画像の読み込みに失敗しました。再度開き直してください')
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setScale(LIGHTBOX.INITIAL_SCALE)
      setPosition({ x: 0, y: 0 })
      // Blob URL のクリーンアップ
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
        setBlobUrl(null)
      }
      setIsLoading(false)
      setShowLoading(false)
      setProgress(0)
      setLoadError(false)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      return
    }

    // open時にfetch開始
    if (imageUrl) {
      fetchImage(imageUrl)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange, imageUrl, fetchImage])

  // Blob URL のクリーンアップ（アンマウント時）
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -LIGHTBOX.ZOOM_DELTA : LIGHTBOX.ZOOM_DELTA
    setScale((prev) => Math.max(LIGHTBOX.MIN_SCALE, Math.min(LIGHTBOX.MAX_SCALE, prev + delta)))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.hypot(dx, dy)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsDragging(false)
      pinchRef.current = {
        initialDistance: getTouchDistance(e.touches),
        initialScale: scale,
      }
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault()
      const currentDistance = getTouchDistance(e.touches)
      const ratio = currentDistance / pinchRef.current.initialDistance
      const newScale = pinchRef.current.initialScale * ratio
      setScale(Math.max(LIGHTBOX.MIN_SCALE, Math.min(LIGHTBOX.MAX_SCALE, newScale)))
    } else if (isDragging && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      })
    }
  }

  const handleTouchEnd = () => {
    pinchRef.current = null
    setIsDragging(false)
  }

  // 表示する画像URL: BlobURL → フォールバック(エラー時はimageUrl直接) → なし
  const displayImageUrl = blobUrl ?? (loadError ? imageUrl : null)

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 z-[60] pointer-events-auto"
          onClick={() => onOpenChange(false)}
        >
          {/* Issue#88: ローディング画面 */}
          {showLoading && isLoading && (
            <div
              data-testid="lightbox-loading"
              className="absolute inset-0 flex flex-col items-center justify-center z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                viewBox="56 60 400 400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ width: '21.0vmin', height: '21.0vmin' }}
              >
                <path
                  d="M256 80C180 80 120 140 120 216c0 96 136 228 136 228s136-132 136-228C392 140 332 80 256 80z"
                  fill="white"
                />
                <rect x="182" y="190" width="148" height="86" rx="12" fill="black" />
                <rect x="224" y="170" width="56" height="28" rx="6" fill="black" />
                <circle cx="256" cy="230" r="30" fill="white" />
                <circle cx="256" cy="230" r="18" fill="black" />
                <circle cx="316" cy="208" r="6" fill="white" opacity="0.6" />
              </svg>
              {/* プログレスバー: アイコン幅の110% */}
              <div
                data-testid="lightbox-progress-bar"
                className="mt-4"
                style={{ width: 'calc(21.0vmin * 1.1)' }}
              >
                <div className="h-1 border border-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-150"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 画像表示 */}
          {displayImageUrl && (
            <div
              role="presentation" className="absolute inset-0 flex items-center justify-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ cursor: getCursorStyle(scale, isDragging), touchAction: 'none' }}
            >
              <motion.div
                style={{
                  scale,
                  x: position.x,
                  y: position.y,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <img
                  src={displayImageUrl}
                  alt="フルサイズ写真"
                  className="max-w-[90vw] max-h-[90vh] object-contain"
                />
              </motion.div>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] right-4 text-white hover:bg-white/20 z-10"
            onClick={(e) => {
              e.stopPropagation()
              onOpenChange(false)
            }}
          >
            <X className="w-6 h-6" />
          </Button>

          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full pointer-events-none">
            拡大: {Math.round(scale * 100)}%
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
