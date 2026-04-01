import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { CategoryIcon } from './CategoryIcon'
import { Checkbox } from './ui/checkbox'
import { Upload, X, Camera, MapPin, CameraIcon } from 'lucide-react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Progress } from './ui/progress'
import { motion, AnimatePresence } from 'motion/react'
import { PHOTO_CATEGORIES, PHOTO_UPLOAD, UPLOAD_STATUS } from '../utils/constants'
import { ApiError } from '../utils/apiClient'
import { WeatherIcons } from './FilterIcons'
import { InlineMapPicker } from './InlineMapPicker'
import { extractExif, type ExifData } from '../utils/extractExif'
import { SearchBoxCore, SessionToken } from '@mapbox/search-js-core'
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox'
import { sortSuggestionsByRelevance } from '../utils/sortSuggestions'

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

// Issue#46: 機材種別の選択肢
// Issue#67: 投稿数の多い機材順に並び替え
const DEVICE_TYPE_OPTIONS = [
  { label: 'スマートフォン', value: 'SMARTPHONE' },
  { label: 'ミラーレス', value: 'MIRRORLESS' },
  { label: '一眼レフ', value: 'SLR' },
  { label: 'コンパクトデジカメ', value: 'COMPACT' },
  { label: 'フィルム', value: 'FILM' },
  { label: 'その他', value: 'OTHER' },
] as const

// 施設名・店名の検索候補型
interface PlaceNameSuggestion {
  name: string
  full_address?: string
  mapbox_id: string
}

// 施設名検索のデバウンス時間
const PLACE_NAME_DEBOUNCE_MS = 300

