import { useState, useEffect, useRef, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { SplashScreen } from './components/SplashScreen'
import PhotoViewerPage from './pages/PhotoViewerPage'
import NotFoundPage from './pages/NotFoundPage'
import { FilterPanel } from './components/FilterPanel'
import type { FilterConditions } from './components/FilterPanel'
import { TopMenuPanel } from './components/TopMenuPanel'
import { LoginRequiredDialog } from './components/LoginRequiredDialog'
import { LoginDialog } from './components/LoginDialog'
import { SignUpDialog } from './components/SignUpDialog'
import { TermsOfServicePage } from './components/TermsOfServicePage'
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage'
import PasswordResetRequestModal from './components/PasswordResetRequestModal'
import { PhotoContributionDialog } from './components/PhotoContributionDialog'
import { AccountSettingsDialog } from './components/AccountSettingsDialog'
import ProfileDialog from './components/ProfileDialog'
import PhotoDetailDialog from './components/PhotoDetailDialog'
import { WantToGoListDialog } from './components/WantToGoListDialog'
import { AboutDialog } from './components/AboutDialog'
import { PhotoLightbox } from './components/PhotoLightbox'
import MapView from './components/MapView'
import type { MapViewFilterParams, MapViewHandle } from './components/MapView'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useDialogState } from './hooks/useDialogState'
import { transformMonths, transformTimesOfDay, transformWeathers, transformCategories, categoryNamesToIds } from './utils/filterTransform'
import { fetchCategories, getPhotoUploadUrl, uploadFileToS3, createPhoto, ApiError } from './utils/apiClient'
import { SPLASH_SCREEN_DURATION_MS } from './config/app'
import { SlidersHorizontal, Menu, Plus, Minus, LocateFixed } from 'lucide-react'
import { Button } from './components/ui/button'
import { Toaster } from './components/ui/sonner'

/**
 * App コンポーネント
 * Issue#28: App.tsx再構築と不要ファイル削除
 *
 * React Routerを削除し、モーダルベースのナビゲーションに移行。
 * 全てのダイアログ状態をuseDialogStateフックで集中管理。
 */

/** フローティングボタンの共通スタイル */
const FLOATING_BUTTON_STYLES = {
  outline: 'bg-white shadow-lg gap-2',
  fab: 'w-14 h-14 rounded-full shadow-lg',
} as const

/**
 * MainContent コンポーネント
 * useAuthを使用するためAuthProvider内で使用
 */
