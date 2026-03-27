import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import { Button } from './ui/button'
import { ImageWithFallback } from './figma/ImageWithFallback'
import { LIGHTBOX } from '../utils/constants'

/**
 * PhotoLightbox コンポーネント
 * Issue#27: パネル・ダイアログ群の移行
 *
 * 写真を全画面で拡大表示するライトボックス
 */

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

  useEffect(() => {
    if (!open) {
      setScale(LIGHTBOX.INITIAL_SCALE)
      setPosition({ x: 0, y: 0 })
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

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
    return Math.sqrt(dx * dx + dy * dy)
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
            style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
          >
            <motion.div
              style={{
                scale,
                x: position.x,
                y: position.y,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <ImageWithFallback
                src={imageUrl}
                alt="フルサイズ写真"
                className="max-w-[90vw] max-h-[90vh] object-contain"
              />
            </motion.div>
          </div>

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
