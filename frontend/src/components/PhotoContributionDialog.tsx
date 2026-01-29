import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { CategoryIcon } from './CategoryIcon'
import { Checkbox } from './ui/checkbox'
import { ImageWithFallback } from './figma/ImageWithFallback'
import { Upload, X } from 'lucide-react'
import { Progress } from './ui/progress'
import { motion, AnimatePresence } from 'motion/react'
import { PHOTO_CATEGORIES, PHOTO_UPLOAD, UPLOAD_STATUS } from '../utils/constants'
import { ApiError } from '../utils/apiClient'
import { WeatherIcons } from './FilterIcons'
import { InlineMapPicker } from './InlineMapPicker'

/**
 * PhotoContributionDialog コンポーネント
 * Issue#27: パネル・ダイアログ群の移行
 *
 * 写真投稿ダイアログ - design-assetsベースでS3 Presigned URL連携を統合
 */

// 天気の選択肢
const WEATHER_OPTIONS = ['晴れ', '曇り', '雨', '雪'] as const
type WeatherOption = typeof WEATHER_OPTIONS[number]

interface PhotoContributionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (data: {
    file: File
    title: string
    categories: string[]
    position: { lat: number; lng: number }
    weather: string
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      // 位置情報が未設定の場合、デフォルト位置を設定
      // TODO: 実際の実装ではEXIFから取得
      if (!pinPosition) {
        setPinPosition({ lat: 35.6762, lng: 139.6503 })
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

  const handleSubmit = async () => {
    // バリデーション
    if (!selectedFile) {
      alert('写真を選択してください。')
      return
    }
    if (selectedCategories.length === 0) {
      alert('カテゴリを1つ以上選択してください。')
      return
    }
    if (!pinPosition) {
      alert('位置情報を設定してください。')
      return
    }
    if (!selectedWeather) {
      alert('天気を選択してください。')
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
          position: pinPosition,
          weather: selectedWeather,
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
  }

  const handleRemovePhoto = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    setPinPosition(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const canSubmit = selectedFile && selectedCategories.length > 0 && pinPosition && selectedWeather

  return (
    <Dialog open={open} onOpenChange={uploadStatus === 'uploading' ? undefined : onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>写真を投稿</DialogTitle>
          <DialogDescription className="sr-only">
            写真とコンテクスト情報を投稿する
          </DialogDescription>
        </DialogHeader>

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
                  <ImageWithFallback
                    src={previewUrl}
                    alt="プレビュー"
                    className="w-full h-64 object-contain rounded"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
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
            <Label className="text-base">天気 *</Label>
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
                    onClick={() => setSelectedWeather(weather)}
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