interface PhotoContributionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (data: {
    file: File
    placeName?: string
    categories: string[]
    position: { lat: number; lng: number }
    weather?: string
    takenAt?: string
    deviceType: string
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

/** アップロードステータスに対応する背景色クラスを返す */
function getUploadStatusBgColor(status: UploadStatus): string {
  if (status === 'error' || status === 'auth_error') return 'bg-red-500'
  if (status === 'success') return 'bg-gray-900'
  return 'bg-white'
}

export function PhotoContributionDialog({
  open,
  onOpenChange,
  onSubmit,
}: Readonly<PhotoContributionDialogProps>) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [pinPosition, setPinPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedWeather, setSelectedWeather] = useState<WeatherOption | ''>('')
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>('')
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [exifData, setExifData] = useState<ExifData | null>(null)
  const [placeName, setPlaceName] = useState('')
  const [placeNameSuggestions, setPlaceNameSuggestions] = useState<PlaceNameSuggestion[]>([])
  const [isPlaceNameDropdownOpen, setIsPlaceNameDropdownOpen] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 施設名検索用SearchBoxCore
  const placeNameSearchBox = useMemo(() => {
    if (MAPBOX_ACCESS_TOKEN) {
      return new SearchBoxCore({ accessToken: MAPBOX_ACCESS_TOKEN })
    }
    return null
  }, [])
  const placeNameSessionTokenRef = useRef(new SessionToken())
  const placeNameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // アンマウント時にステータスタイマーをクリア
  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current)
      }
    }
  }, [])

  // ダイアログが閉じたら入力内容を全てリセット
  useEffect(() => {
    if (!open) {
      setSelectedFile(null)
      setPreviewUrl('')
      setSelectedCategories([])
      setPinPosition(null)
      setSelectedWeather('')
      setSelectedDeviceType('')
      setUploadStatus('idle')
      setUploadProgress(0)
      setExifData(null)
      setPlaceName('')
      setPlaceNameSuggestions([])
      setIsPlaceNameDropdownOpen(false)
      setCrop({ x: 0, y: 0 })
      setCropZoom(1)
      setCroppedArea(null)
    }
  }, [open])

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

      // Issue#46: スマートフォン判定時に機材種別を自動選択
      if (exif?.isSmartphone) {
        setSelectedDeviceType('SMARTPHONE')
      }

      // GPS座標がEXIFに含まれる場合はピンを自動配置
      if (exif?.latitude != null && exif?.longitude != null) {
        setPinPosition({ lat: exif.latitude, lng: exif.longitude })
      } else if (!pinPosition) {
        setPinPosition({ lat: 35.6812, lng: 139.7671 })
      }

    }
  }

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.length > 1 ? prev.filter((c) => c !== category) : prev
        : [...prev, category]
    )
  }

  // 施設名・店名の検索ハンドラー（デバウンス付き）
  const handlePlaceNameSearch = useCallback((value: string) => {
    setPlaceName(value)

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

        if (pinPosition) {
          options.proximity = [pinPosition.lng, pinPosition.lat]
        }

        const result = await placeNameSearchBox.suggest(value, options)
        const items = sortSuggestionsByRelevance((result.suggestions || []) as PlaceNameSuggestion[], value)
        setPlaceNameSuggestions(items)
        setIsPlaceNameDropdownOpen(items.length > 0)
      } catch {
        setPlaceNameSuggestions([])
        setIsPlaceNameDropdownOpen(false)
      }
    }, PLACE_NAME_DEBOUNCE_MS)
  }, [placeNameSearchBox, pinPosition])

  // 施設名候補の選択ハンドラー
  const handleSelectPlaceNameSuggestion = useCallback((suggestion: PlaceNameSuggestion) => {
    setPlaceName(suggestion.name)
    setPlaceNameSuggestions([])
    setIsPlaceNameDropdownOpen(false)
    placeNameSessionTokenRef.current = new SessionToken()
  }, [])

  // 施設名ドロップダウンの外側クリックで閉じる
  useEffect(() => {
    if (!isPlaceNameDropdownOpen) return
    const handleClick = () => setIsPlaceNameDropdownOpen(false)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isPlaceNameDropdownOpen])

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
          placeName: placeName || undefined,
          categories: selectedCategories,
          position: pinPosition,
          weather: selectedWeather || undefined,
          takenAt: exifData?.takenAt,
          deviceType: selectedDeviceType,
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
      statusTimerRef.current = setTimeout(() => {
        resetForm()
        onOpenChange(false)
      }, UPLOAD_STATUS.SUCCESS_CLOSE_DELAY)
    } catch (error) {
      clearInterval(interval)

      // 認証エラーの場合はダイアログを閉じる（App側でログイン画面へ遷移）
      if (error instanceof ApiError && error.isUnauthorized) {
        setUploadStatus('auth_error')
        statusTimerRef.current = setTimeout(() => {
          resetForm()
        }, UPLOAD_STATUS.ERROR_RESET_DELAY)
        return
      }

      setUploadStatus('error')

      // エラー後にリセット
      statusTimerRef.current = setTimeout(() => {
        setUploadStatus('idle')
        setUploadProgress(0)
      }, UPLOAD_STATUS.ERROR_RESET_DELAY)
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    setPlaceName('')
    setPlaceNameSuggestions([])
    setIsPlaceNameDropdownOpen(false)
    setSelectedCategories([])
    setPinPosition(null)
    setSelectedWeather('')
    setSelectedDeviceType('')
    setUploadStatus('idle')
    setUploadProgress(0)
    setExifData(null)
    setCrop({ x: 0, y: 0 })
    setCropZoom(1)
    setCroppedArea(null)
  }

  const handleRemovePhoto = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    setPinPosition(null)
    setExifData(null)
    setSelectedDeviceType('')
    setCrop({ x: 0, y: 0 })
    setCropZoom(1)
    setCroppedArea(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const canSubmit = selectedFile && pinPosition && selectedCategories.length > 0 && selectedDeviceType !== ''

  const hasExifInfo = exifData && (
    exifData.cameraBody || exifData.cameraLens || exifData.focalLength35mm ||
    exifData.fValue || exifData.iso || exifData.shutterSpeed ||
    exifData.imageWidth || exifData.imageHeight
  )

  return (
    <Dialog open={open} onOpenChange={uploadStatus === 'uploading' ? undefined : onOpenChange}>
      <DialogContent
        className="max-h-[90vh]"
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
              <Label className="text-base">写真（必須）</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 ${
                  !previewUrl ? 'cursor-pointer hover:border-gray-400 transition-colors' : ''
                }`}
                role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") fileInputRef.current?.click() }} onClick={() => {
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

            {/* 位置情報 */}
            <div className="space-y-3">
              <Label className="text-base">撮影場所（必須）</Label>
              <p className="text-sm text-gray-500">
                地図をドラッグして撮影場所にピンを合わせてください
              </p>
              <div className="border rounded-lg overflow-hidden h-[333px]">
                <InlineMapPicker
                  position={pinPosition}
                  onPositionChange={setPinPosition}
                />
              </div>
            </div>

            {/* 施設名・店名 */}
            <div className="space-y-3">
              <Label htmlFor="placeName" className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                施設名・店名
              </Label>
              <div className="relative">
                <Input
                  id="placeName"
                  value={placeName}
                  onChange={(e) => handlePlaceNameSearch(e.target.value)}
                  placeholder="例：東京タワー、スターバックス渋谷店"
                  maxLength={PHOTO_UPLOAD.PLACE_NAME_MAX_LENGTH}
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
              <p className="text-sm text-gray-500">{placeName.length}/{PHOTO_UPLOAD.PLACE_NAME_MAX_LENGTH}文字</p>
            </div>

            {/* カテゴリ選択 */}
            <div className="space-y-3">
              <Label className="text-base">カテゴリ（必須・1つ以上選択）</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PHOTO_CATEGORIES.map((category) => (
                  <div
                    key={category}
                    className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer transition-colors touch-manipulation select-none ${
                      selectedCategories.includes(category)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") handleCategoryToggle(category) }} onPointerDown={(e) => { e.preventDefault(); handleCategoryToggle(category) }}
                  >
                    <Checkbox
                      checked={selectedCategories.includes(category)}
                      aria-label={category}
                      tabIndex={-1}
                      style={{ pointerEvents: 'none' }}
                    />
                    <CategoryIcon category={category} className="w-5 h-5" />
                    <Label className="cursor-pointer flex-1">
                      {category}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* 機材種別選択 */}
            <div className="space-y-3">
              <Label className="text-base flex items-center gap-2">
                <CameraIcon className="w-4 h-4" />
                機材種別（必須）
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {DEVICE_TYPE_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-center justify-center border rounded-lg p-3 cursor-pointer transition-colors touch-manipulation select-none ${
                      selectedDeviceType === option.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setSelectedDeviceType(option.value) }} onPointerDown={(e) => { e.preventDefault(); setSelectedDeviceType(option.value) }}
                  >
                    <Label className="cursor-pointer">
                      {option.label}
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
                      className={`flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer transition-colors touch-manipulation select-none ${
                        selectedWeather === weather
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSelectedWeather(prev => prev === weather ? '' : weather) }} onPointerDown={(e) => { e.preventDefault(); setSelectedWeather(prev => prev === weather ? '' : weather) }}
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
                className={`max-w-md mx-auto rounded-lg shadow-2xl px-6 py-4 ${getUploadStatusBgColor(uploadStatus)}`}
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
