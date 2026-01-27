import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Button } from './ui/button'

// 出力画像設定
const OUTPUT_SIZE = 300
const OUTPUT_QUALITY = 0.9
const OUTPUT_FORMAT = 'image/jpeg'

// ズーム設定
const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_STEP = 0.1

interface ProfileImageCropperProps {
  imageSrc: string
  onCropComplete: (croppedBlob: Blob) => void | Promise<void>
  onCancel: () => void
}

/**
 * 画像をcanvasでトリミング・リサイズ処理
 * Issue#35: プロフィール画像トリミング機能
 */
const createCroppedImage = async (
  imageSrc: string,
  croppedAreaPixels: Area
): Promise<Blob> => {
  const image = new Image()
  image.crossOrigin = 'anonymous'

  return new Promise((resolve, reject) => {
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // 出力サイズを300x300に設定
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE

      // トリミング領域から300x300にリサイズして描画
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      )

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create blob'))
          }
        },
        OUTPUT_FORMAT,
        OUTPUT_QUALITY
      )
    }

    image.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    image.src = imageSrc
  })
}

/**
 * プロフィール画像トリミングコンポーネント
 * Issue#35: 1:1アスペクト比でのトリミング機能を提供
 */
const ProfileImageCropper: React.FC<ProfileImageCropperProps> = ({
  imageSrc,
  onCropComplete,
  onCancel,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(ZOOM_MIN)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  /**
   * トリミング完了時のコールバック
   */
  const handleCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  /**
   * 確定ボタンクリック時の処理
   */
  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return

    setIsProcessing(true)
    try {
      const croppedBlob = await createCroppedImage(imageSrc, croppedAreaPixels)
      await onCropComplete(croppedBlob)
    } catch {
      // エラー時の処理
    } finally {
      setIsProcessing(false)
    }
  }, [croppedAreaPixels, imageSrc, onCropComplete])

  /**
   * ズームスライダー変更時の処理
   */
  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(Number(e.target.value))
  }, [])

  return (
    <div
      data-testid="cropper-modal"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-lg w-full max-w-md overflow-hidden">
        {/* トリミング領域 */}
        <div className="relative h-80 bg-gray-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        {/* ズームスライダー */}
        <div className="p-4 bg-gray-50">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span>ズーム</span>
            <input
              type="range"
              data-testid="zoom-slider"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={zoom}
              onChange={handleZoomChange}
              className="flex-1"
              disabled={isProcessing}
            />
          </label>
        </div>

        {/* ローディング表示 */}
        {isProcessing && (
          <div
            data-testid="cropper-loading"
            className="absolute inset-0 bg-white/50 flex items-center justify-center"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        )}

        {/* ボタン */}
        <div className="flex gap-2 p-4 border-t">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1"
          >
            キャンセル
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!croppedAreaPixels || isProcessing}
            className="flex-1"
          >
            確定
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ProfileImageCropper
