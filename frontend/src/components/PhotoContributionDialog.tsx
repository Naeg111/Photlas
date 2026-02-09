import { useState, useRef, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { CategoryIcon } from './CategoryIcon'
import { Checkbox } from './ui/checkbox'
import { Upload, X, Camera, Compass, Tag } from 'lucide-react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Progress } from './ui/progress'
import { motion, AnimatePresence } from 'motion/react'
import { PHOTO_CATEGORIES, PHOTO_UPLOAD, UPLOAD_STATUS } from '../utils/constants'
import { ApiError } from '../utils/apiClient'
import { WeatherIcons } from './FilterIcons'
import { InlineMapPicker } from './InlineMapPicker'
import { extractExif, type ExifData } from '../utils/extractExif'

/**
 * PhotoContributionDialog コンポーネント
 * Issue#27: パネル・ダイアログ群の移行
 * Issue#41: EXIF情報の自動抽出
 *
 * 写真投稿ダイアログ - design-assetsベースでS3 Presigned URL連携を統合
 *
 * ダイアログ構造: 固定ヘッダー + スクロール可能なフォーム部分
 * iOS Safariのfixed+transformスクロール問題を回避するため、
 * DialogContentのoverflow-y-autoではなく内部divでスクロールを管理する
 */

// 天気の選択肢
const WEATHER_OPTIONS = ['晴れ', '曇り', '雨', '雪'] as const
type WeatherOption = typeof WEATHER_OPTIONS[number]

// 8方位の定義
const DIRECTION_OPTIONS = [
  { label: '北', angle: 0 },
  { label: '北東', angle: 45 },
  { label: '東', angle: 90 },
  { label: '南東', angle: 135 },
  { label: '南', angle: 180 },
  { label: '南西', angle: 225 },
  { label: '西', angle: 270 },
  { label: '北西', angle: 315 },
] as const

interface PhotoContributionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (data: {
    file: File
    title: string
    categories: string[]
    tags: string[]
    position: { lat: number; lng: number }
    weather?: string
    takenAt?: string
    shootingDirection?: number
    exif?: {
      cameraBody?: string
      cameraLens?: string
      focalLength35mm?: number
      fValue?: string
      iso?: number
      shutterSpeed?: string
      imageWidth?: number
      imageHeight?: number
    }
    cropCenterX?: number
    cropCenterY?: number
    cropZoom?: number
  }) => Promise<void>
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'auth_error'

export function PhotoContributionDialog({
  open,
  onOpenChange,
  onSubmit,
}: PhotoContributionDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [title, setTitle] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [pinPosition, setPinPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedWeather, setSelectedWeather] = useState<WeatherOption | ''>('')
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [exifData, setExifData] = useState<ExifData | null>(null)
  const [shootingDirection, setShootingDirection] = useState<number | undefined>(undefined)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ダイアログ表示時にスクロール位置を先頭にリセット
  useEffect(() => {
    if (!open) return
    const scrollToTop = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0
      }
    }
    // ダイアログのアニメーション完了後にリセット（複数回試行）
    scrollToTop()
    const t1 = setTimeout(scrollToTop, 50)
    const t2 = setTimeout(scrollToTop, 150)
    const t3 = setTimeout(scrollToTop, 300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [open])

  const handleCropComplete = useCallback((croppedArea: Area, _croppedAreaPixels: Area) => {
    setCroppedArea(croppedArea)
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // ファイルサイズチェック
      if (file.size > PHOTO_UPLOAD.MAX_FILE_SIZE) {
        alert(`ファイルサイズは${PHOTO_UPLOAD.MAX_FILE_SIZE_DISPLAY}以下にしてください。`)
        return
      }

      // ファイル形式チェック
      if (!PHOTO_UPLOAD.ALLOWED_FILE_TYPES.includes(file.type as typeof PHOTO_UPLOAD.ALLOWED_FILE_TYPES[number])) {
        alert(`${PHOTO_UPLOAD.ALLOWED_FILE_TYPES_DISPLAY}形式のファイルのみ対応しています。`)
        return
      }

      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)

      // EXIF情報を抽出
      const exif = await extractExif(file)
      setExifData(exif)

      // GPS座標がEXIFに含まれる場合はピンを自動配置
      if (exif?.latitude != null && exif?.longitude != null) {
        setPinPosition({ lat: exif.latitude, lng: exif.longitude })
      } else if (!pinPosition) {
        setPinPosition({ lat: 35.6762, lng: 139.6503 })
      }

      // 撮影方向がEXIFに含まれる場合は自動設定
      if (exif?.shootingDirection != null) {
        setShootingDirection(exif.shootingDirection)
      }
    }
  }

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  const handleAddTag = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed])
    }
    setTagInput('')
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag(tagInput)
    }
  }

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.endsWith(',')) {
      handleAddTag(value.slice(0, -1))
    } else {
      setTagInput(value)
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove))
  }

  const handleSubmit = async () => {
    // バリデーション
    if (!selectedFile) {
      alert('写真を選択してください。')
      return
    }
    if (!pinPosition) {
      alert('位置情報を設定してください。')
      return
    }

    // アップロード処理
    setUploadStatus('uploading')
    setUploadProgress(0)

    // プログレスバーのアニメーション
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + UPLOAD_STATUS.PROGRESS_INCREMENT
      })
    }, UPLOAD_STATUS.PROGRESS_INTERVAL)

    try {
      if (onSubmit) {
        await onSubmit({
          file: selectedFile,
          title,
          categories: selectedCategories,
          tags,
          position: pinPosition,
          weather: selectedWeather || undefined,
          takenAt: exifData?.takenAt,
          shootingDirection,
          exif: exifData ? {
            cameraBody: exifData.cameraBody,
            cameraLens: exifData.cameraLens,
            focalLength35mm: exifData.focalLength35mm,
            fValue: exifData.fValue,
            iso: exifData.iso,
            shutterSpeed: exifData.shutterSpeed,
            imageWidth: exifData.imageWidth,
            imageHeight: exifData.imageHeight,
          } : undefined,
          cropCenterX: croppedArea ? (croppedArea.x + croppedArea.width / 2) / 100 : 0.5,
          cropCenterY: croppedArea ? (croppedArea.y + croppedArea.height / 2) / 100 : 0.5,
          cropZoom,
        })
      }

      clearInterval(interval)
      setUploadProgress(100)
      setUploadStatus('success')

      // 成功後にダイアログを閉じてリセット
      setTimeout(() => {
        resetForm()
        onOpenChange(false)
      }, UPLOAD_STATUS.SUCCESS_CLOSE_DELAY)
    } catch (error) {
      clearInterval(interval)

      // 認証エラーの場合はダイアログを閉じる（App側でログイン画面へ遷移）
      if (error instanceof ApiError && error.isUnauthorized) {
        setUploadStatus('auth_error')
        setTimeout(() => {
          resetForm()
        }, UPLOAD_STATUS.ERROR_RESET_DELAY)
        return
      }

      setUploadStatus('error')

      // エラー後にリセット
      setTimeout(() => {
        setUploadStatus('idle')
        setUploadProgress(0)
      }, UPLOAD_STATUS.ERROR_RESET_DELAY)
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    setTitle('')
    setSelectedCategories([])
    setPinPosition(null)
    setSelectedWeather('')
    setUploadStatus('idle')
    setUploadProgress(0)
    setExifData(null)
    setShootingDirection(undefined)
    setTags([])
    setTagInput('')
    setCrop({ x: 0, y: 0 })
    setCropZoom(1)
    setCroppedArea(null)
  }

  const handleRemovePhoto = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    setPinPosition(null)
    setExifData(null)
    setShootingDirection(undefined)
    setCrop({ x: 0, y: 0 })
    setCropZoom(1)
    setCroppedArea(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const canSubmit = selectedFile && pinPosition && selectedCategories.length > 0

  const hasExifInfo = exifData && (
    exifData.cameraBody || exifData.cameraLens || exifData.focalLength35mm ||
    exifData.fValue || exifData.iso || exifData.shutterSpeed ||
    exifData.imageWidth || exifData.imageHeight
  )

  return (
    <Dialog open={open} onOpenChange={uploadStatus === 'uploading' ? undefined : onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh]"
        style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* 固定ヘッダー（常時表示・スクロールしない） */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>写真を投稿</DialogTitle>
            <DialogDescription className="sr-only">
              写真とコンテクスト情報を投稿する
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-gray-500 mt-2">* は入力必須項目です</p>
        </div>

        {/* スクロール可能なフォーム部分 */}
        <div
          ref={scrollRef}
          className="overflow-y-auto flex-1 px-6 pb-6"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
        >
          <div className="space-y-6 mt-4">
            {/* 写真選択 */}
            <div className="space-y-3">
              <Label className="text-base">写真 *</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 ${
                  !previewUrl ? 'cursor-pointer hover:border-gray-400 transition-colors' : ''
                }`}
                onClick={() => {
                  if (!previewUrl) {
                    fileInputRef.current?.click()
                  }
                }}
              >
                {previewUrl ? (
                  <div className="relative">
                    <div data-testid="photo-crop-area" className="relative h-80 bg-gray-900">
                      <Cropper
                        image={previewUrl}
                        crop={crop}
                        zoom={cropZoom}
                        aspect={1}
                        showGrid
                        onCropChange={setCrop}
                        onZoomChange={setCropZoom}
                        onCropComplete={handleCropComplete}
                        style={{
                          cropAreaStyle: {
                            border: '3px solid rgba(255, 255, 255, 0.5)',
                          },
                        }}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-gray-500">ズーム</span>
                      <input
                        type="range"
                        data-testid="crop-zoom-slider"
                        min={1}
                        max={3}
                        step={0.1}
                        value={cropZoom}
                        onChange={(e) => setCropZoom(Number(e.target.value))}
                        className="flex-1"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 z-10"
                      onClick={handleRemovePhoto}
                      aria-label="削除"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Upload className="w-12 h-12 text-gray-400 mb-4" />
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                    >
                      写真を選択
                    </Button>
                    <p className="text-sm text-gray-500 mt-2">
                      {PHOTO_UPLOAD.ALLOWED_FILE_TYPES_DISPLAY}（最大{PHOTO_UPLOAD.MAX_FILE_SIZE_DISPLAY}）
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/heic"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* EXIF情報表示 */}
            {hasExifInfo && (
              <div className="space-y-3">
                <Label className="text-base flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  カメラ情報
                </Label>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {exifData.cameraBody && (
                      <div>
                        <span className="text-gray-500">カメラ</span>
                        <p className="font-medium">{exifData.cameraBody}</p>
                      </div>
                    )}
                    {exifData.cameraLens && (
                      <div>
                        <span className="text-gray-500">レンズ</span>
                        <p className="font-medium">{exifData.cameraLens}</p>
                      </div>
                    )}
                    {exifData.focalLength35mm != null && (
                      <div>
                        <span className="text-gray-500">焦点距離</span>
                        <p className="font-medium">{exifData.focalLength35mm}mm</p>
                      </div>
                    )}
                    {exifData.fValue && (
                      <div>
                        <span className="text-gray-500">絞り</span>
                        <p className="font-medium">{exifData.fValue}</p>
                      </div>
                    )}
                    {exifData.shutterSpeed && (
                      <div>
                        <span className="text-gray-500">シャッタースピード</span>
                        <p className="font-medium">{exifData.shutterSpeed}</p>
                      </div>
                    )}
                    {exifData.iso != null && (
                      <div>
                        <span className="text-gray-500">ISO</span>
                        <p className="font-medium">ISO {exifData.iso}</p>
                      </div>
                    )}
                    {exifData.imageWidth != null && exifData.imageHeight != null && (
                      <div>
                        <span className="text-gray-500">解像度</span>
                        <p className="font-medium">{exifData.imageWidth} x {exifData.imageHeight}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* タイトル */}
            <div className="space-y-3">
              <Label htmlFor="title" className="text-base">タイトル</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：夕暮れの東京タワー"
                maxLength={PHOTO_UPLOAD.TITLE_MAX_LENGTH}
                className="mt-2"
              />
              <p className="text-sm text-gray-500">{title.length}/{PHOTO_UPLOAD.TITLE_MAX_LENGTH}文字</p>
            </div>

            {/* 位置情報 */}
            <div className="space-y-3">
              <Label className="text-base">撮影場所 *</Label>
              <p className="text-sm text-gray-500">
                地図をドラッグして撮影場所にピンを合わせてください
              </p>
              <div className="border rounded-lg overflow-hidden h-64">
                <InlineMapPicker
                  position={pinPosition}
                  onPositionChange={setPinPosition}
                />
              </div>
            </div>

            {/* 撮影方向 */}
            {selectedFile && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base flex items-center gap-2">
                    <Compass className="w-4 h-4" />
                    撮影方向
                  </Label>
                  {shootingDirection != null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShootingDirection(undefined)}
                      aria-label="リセット"
                    >
                      リセット
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {DIRECTION_OPTIONS.map(({ label, angle }) => (
                    <Button
                      key={label}
                      variant="outline"
                      size="sm"
                      className={`${
                        shootingDirection === angle
                          ? 'border-primary bg-primary/5'
                          : ''
                      }`}
                      onClick={() => setShootingDirection(angle)}
                      aria-label={label}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* タグ入力 */}
            <div className="space-y-3">
              <Label className="text-base flex items-center gap-2">
                <Tag className="w-4 h-4" />
                タグ
              </Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    data-testid="tag-chip"
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-500"
                      aria-label={`${tag}を削除`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <Input
                value={tagInput}
                onChange={handleTagInputChange}
                onKeyDown={handleTagKeyDown}
                placeholder="タグを入力（Enterまたはカンマで追加）"
              />
            </div>

            {/* カテゴリ選択 */}
            <div className="space-y-3">
              <Label className="text-base">カテゴリ *（1つ以上選択）</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PHOTO_CATEGORIES.map((category) => (
                  <div
                    key={category}
                    className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedCategories.includes(category)
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleCategoryToggle(category)}
                  >
                    <Checkbox
                      id={`category-${category}`}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => handleCategoryToggle(category)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={category}
                    />
                    <CategoryIcon category={category} className="w-5 h-5" />
                    <Label
                      htmlFor={`category-${category}`}
                      className="cursor-pointer flex-1"
                    >
                      {category}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* 天気選択 */}
            <div className="space-y-3">
              <Label className="text-base">天気</Label>
              <div className="grid grid-cols-4 gap-3">
                {WEATHER_OPTIONS.map((weather) => {
                  const Icon = WeatherIcons[weather]
                  return (
                    <div
                      key={weather}
                      className={`flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedWeather === weather
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedWeather(prev => prev === weather ? '' : weather)}
                    >
                      {Icon && <Icon className="w-5 h-5 shrink-0" />}
                      <Label className="cursor-pointer">
                        {weather}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 投稿ボタン */}
            <div className="flex gap-3 pt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={uploadStatus === 'uploading'}
              >
                キャンセル
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={!canSubmit || uploadStatus === 'uploading'}
              >
                投稿する
              </Button>
            </div>
          </div>
        </div>

        {/* アップロード状態オーバーレイ */}
        <AnimatePresence>
          {uploadStatus !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed inset-x-0 bottom-0 z-50 p-6"
            >
              <div
                className={`max-w-md mx-auto rounded-lg shadow-2xl p-6 ${
                  uploadStatus === 'error' || uploadStatus === 'auth_error'
                    ? 'bg-red-500'
                    : uploadStatus === 'success'
                    ? 'bg-green-500'
                    : 'bg-white'
                }`}
              >
                <div className="space-y-3">
                  <p
                    className={`text-center ${
                      uploadStatus === 'error' || uploadStatus === 'success' || uploadStatus === 'auth_error'
                        ? 'text-white'
                        : 'text-gray-900'
                    }`}
                  >
                    {uploadStatus === 'uploading' && '送信しています'}
                    {uploadStatus === 'success' && '完了しました'}
                    {uploadStatus === 'auth_error' && 'ログインの有効期限が切れました。再度ログインしてください'}
                    {uploadStatus === 'error' && 'エラー 時間をおいて再度お試しください'}
                  </p>
                  {uploadStatus === 'uploading' && (
                    <Progress value={uploadProgress} className="h-2" />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
