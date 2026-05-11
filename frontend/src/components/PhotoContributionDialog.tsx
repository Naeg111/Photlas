import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { analyzePhoto, type PhotoAnalyzeResponse } from '../utils/photoAnalyzeApi'
import { resizeImageToBlobForAnalyze } from '../utils/cropImageToBlob'
import { resizeImageFile } from '../utils/resizeImageFile'
import { CATEGORY_LABELS } from '../utils/codeConstants'
import { trackAiPrefillEvent, compareAiPrefill } from '../utils/aiPrefillAnalytics'

/** カテゴリ名 → ID の逆引きマップ（CATEGORY_LABELS の逆） */
const CATEGORY_NAME_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([id, name]) => [name, Number(id)])
)

/** Issue#119: ユーザーがトリミング調整を止めてから AI 解析を発火するまでの待ち時間 */
const ANALYZE_DEBOUNCE_MS = 1000

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { notifyIfRateLimited } from '../utils/notifyIfRateLimited'
import { WeatherIcons } from './FilterIcons'
import { InlineMapPicker } from './InlineMapPicker'
import {
  WEATHER_OPTIONS as CODE_WEATHER_OPTIONS,
  WEATHER_LABELS,
  WEATHER_SUNNY,
  WEATHER_CLOUDY,
  WEATHER_RAIN,
  WEATHER_SNOW,
  DEVICE_TYPE_LABELS,
  DEVICE_TYPE_SMARTPHONE,
  DEVICE_TYPE_MIRRORLESS,
  DEVICE_TYPE_SLR,
  DEVICE_TYPE_COMPACT,
  DEVICE_TYPE_FILM,
  DEVICE_TYPE_OTHER,
} from '../utils/codeConstants'
import { extractExif, type ExifData } from '../utils/extractExif'
import { SearchBoxCore, SessionToken } from '@mapbox/search-js-core'
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox'
import { sortSuggestionsByRelevance } from '../utils/sortSuggestions'
import { MAPBOX_LANGUAGE_MAP, type SupportedLanguage } from '../i18n'

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

// Issue#87: 天気・機材種別の選択肢は codeConstants から取得
// Issue#67: 機材種別は投稿数の多い順に並び替え
const DEVICE_TYPE_OPTIONS = [
  { value: DEVICE_TYPE_SMARTPHONE, label: DEVICE_TYPE_LABELS[DEVICE_TYPE_SMARTPHONE] },
  { value: DEVICE_TYPE_MIRRORLESS, label: DEVICE_TYPE_LABELS[DEVICE_TYPE_MIRRORLESS] },
  { value: DEVICE_TYPE_SLR, label: DEVICE_TYPE_LABELS[DEVICE_TYPE_SLR] },
  { value: DEVICE_TYPE_COMPACT, label: DEVICE_TYPE_LABELS[DEVICE_TYPE_COMPACT] },
  { value: DEVICE_TYPE_FILM, label: DEVICE_TYPE_LABELS[DEVICE_TYPE_FILM] },
  { value: DEVICE_TYPE_OTHER, label: DEVICE_TYPE_LABELS[DEVICE_TYPE_OTHER] },
] as const

const DEVICE_TYPE_I18N_KEYS: Record<number, string> = {
  [DEVICE_TYPE_SMARTPHONE]: 'deviceType.smartphone',
  [DEVICE_TYPE_MIRRORLESS]: 'deviceType.mirrorless',
  [DEVICE_TYPE_SLR]: 'deviceType.slr',
  [DEVICE_TYPE_COMPACT]: 'deviceType.compact',
  [DEVICE_TYPE_FILM]: 'deviceType.film',
  [DEVICE_TYPE_OTHER]: 'deviceType.other',
}