function MainContent() {
  const { user, logout } = useAuth()
  const dialog = useDialogState()
  const mapRef = useRef<MapViewHandle>(null)

  // フィルター関連の状態
  const [mapFilterParams, setMapFilterParams] = useState<MapViewFilterParams | undefined>(undefined)
  const [categoryMap, setCategoryMap] = useState<Map<string, number>>(new Map())

  // 写真詳細・ライトボックス関連の状態
  const [selectedSpotId, setSelectedSpotId] = useState<number | null>(null)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('')

  // プロフィールダイアログの初期タブ
  const [profileInitialTab, setProfileInitialTab] = useState<'posts' | 'favorites'>('posts')

  // 他ユーザーのプロフィール表示用の状態
  const [viewingUser, setViewingUser] = useState<{ userId: number; username: string } | null>(null)

  // 撮影地点プレビュー状態
  const [shootingLocationPreview, setShootingLocationPreview] = useState<{ lat: number; lng: number } | null>(null)
  const shootingLocationPreviewRef = useRef(shootingLocationPreview)
  shootingLocationPreviewRef.current = shootingLocationPreview
  // Issue#50: プレビューモード中フラグ（Radix flushSync対策）
  // Radix DismissableLayerのdispatchDiscreteCustomEventはflushSyncを使用し、
  // state更新を強制コミットする。このためモバイルタッチ時にisSlideDownがfalseに
  // なった状態でonPointerDownOutsideが評価され、ダイアログが閉じてしまう。
  // refはReactのレンダリングサイクルとは独立しているため、flushSyncの影響を受けず、
  // プレビュー期間中ずっとonCloseを確実にガードできる。
  const isInPreviewRef = useRef(false)

  // カテゴリマップの取得
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categories = await fetchCategories()
        const map = new Map<string, number>()
        categories.forEach(category => {
          map.set(category.name, category.categoryId)
        })
        setCategoryMap(map)
      } catch {
        // カテゴリー読み込みに失敗してもアプリは継続
      }
    }

    loadCategories()
  }, [])

  // フィルター適用ハンドラー
  const handleApplyFilter = (conditions: FilterConditions) => {
    const transformedCategories = transformCategories(conditions.categories)
    const categoryIds = categoryNamesToIds(transformedCategories, categoryMap)

    const apiParams: MapViewFilterParams = {
      subject_categories: categoryIds.length > 0 ? categoryIds : undefined,
      months: conditions.months.length > 0 ? transformMonths(conditions.months) : undefined,
      times_of_day: conditions.timesOfDay.length > 0 ? transformTimesOfDay(conditions.timesOfDay) : undefined,
      weathers: conditions.weathers.length > 0 ? transformWeathers(conditions.weathers) : undefined,
      tags: conditions.tags.length > 0 ? conditions.tags : undefined,
      device_type: conditions.deviceType,
      max_age_years: conditions.maxAgeYears,
      aspect_ratio: conditions.aspectRatio,
      focal_length_range: conditions.focalLengthRange,
      max_iso: conditions.maxIso,
    }

    setMapFilterParams(apiParams)
  }

  // 投稿ボタンクリックハンドラー
  const handlePostClick = () => {
    if (user) {
      dialog.open('photoContribution')
    } else {
      dialog.open('loginRequired')
    }
  }

  /**
   * 写真投稿ハンドラー
   * Issue#9: 写真アップロード処理
   * 1. Presigned URL取得
   * 2. S3へアップロード
   * 3. メタデータ保存
   * 4. マップ更新
   */
  const handlePhotoSubmit = async (data: {
    file: File
    title: string
    categories: string[]
    tags: string[]
    position: { lat: number; lng: number }
    weather?: string
    takenAt?: string
    shootingDirection?: number
    cropCenterX?: number
    cropCenterY?: number
    cropZoom?: number
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
  }) => {
    // ファイル拡張子とContent-Typeを取得
    const extension = data.file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const contentType = data.file.type || 'image/jpeg'

    try {
      // 1. Presigned URL取得
      const { uploadUrl, objectKey } = await getPhotoUploadUrl({
        extension,
        contentType,
      })

      // 2. S3へアップロード
      await uploadFileToS3(uploadUrl, data.file)

      // 3. メタデータ保存（EXIF情報を含む）
      await createPhoto({
        title: data.title,
        s3ObjectKey: objectKey,
        takenAt: data.takenAt || new Date().toISOString(),
        latitude: data.position.lat,
        longitude: data.position.lng,
        categories: data.categories,
        tags: data.tags,
        weather: data.weather,
        shootingDirection: data.shootingDirection,
        cameraBody: data.exif?.cameraBody,
        cameraLens: data.exif?.cameraLens,
        focalLength35mm: data.exif?.focalLength35mm,
        fValue: data.exif?.fValue,
        shutterSpeed: data.exif?.shutterSpeed,
        iso: data.exif?.iso,
        imageWidth: data.exif?.imageWidth,
        imageHeight: data.exif?.imageHeight,
        cropCenterX: data.cropCenterX,
        cropCenterY: data.cropCenterY,
        cropZoom: data.cropZoom,
      })

      // 4. マップ更新
      mapRef.current?.refreshSpots()
    } catch (error) {
      // 認証エラーの場合はログアウトしてログインダイアログを表示
      if (error instanceof ApiError && error.isUnauthorized) {
        logout()
        dialog.close('photoContribution')
        dialog.open('loginRequired')
      }
      throw error
    }
  }

  // ログアウトハンドラー
  const handleLogout = () => {
    logout()
    dialog.close('topMenu')
  }

  // マイページハンドラー
  const handleShowProfile = () => {
    setViewingUser(null)
    setProfileInitialTab('posts')
    dialog.open('profile')
  }

  // 行きたい場所リストハンドラー
  const handleShowWantToGoList = () => {
    dialog.open('wantToGoList')
  }

  // 写真詳細のユーザークリックハンドラー
  const handleUserClick = (clickedUser: { userId: number; username: string }) => {
    setViewingUser(clickedUser)
    setProfileInitialTab('posts')
    dialog.open('profile')
  }

  // スポットクリックハンドラー（MapViewから呼び出される）
  const handleSpotClick = (spotId: number) => {
    if (shootingLocationPreview) {
      handleReturnFromPreview()
      return
    }
    setSelectedSpotId(spotId)
    dialog.open('photoDetail')
  }

  // ミニマップクリックハンドラー（撮影地点プレビュー開始）
  const handleMinimapClick = (location: { lat: number; lng: number }) => {
    isInPreviewRef.current = true
    setShootingLocationPreview(location)
    mapRef.current?.showShootingLocationPin(location.lat, location.lng)
  }

  // プレビューからの復帰ハンドラー（refでガード、依存配列を空に保つ）
  const handleReturnFromPreview = useCallback(() => {
    if (!shootingLocationPreviewRef.current) return
    setShootingLocationPreview(null)
    mapRef.current?.clearShootingLocationPin()
    // Issue#50: 500ms遅延でフラグをクリア
    // モバイルタッチ時、Radixのflushyncやブラウザの遅延イベント（focusin等）が
    // 予測不能なタイミングでonDismissを呼ぶ可能性がある。
    // スライドアップアニメーション（400ms）完了後まで全dismiss操作をブロックする。
    setTimeout(() => {
      if (!shootingLocationPreviewRef.current) {
        isInPreviewRef.current = false
      }
    }, 500)
  }, [])

  // ライトボックス表示ハンドラー
  const handleShowLightbox = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl)
    dialog.open('lightbox')
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* MapView - メインコンテンツ（z-0で最下層に配置、画面全体を覆う） */}
      <div className="absolute inset-0 z-0">
        <MapView
          ref={mapRef}
          filterParams={mapFilterParams}
          onSpotClick={handleSpotClick}
          onMapClick={handleReturnFromPreview}
        />
      </div>

      {/* フローティングUI - 左上: フィルターボタン、右上: メニューボタン（プレビュー中は非表示） */}
      {!shootingLocationPreview && <div className="absolute top-4 left-6 right-6 z-10 flex items-start justify-between gap-3">
        <Button
          variant="secondary"
          size="icon"
          className="shadow-lg w-18 h-10 hover:bg-secondary"
          onClick={() => dialog.open('filterPanel')}
          aria-label="フィルター"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </Button>

        <Button
          variant="secondary"
          size="icon"
          className="shadow-lg w-18 h-10 hover:bg-secondary"
          onClick={() => dialog.open('topMenu')}
          aria-label="メニュー"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>}

      {/* フローティングUI - 右下: 現在位置ボタン + ズームボタン + 投稿ボタン */}
      <div
        className="absolute right-6 z-10 flex flex-col items-center gap-3"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* ズームボタン（PC表示のみ） */}
        <div className="hidden md:flex flex-col items-center gap-1.5">
          <Button
            variant="secondary"
            className="rounded-full shadow-lg hover:bg-secondary"
            style={{ width: '42px', height: '42px' }}
            onClick={() => mapRef.current?.zoomIn()}
            aria-label="ズームイン"
          >
            <Plus className="w-5 h-5" />
          </Button>
          <Button
            variant="secondary"
            className="rounded-full shadow-lg hover:bg-secondary"
            style={{ width: '42px', height: '42px' }}
            onClick={() => mapRef.current?.zoomOut()}
            aria-label="ズームアウト"
          >
            <Minus className="w-5 h-5" />
          </Button>
        </div>

        {/* 現在位置ボタン */}
        <Button
          variant="secondary"
          className="w-10.5 h-10.5 rounded-full shadow-lg hover:bg-secondary"
          style={{ width: '42px', height: '42px' }}
          onClick={() => mapRef.current?.centerOnUserLocation()}
          aria-label="現在位置"
        >
          <LocateFixed className="w-5 h-5" />
        </Button>

        {/* 投稿ボタン（プレビュー中は非表示） */}
        {!shootingLocationPreview && (
          <Button
            className={`${FLOATING_BUTTON_STYLES.fab} hover:bg-primary`}
            onClick={handlePostClick}
            aria-label="投稿"
          >
            <Plus className="w-6 h-6" />
          </Button>
        )}
      </div>

      {/* パネル・ダイアログ群 */}
      <FilterPanel
        {...dialog.getProps('filterPanel')}
        onApply={handleApplyFilter}
      />

      <TopMenuPanel
        {...dialog.getProps('topMenu')}
        isLoggedIn={!!user}
        onMyPageClick={handleShowProfile}
        onFavoritesClick={handleShowWantToGoList}
        onAccountSettingsClick={() => dialog.open('accountSettings')}
        onAboutClick={() => dialog.open('about')}
        onTermsClick={() => dialog.open('terms')}
        onPrivacyClick={() => dialog.open('privacy')}
        onLoginClick={() => dialog.open('login')}
        onSignUpClick={() => dialog.open('signUp')}
        onLogout={handleLogout}
      />

      <AboutDialog {...dialog.getProps('about')} />

      <LoginRequiredDialog
        {...dialog.getProps('loginRequired')}
        onShowLogin={() => dialog.open('login')}
        onShowSignUp={() => dialog.open('signUp')}
      />

      <LoginDialog
        {...dialog.getProps('login')}
        onShowSignUp={() => dialog.open('signUp')}
        onShowPasswordReset={() => dialog.open('passwordReset')}
      />

      <SignUpDialog
        {...dialog.getProps('signUp')}
        onShowTerms={() => dialog.open('terms')}
        onShowLogin={() => dialog.open('login')}
      />

      <TermsOfServicePage {...dialog.getProps('terms')} />

      <PrivacyPolicyPage {...dialog.getProps('privacy')} />

      <PasswordResetRequestModal
        open={dialog.isOpen('passwordReset')}
        onClose={() => dialog.close('passwordReset')}
      />

      <PhotoContributionDialog
        {...dialog.getProps('photoContribution')}
        onSubmit={handlePhotoSubmit}
      />

      <WantToGoListDialog {...dialog.getProps('wantToGoList')} />

      {user && (
        <AccountSettingsDialog
          {...dialog.getProps('accountSettings')}
          currentEmail={user.email}
        />
      )}

      {/* ProfileDialog - ユーザープロフィール表示 */}
      {(user || viewingUser) && (
        <ProfileDialog
          open={dialog.isOpen('profile')}
          onClose={() => {
            dialog.close('profile')
            setViewingUser(null)
          }}
          userProfile={viewingUser ? {
            userId: viewingUser.userId,
            username: viewingUser.username,
            profileImageUrl: null,
            snsLinks: [],
          } : {
            userId: user?.userId ?? 0,
            username: user?.username || '',
            email: user?.email,
            profileImageUrl: null,
            snsLinks: [],
          }}
          isOwnProfile={!viewingUser}
          onSpotClick={handleSpotClick}
          initialTab={profileInitialTab}
        />
      )}

      {/* PhotoDetailDialog - 写真詳細表示 */}
      {selectedSpotId !== null && (
        <PhotoDetailDialog
          open={dialog.isOpen('photoDetail')}
          spotId={selectedSpotId}
          onClose={() => {
            // プレビューモード中はダイアログを閉じない（Radix flushSync対策）
            // モバイルタッチ時、RadixがflushSyncでisSlideDown=falseをコミットした後に
            // onPointerDownOutsideが評価されるため、state依存では防げない。
            // refはflushSyncの影響を受けないため、プレビュー中を確実にガードできる。
            if (isInPreviewRef.current) return
            dialog.close('photoDetail')
            setSelectedSpotId(null)
            setShootingLocationPreview(null)
            mapRef.current?.clearShootingLocationPin()
          }}
          onUserClick={handleUserClick}
          onImageClick={handleShowLightbox}
          isLightboxOpen={dialog.isOpen('lightbox')}
          onMinimapClick={handleMinimapClick}
          isSlideDown={!!shootingLocationPreview}
        />
      )}

      {/* PhotoLightbox - 写真拡大表示 */}
      <PhotoLightbox
        open={dialog.isOpen('lightbox')}
        onOpenChange={(open) => {
          if (!open) {
            dialog.close('lightbox')
            setSelectedImageUrl('')
          }
        }}
        imageUrl={selectedImageUrl}
      />
    </div>
  )
}

/**
 * メインアプリコンテント（スプラッシュスクリーン付き）
 */
function MainApp() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), SPLASH_SCREEN_DURATION_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <AnimatePresence>
        {isLoading && <SplashScreen />}
      </AnimatePresence>
      {!isLoading && <MainContent />}
      <Toaster />
    </>
  )
}

/**
 * App コンポーネント
 * ルーティングとAuthProviderを管理
 */
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/photo-viewer/:photoId" element={<PhotoViewerPage />} />
        <Route path="/" element={<MainApp />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