const WEATHER_I18N_KEYS: Record<number, string> = {
  [WEATHER_SUNNY]: 'weather.sunny',
  [WEATHER_CLOUDY]: 'weather.cloudy',
  [WEATHER_RAIN]: 'weather.rainy',
  [WEATHER_SNOW]: 'weather.snowy',
}

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
    weather?: number
    takenAt?: string
    deviceType: number
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
    /** Issue#119: AI 解析で発行された analyzeToken（任意）。バックエンドが photo_ai_predictions に紐づける */
    analyzeToken?: string
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
  const { t, i18n } = useTranslation()
  const mapboxLang = MAPBOX_LANGUAGE_MAP[i18n.language as SupportedLanguage] || 'en'
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [pinPosition, setPinPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedWeather, setSelectedWeather] = useState<number | ''>('')
  const [selectedDeviceType, setSelectedDeviceType] = useState<number | ''>('')
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [exifData, setExifData] = useState<ExifData | null>(null)
  const [placeName, setPlaceName] = useState('')
  const [placeNameSuggestions, setPlaceNameSuggestions] = useState<PlaceNameSuggestion[]>([])
  const [isPlaceNameDropdownOpen, setIsPlaceNameDropdownOpen] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  // Issue#119: AI プリフィル関連
  const [analyzeToken, setAnalyzeToken] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiPrefillApplied, setAiPrefillApplied] = useState(false)
  // Issue#119: GA4 accepted/modified 判定用に AI 元結果を保持
  const aiOriginalResponseRef = useRef<PhotoAnalyzeResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Issue#119: AI analyze の AbortController と debounce タイマー
  const analyzeAbortRef = useRef<AbortController | null>(null)
  const analyzeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // スクロール時の選択取り消し機構（モバイルタッチ対応）
  const lastToggleRef = useRef<(() => void) | null>(null)
  const handleScrollDuringToggle = useCallback(() => {
    if (lastToggleRef.current) {
      lastToggleRef.current()
      lastToggleRef.current = null
    }
  }, [])
  const handlePointerUp = useCallback(() => {
    lastToggleRef.current = null
  }, [])

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
      // Issue#119: AI プリフィル関連の state とタイマー・AbortController をリセット
      setAnalyzeToken(null)
      setIsAnalyzing(false)
      setAiPrefillApplied(false)
      if (analyzeDebounceRef.current) {
        clearTimeout(analyzeDebounceRef.current)
        analyzeDebounceRef.current = null
      }
      if (analyzeAbortRef.current) {
        analyzeAbortRef.current.abort()
        analyzeAbortRef.current = null
      }
    }
  }, [open])

  // Issue#119（仕様変更）: AI 解析対象を「トリミング前の画像全体」に変更したため、
  // トリミング操作（cropComplete）では解析を発火させず、ファイル選択直後の 1 回だけ実行する。
  useEffect(() => {
    if (!previewUrl) return
    runAnalyze(previewUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl])

  /**
   * AI 解析を実行する。進行中の analyze は AbortController でキャンセル。
   * 失敗時は黙って続行（Phase 9 でトースト追加予定）。
   *
   * Issue#119（仕様変更）: 解析対象はトリミング前の全体画像。area 引数は廃止。
   */
  const runAnalyze = useCallback(async (imageSrc: string) => {
    // 進行中の analyze をキャンセル
    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort()
    }
    const controller = new AbortController()
    analyzeAbortRef.current = controller

    setIsAnalyzing(true)
    try {
      const blob = await resizeImageToBlobForAnalyze(imageSrc)
      if (controller.signal.aborted) return

      const response = await analyzePhoto(blob, { signal: controller.signal })
      if (controller.signal.aborted) return

      applyAiPrefill(response)
    } catch (error) {
      // AbortError は意図的なキャンセルなので無視。
      // 他のエラー（ネットワーク・5xx 等）はトースト通知でユーザーに案内する
      // （Issue#119 4.6: フォームは空欄のまま手動入力でフォロー）。
      if (!isAbortError(error)) {
        toast.error(t('aiPrefill.error'))
        trackAiPrefillEvent('ai_prefill_failed', {
          error_type: error instanceof Error ? error.name : 'unknown',
        })
      }
    } finally {
      if (analyzeAbortRef.current === controller) {
        analyzeAbortRef.current = null
        setIsAnalyzing(false)
      }
    }
  }, [])

  /**
   * AI レスポンスを state に反映する。空結果の場合はバナーを表示しない。
   */
  const applyAiPrefill = useCallback((response: PhotoAnalyzeResponse) => {
    if (response.analyzeToken) {
      setAnalyzeToken(response.analyzeToken)
    }
    // accepted/modified 判定用に AI 元結果を保持
    aiOriginalResponseRef.current = response

    const prefillCategoryNames = response.categories
      .map((id) => CATEGORY_LABELS[id])
      .filter((name): name is string => Boolean(name))

    if (prefillCategoryNames.length > 0) {
      setSelectedCategories((prev) => {
        // 既存ユーザー選択を残しつつ AI 提案を追加（重複排除）
        const merged = new Set([...prev, ...prefillCategoryNames])
        return Array.from(merged)
      })
    }

    if (response.weather) {
      setSelectedWeather(response.weather)
    }

    // バナーは「実際にプリフィルが発生した」場合のみ表示
    if (prefillCategoryNames.length > 0 || response.weather) {
      setAiPrefillApplied(true)
      trackAiPrefillEvent('ai_prefill_shown', {
        categories_count: prefillCategoryNames.length,
        weather_filled: response.weather !== null,
      })
    }
  }, [])

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
        toast.error(t('photo.fileSizeError'))
        return
      }

      // ファイル形式チェック
      if (!PHOTO_UPLOAD.ALLOWED_FILE_TYPES.includes(file.type as typeof PHOTO_UPLOAD.ALLOWED_FILE_TYPES[number])) {
        toast.error(t('photo.fileFormatError'))
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
        setSelectedDeviceType(DEVICE_TYPE_SMARTPHONE)
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
    setSelectedCategories((prev) => {
      const next = prev.includes(category)
        ? prev.length > 1 ? prev.filter((c) => c !== category) : prev
        : [...prev, category]
      lastToggleRef.current = () => setSelectedCategories(prev)
      return next
    })
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
          language: mapboxLang,
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
      toast.error(t('photo.photoRequiredError'))
      return
    }
    if (!pinPosition) {
      toast.error(t('photo.locationError'))
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
      // Issue#119: AI 採用/修正イベントを onSubmit 直前に送信
      const aiOriginal = aiOriginalResponseRef.current
      if (aiOriginal && analyzeToken) {
        const userCategoryIds = selectedCategories
          .map((name) => CATEGORY_NAME_TO_ID[name])
          .filter((id): id is number => typeof id === 'number')
        const comparison = compareAiPrefill({
          aiCategories: aiOriginal.categories,
          aiWeather: aiOriginal.weather,
          userCategories: userCategoryIds,
          userWeather: selectedWeather === '' ? null : selectedWeather,
        })
        if (comparison.isModified) {
          trackAiPrefillEvent('ai_prefill_modified', {
            modification_type: comparison.modificationType,
            user_diff_flag: comparison.userDiffFlag,
          })
        } else {
          trackAiPrefillEvent('ai_prefill_accepted')
        }
      }

      // 50MB 超は長辺 4000px にリサイズして送信（multipart 上限 50MB の保険）
      const fileToSend = selectedFile.size > PHOTO_UPLOAD.AUTO_RESIZE_THRESHOLD
        ? await resizeImageFile(selectedFile, PHOTO_UPLOAD.AUTO_RESIZE_MAX_DIMENSION)
        : selectedFile

      if (onSubmit) {
        await onSubmit({
          file: fileToSend,
          placeName: placeName || undefined,
          categories: selectedCategories,
          position: pinPosition,
          weather: selectedWeather || undefined,
          takenAt: exifData?.takenAt,
          deviceType: selectedDeviceType as number,
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
          analyzeToken: analyzeToken ?? undefined,
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

      notifyIfRateLimited(error, t)
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
    setPlaceName('')
    setPlaceNameSuggestions([])
    setIsPlaceNameDropdownOpen(false)
    setSelectedCategories([])
    setPinPosition(null)
    setSelectedWeather('')
    setSelectedDeviceType('')
    setExifData(null)
    setCrop({ x: 0, y: 0 })
    setCropZoom(1)
    setCroppedArea(null)
    setAnalyzeToken(null)
    setIsAnalyzing(false)
    setAiPrefillApplied(false)
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
            <DialogTitle>{t('photo.contributeTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('photo.contributeDescription')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* スクロール可能なフォーム部分 */}
        <div
          ref={scrollRef}
          className="overflow-y-auto flex-1 px-6 pb-6"
          onScroll={handleScrollDuringToggle}
          onTouchMove={handleScrollDuringToggle}
          onPointerUp={handlePointerUp}
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
        >
          {/* Issue#119: AI プリフィル成功時の控えめなバナー（タイトル領域ではなくコンテンツの一部として表示）*/}
          {aiPrefillApplied && (
            <p
              data-testid="ai-prefill-banner"
              className="text-sm text-gray-500 mt-4"
            >
              {t('aiPrefill.banner')}
            </p>
          )}
          <div className="space-y-6 mt-4">
            {/* 写真選択 */}
            <div className="space-y-3">
              <Label className="text-base">{t('photo.photoRequired')}</Label>
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
                        // Issue#131 Cycle4: cover を撤回し既定の contain に戻す。
                        // コンテナ内に画像全体がスクロールなしで収まり、
                        // クロップ枠は画像の中に収まる形で表示される。
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
                      <span className="text-sm text-gray-500">{t('photo.zoom')}</span>
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
                      className="absolute top-2 right-2 z-20"
                      onClick={handleRemovePhoto}
                      aria-label={t('common.delete')}
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
                      {t('photo.selectPhoto')}
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
                  {t('photo.cameraInfo')}
                </Label>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {exifData.cameraBody && (
                      <div>
                        <span className="text-gray-500">{t('photo.camera')}</span>
                        <p className="font-medium">{exifData.cameraBody}</p>
                      </div>
                    )}
                    {exifData.cameraLens && (
                      <div>
                        <span className="text-gray-500">{t('photo.lens')}</span>
                        <p className="font-medium">{exifData.cameraLens}</p>
                      </div>
                    )}
                    {exifData.focalLength35mm != null && (
                      <div>
                        <span className="text-gray-500">{t('photo.focalLength')}</span>
                        <p className="font-medium">{exifData.focalLength35mm}mm</p>
                      </div>
                    )}
                    {exifData.fValue && (
                      <div>
                        <span className="text-gray-500">{t('photo.aperture')}</span>
                        <p className="font-medium">{exifData.fValue}</p>
                      </div>
                    )}
                    {exifData.shutterSpeed && (
                      <div>
                        <span className="text-gray-500">{t('photo.shutterSpeed')}</span>
                        <p className="font-medium">{exifData.shutterSpeed}</p>
                      </div>
                    )}
                    {exifData.iso != null && (
                      <div>
                        <span className="text-gray-500">{t('photo.iso')}</span>
                        <p className="font-medium">ISO {exifData.iso}</p>
                      </div>
                    )}
                    {exifData.imageWidth != null && exifData.imageHeight != null && (
                      <div>
                        <span className="text-gray-500">{t('photo.resolution')}</span>
                        <p className="font-medium">{exifData.imageWidth} x {exifData.imageHeight}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 位置情報 */}
            <div className="space-y-3">
              <Label className="text-base">{t('photo.locationRequired')}</Label>
              <div className="space-y-1">
                <p className="text-sm text-gray-500">
                  {t('photo.locationInstruction')}
                </p>
                <p className="text-sm text-gray-500">
                  {t('photo.locationAutoHint')}
                </p>
              </div>
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
                {t('photo.locationName')}
              </Label>
              <div className="relative">
                <Input
                  id="placeName"
                  value={placeName}
                  onChange={(e) => handlePlaceNameSearch(e.target.value)}
                  placeholder={t('photo.locationNamePlaceholder')}
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
              <p className="text-sm text-gray-500">{placeName.length}/{PHOTO_UPLOAD.PLACE_NAME_MAX_LENGTH}{t('common.characters')}</p>
            </div>

            {/* カテゴリ選択 */}
            <div className="space-y-3 relative">
              <Label className="text-base">{t('photo.categoryRequired')}</Label>
              {/* Issue#119: AI 解析中はカテゴリ選択を無効化（スピナーで覆う） */}
              {isAnalyzing && (
                <div
                  data-testid="ai-analyzing-categories"
                  className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 rounded"
                >
                  <span className="text-sm text-gray-600">{t('aiPrefill.analyzing')}</span>
                </div>
              )}
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
                {t('photo.deviceTypeRequired')}
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
                    role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setSelectedDeviceType(option.value) }} onPointerDown={(e) => { e.preventDefault(); const prev = selectedDeviceType; setSelectedDeviceType(option.value); lastToggleRef.current = () => setSelectedDeviceType(prev) }}
                  >
                    <Label className="cursor-pointer">
                      {t(DEVICE_TYPE_I18N_KEYS[option.value] ?? option.label)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* 天気選択 */}
            <div className="space-y-3 relative">
              <Label className="text-base">{t('photo.weatherLabel')}</Label>
              {/* Issue#119: AI 解析中は天気選択を無効化（スピナーで覆う） */}
              {isAnalyzing && (
                <div
                  data-testid="ai-analyzing-weather"
                  className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 rounded"
                >
                  <span className="text-sm text-gray-600">{t('aiPrefill.analyzing')}</span>
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                {CODE_WEATHER_OPTIONS.map((option) => {
                  const label = WEATHER_LABELS[option.value] ?? ''
                  const Icon = WeatherIcons[label]
                  return (
                    <div
                      key={option.value}
                      className={`flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer transition-colors touch-manipulation select-none ${
                        selectedWeather === option.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSelectedWeather(prev => prev === option.value ? '' : option.value) }} onPointerDown={(e) => { e.preventDefault(); const prev = selectedWeather; setSelectedWeather(p => p === option.value ? '' : option.value); lastToggleRef.current = () => setSelectedWeather(prev) }}
                    >
                      {Icon && <Icon className="w-5 h-5 shrink-0" />}
                      <Label className="cursor-pointer">
                        {t(WEATHER_I18N_KEYS[option.value] ?? label)}
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
                {t('common.cancel')}
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={!canSubmit || uploadStatus === 'uploading'}
              >
                {t('photo.post')}
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
                    {uploadStatus === 'uploading' && t('photo.uploading')}
                    {uploadStatus === 'success' && t('photo.uploadComplete')}
                    {uploadStatus === 'auth_error' && t('photo.sessionExpired')}
                    {uploadStatus === 'error' && t('photo.uploadError')}
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
