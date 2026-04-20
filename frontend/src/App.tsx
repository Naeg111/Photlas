import { useState, useEffect, useRef, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { SplashScreen } from './components/SplashScreen'
import PasswordRecommendationBanner from './components/PasswordRecommendationBanner'
import NotFoundPage from './pages/NotFoundPage'
import EmailVerificationPage from './pages/EmailVerificationPage'
import AdminModerationPage from './pages/AdminModerationPage'
import AdminDeletedUsersPage from './pages/AdminDeletedUsersPage'
import AdminDeletedUserDetailPage from './pages/AdminDeletedUserDetailPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ReviewLocationPage from './pages/ReviewLocationPage'
import ConfirmEmailChangePage from './pages/ConfirmEmailChangePage'
import OAuthCallbackPage from './pages/OAuthCallbackPage'
import { CookieConsentBanner } from './components/CookieConsentBanner'
import { formatLocalDateTime } from './utils/extractExif'
import { FilterPanel } from './components/FilterPanel'
import type { FilterConditions } from './components/FilterPanel'
import { PlaceSearchDialog } from './components/PlaceSearchDialog'
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
// import { WantToGoListDialog } from './components/WantToGoListDialog' // 行きたい場所リスト（一時非表示）
import { AboutDialog } from './components/AboutDialog'
import { PhotoLightbox } from './components/PhotoLightbox'
import MapView from './components/MapView'
import type { MapViewFilterParams, MapViewHandle } from './components/MapView'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useDialogState } from './hooks/useDialogState'
import { transformMonths, transformTimesOfDay, transformWeathers, transformDeviceTypes, transformCategories, categoryNamesToIds } from './utils/filterTransform'
import { fetchCategories, getPhotoUploadUrl, uploadFileToS3, createPhoto, ApiError, getAuthHeaders } from './utils/apiClient'
import { MODERATION_STATUS_PUBLISHED, MODERATION_STATUS_QUARANTINED, ROLE_ADMIN } from './utils/codeConstants'
import { stripExif } from './utils/stripExif'
import { SPLASH_SCREEN_DURATION_MS } from './config/app'
import { SlidersHorizontal, Menu, Plus, Minus, LocateFixed, Search } from 'lucide-react'
import { CompassIcon } from './components/CompassIcon'
import { Button } from './components/ui/button'
import { Toaster } from './components/ui/sonner'
import { toast } from 'sonner'
import { API_V1_URL } from './config/api'

/**
 * App コンポーネント
 * Issue#28: App.tsx再構築と不要ファイル削除
 *
 * React Routerを削除し、モーダルベースのナビゲーションに移行。
 * 全てのダイアログ状態をuseDialogStateフックで集中管理。
 */

/** フローティングボタンの共通サイズ */
const FLOATING_BUTTON_SIZE = { width: '42px', height: '42px' } as const

/** フローティングボタンの共通スタイル */
const FLOATING_BUTTON_STYLES = {
  outline: 'bg-white shadow-lg gap-2',
  fab: 'w-14 h-14 rounded-full shadow-lg',
} as const

interface MainContentProps {
  onMapReady?: () => void
}

/**
 * MainContent コンポーネント
 * useAuthを使用するためAuthProvider内で使用
 */
function MainContent({ onMapReady }: Readonly<MainContentProps>) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const dialog = useDialogState()
  const mapRef = useRef<MapViewHandle>(null)

  // フィルター関連の状態
  const [mapFilterParams, setMapFilterParams] = useState<MapViewFilterParams | undefined>(undefined)
  const [categoryMap, setCategoryMap] = useState<Map<string, number>>(new Map())

  // 写真詳細・ライトボックス関連の状態
  const [selectedSpotIds, setSelectedSpotIds] = useState<number[] | null>(null)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('')

  // プロフィールダイアログの初期タブ
  const [profileInitialTab, setProfileInitialTab] = useState<'posts' | 'favorites'>('posts')

  // 他ユーザーのプロフィール表示用の状態
  const [viewingUser, setViewingUser] = useState<{ userId: number; username: string } | null>(null)

  // Issue#57: プロフィール投稿一覧からPhotoDetailDialogを開いたかのフラグ
  const [isPhotoFromProfile, setIsPhotoFromProfile] = useState(false)
  // 写真削除後のプロフィール写真一覧再取得トリガー
  const [refreshPhotosKey, setRefreshPhotosKey] = useState(0)
  // Radixフォーカス管理のタイミング問題回避用ref（stateより先に参照可能）
  const isPhotoFromProfileRef = useRef(false)

  // プロフィールから開いた写真のID（deepLinkPhotoIdとは別管理でnavigate不要）
  const [profilePhotoId, setProfilePhotoId] = useState<number | undefined>(undefined)

  // Issue#58: ディープリンク用の写真ID
  const { photoId: deepLinkPhotoIdParam } = useParams<{ photoId?: string }>()
  const [deepLinkPhotoId, setDeepLinkPhotoId] = useState<number | undefined>(
    deepLinkPhotoIdParam ? Number(deepLinkPhotoIdParam) : undefined
  )

  // プロフィールダイアログのスライドダウン状態
  const [profileSlideDown, setProfileSlideDown] = useState(false)
  const profileSlideDownRef = useRef(false)
  profileSlideDownRef.current = profileSlideDown

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

  // Issue#54: モデレーションステータスポーリング
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startModerationPolling = useCallback((photoId: number) => {
    // 既存のポーリングをクリア
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    const POLLING_INTERVAL_MS = 2000
    const MAX_POLLING_COUNT = 15 // 最大30秒間

    let pollCount = 0

    pollingIntervalRef.current = setInterval(async () => {
      pollCount++

      if (pollCount > MAX_POLLING_COUNT) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        toast.info('写真は審査中です。審査完了後に公開されます。')
        return
      }

      try {
        const response = await fetch(`${API_V1_URL}/photos/${photoId}/status`, {
          headers: getAuthHeaders(),
        })

        if (!response.ok) return

        const data = await response.json()
        const status = data.moderation_status

        if (status === MODERATION_STATUS_PUBLISHED) {
          toast.success('写真が公開されました')
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          mapRef.current?.refreshSpots()
        } else if (status === MODERATION_STATUS_QUARANTINED) {
          toast.error('写真がコンテンツポリシーに違反している可能性があります')
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
        }
      } catch {
        // ネットワークエラーは無視（次回ポーリングで再試行）
      }
    }, POLLING_INTERVAL_MS)
  }, [])

  // コンポーネントアンマウント時にポーリングをクリア
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  // Issue#56: パスワードリセット完了後のLoginDialog自動表示
  useEffect(() => {
    if (location.state?.openLogin) {
      dialog.open('login')
      globalThis.history.replaceState({}, '')
    }
  }, [location.state])

  // Issue#58: ディープリンクでPhotoDetailDialogを自動表示
  useEffect(() => {
    if (deepLinkPhotoId) {
      dialog.open('photoDetail')
    }
  }, [deepLinkPhotoId])

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
      device_types: conditions.deviceTypes && conditions.deviceTypes.length > 0 ? transformDeviceTypes(conditions.deviceTypes) : undefined,
      max_age_days: conditions.maxAgeDays,
      aspect_ratios: conditions.aspectRatios && conditions.aspectRatios.length > 0 ? conditions.aspectRatios : undefined,
      focal_length_ranges: conditions.focalLengthRanges && conditions.focalLengthRanges.length > 0 ? conditions.focalLengthRanges : undefined,
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
    placeName?: string
    categories: string[]
    position: { lat: number; lng: number }
    weather?: number
    takenAt?: string
    deviceType: number
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

      // 2. メタデータ保存（EXIF情報を含む）
      const photoResponse = await createPhoto({
        placeName: data.placeName,
        s3ObjectKey: objectKey,
        takenAt: data.takenAt || formatLocalDateTime(new Date()),
        latitude: data.position.lat,
        longitude: data.position.lng,
        categories: data.categories,
        weather: data.weather,
        deviceType: data.deviceType,
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

      // 3. EXIF情報を削除して画像を再エンコード
      const strippedBlob = await stripExif(data.file)

      // 4. EXIF削除済み画像をS3へアップロード
      await uploadFileToS3(uploadUrl, strippedBlob)

      // 5. マップ更新
      mapRef.current?.refreshSpots()

      // 6. Issue#54: モデレーションステータスのポーリング開始
      if (photoResponse?.photo?.photoId) {
        startModerationPolling(photoResponse.photo.photoId)
      }
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
    toast('ログアウトしました')
  }

  // マイページハンドラー
  const handleShowProfile = () => {
    setViewingUser(null)
    setProfileInitialTab('posts')
    dialog.open('profile')
  }

  // 行きたい場所リストハンドラー（一時非表示）
  // const handleShowWantToGoList = () => {
  //   dialog.open('wantToGoList')
  // }

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
    setIsPhotoFromProfile(false)
    setSelectedSpotIds([spotId])
    dialog.open('photoDetail')
  }

  // Issue#77: プロフィール投稿一覧からの写真クリックハンドラー（photoId方式）
  const handleProfilePhotoClick = (photoId: number) => {
    isPhotoFromProfileRef.current = true
    setIsPhotoFromProfile(true)
    setProfilePhotoId(photoId)
    dialog.open('photoDetail')
  }

  // クラスタクリックハンドラー（MapViewから呼び出される）
  const handleClusterClick = (spotIds: number[]) => {
    if (shootingLocationPreview) {
      handleReturnFromPreview()
      return
    }
    setSelectedSpotIds(spotIds)
    dialog.open('photoDetail')
  }

  // ミニマップクリックハンドラー（撮影地点プレビュー開始）
  const handleMinimapClick = (location: { lat: number; lng: number }) => {
    isInPreviewRef.current = true
    setShootingLocationPreview(location)
    mapRef.current?.showShootingLocationPin(location.lat, location.lng)
    if (isPhotoFromProfileRef.current) {
      setProfileSlideDown(true)
    }
  }

  // プレビューからの復帰ハンドラー（refでガード、依存配列を空に保つ）
  const handleReturnFromPreview = useCallback(() => {
    if (!shootingLocationPreviewRef.current) return
    if (profileSlideDownRef.current) {
      setProfileSlideDown(false)
      setShootingLocationPreview(null)
      mapRef.current?.clearShootingLocationPin()
      setTimeout(() => {
        if (!shootingLocationPreviewRef.current) {
          isInPreviewRef.current = false
        }
      }, 500)
    } else {
      setShootingLocationPreview(null)
      mapRef.current?.clearShootingLocationPin()
      setTimeout(() => {
        if (!shootingLocationPreviewRef.current) {
          isInPreviewRef.current = false
        }
      }, 500)
    }
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
          onClusterClick={handleClusterClick}
          onMapClick={handleReturnFromPreview}
          onMapReady={onMapReady}
        />
      </div>

      {/* フローティングUI - 左上: フィルターボタン、右上: メニューボタン（プレビュー中は非表示） */}
      {!shootingLocationPreview && <div className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] left-6 right-6 z-10 flex items-start justify-between gap-3">
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
        {/* Issue#69: 場所検索ボタン（PC表示: ズームボタンの上） */}
        <Button
          variant="secondary"
          className="hidden md:flex rounded-full shadow-lg hover:bg-secondary"
          style={FLOATING_BUTTON_SIZE}
          onClick={() => dialog.open('placeSearch')}
          aria-label="場所検索"
        >
          <Search className="w-5 h-5" />
        </Button>

        {/* ズームボタン（PC表示のみ） */}
        <div className="hidden md:flex flex-col items-center gap-1.5">
          <Button
            variant="secondary"
            className="rounded-full shadow-lg hover:bg-secondary"
            style={FLOATING_BUTTON_SIZE}
            onClick={() => mapRef.current?.zoomIn()}
            aria-label="ズームイン"
          >
            <Plus className="w-5 h-5" />
          </Button>
          <Button
            variant="secondary"
            className="rounded-full shadow-lg hover:bg-secondary"
            style={FLOATING_BUTTON_SIZE}
            onClick={() => mapRef.current?.zoomOut()}
            aria-label="ズームアウト"
          >
            <Minus className="w-5 h-5" />
          </Button>
        </div>

        {/* Issue#69: 場所検索ボタン（モバイル表示: ノースヘディングの上） */}
        <Button
          variant="secondary"
          className="md:hidden rounded-full shadow-lg hover:bg-secondary"
          style={FLOATING_BUTTON_SIZE}
          onClick={() => dialog.open('placeSearch')}
          aria-label="場所検索"
        >
          <Search className="w-5 h-5" />
        </Button>

        {/* ノースヘディングボタン */}
        <Button
          variant="secondary"
          className="rounded-full shadow-lg hover:bg-secondary"
          style={FLOATING_BUTTON_SIZE}
          onClick={() => mapRef.current?.resetNorthHeading()}
          aria-label="ノースヘディング"
        >
          <CompassIcon className="w-5 h-5" />
        </Button>

        {/* 現在位置ボタン */}
        <Button
          variant="secondary"
          className="rounded-full shadow-lg hover:bg-secondary"
          style={FLOATING_BUTTON_SIZE}
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

      {/* Issue#69: 場所検索ダイアログ */}
      <PlaceSearchDialog
        {...dialog.getProps('placeSearch')}
        onPlaceSelect={(lng, lat, zoom) => {
          mapRef.current?.flyToPlace(lng, lat, zoom)
        }}
      />

      {/* パネル・ダイアログ群 */}
      <FilterPanel
        {...dialog.getProps('filterPanel')}
        onApply={handleApplyFilter}
      />

      <TopMenuPanel
        {...dialog.getProps('topMenu')}
        isLoggedIn={!!user}
        isAdmin={user?.role === ROLE_ADMIN}
        onMyPageClick={handleShowProfile}
        // onFavoritesClick={handleShowWantToGoList} // 行きたい場所リスト（一時非表示）
        onAccountSettingsClick={() => dialog.open('accountSettings')}
        onModerationClick={() => navigate('/manage/moderation')}
        onDeletedUsersClick={() => navigate('/manage/deleted-users')}
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

      <CookieConsentBanner onPrivacyPolicyClick={() => dialog.open('privacy')} />

      <PasswordResetRequestModal
        open={dialog.isOpen('passwordReset')}
        onClose={() => dialog.close('passwordReset')}
        onShowLogin={() => dialog.open('login')}
      />

      <PhotoContributionDialog
        {...dialog.getProps('photoContribution')}
        onSubmit={handlePhotoSubmit}
        onOpenChange={(open) => {
          dialog.getProps('photoContribution').onOpenChange(open)
          if (!open) mapRef.current?.refreshSpots()
        }}
      />

      {/* 行きたい場所リスト（一時非表示）
      <WantToGoListDialog {...dialog.getProps('wantToGoList')} />
      */}

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
            if (isPhotoFromProfileRef.current) return
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
          onPhotoClick={handleProfilePhotoClick}
          initialTab={profileInitialTab}
          isBackgrounded={isPhotoFromProfile}
          isSlideDown={profileSlideDown}
          refreshPhotosKey={refreshPhotosKey}
        />
      )}

      {/* PhotoDetailDialog - 写真詳細表示 */}
      {(selectedSpotIds !== null || deepLinkPhotoId || profilePhotoId) && (
        <PhotoDetailDialog
          open={dialog.isOpen('photoDetail')}
          spotIds={selectedSpotIds ?? []}
          singlePhotoId={deepLinkPhotoId || profilePhotoId}
          onClose={() => {
            // プレビューモード中はダイアログを閉じない（Radix flushSync対策）
            if (isInPreviewRef.current) return
            dialog.close('photoDetail')
            setSelectedSpotIds(null)
            setShootingLocationPreview(null)
            mapRef.current?.clearShootingLocationPin()
            setProfilePhotoId(undefined)
            setProfileSlideDown(false)
            setIsPhotoFromProfile(false)
            // Radix DismissableLayerのフォーカス復帰処理完了後にrefクリア
            setTimeout(() => { isPhotoFromProfileRef.current = false }, 300)
            // Issue#58: ディープリンクから閉じた場合はトップページに遷移
            if (deepLinkPhotoId) {
              setDeepLinkPhotoId(undefined)
              navigate('/', { replace: true })
            }
          }}
          onUserClick={handleUserClick}
          onImageClick={handleShowLightbox}
          isLightboxOpen={dialog.isOpen('lightbox')}
          onMinimapClick={handleMinimapClick}
          isSlideDown={!!shootingLocationPreview}
          isDeletable={isPhotoFromProfile}
          onPhotoDeleted={() => {
            setRefreshPhotosKey(prev => prev + 1)
            mapRef.current?.refreshSpots()
          }}
          filterMaxAgeDays={mapFilterParams?.max_age_days}
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
 *
 * MainContentをスプラッシュの裏で最初からレンダリングし、
 * マップの読み込みを早期に開始する。スプラッシュの解除は
 * 「最低表示時間の経過」かつ「マップの読み込み完了」の両方を満たした時点で行う。
 */
function MainApp() {
  const [isLoading, setIsLoading] = useState(true)
  const isMapReadyRef = useRef(false)
  const isMinDurationPassedRef = useRef(false)

  const tryDismissSplash = useCallback(() => {
    if (isMapReadyRef.current && isMinDurationPassedRef.current) {
      setIsLoading(false)
    }
  }, [])

  const handleMapReady = useCallback(() => {
    isMapReadyRef.current = true
    tryDismissSplash()
  }, [tryDismissSplash])

  useEffect(() => {
    const timer = setTimeout(() => {
      isMinDurationPassedRef.current = true
      tryDismissSplash()
    }, SPLASH_SCREEN_DURATION_MS)
    return () => clearTimeout(timer)
  }, [tryDismissSplash])

  return (
    <>
      <AnimatePresence>
        {isLoading && <SplashScreen />}
      </AnimatePresence>
      {/* Issue#81 Phase 5e: OAuth のみユーザー向けパスワード設定推奨バナー */}
      <PasswordRecommendationBanner />
      <MainContent onMapReady={handleMapReady} />
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
        <Route path="/" element={<MainApp />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/review-location" element={<ReviewLocationPage />} />
        <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/photo-viewer/:photoId" element={<MainApp />} />
        <Route path="/manage/moderation" element={<AdminModerationPage />} />
        <Route path="/manage/deleted-users" element={<AdminDeletedUsersPage />} />
        <Route path="/manage/deleted-users/:userId" element={<AdminDeletedUserDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
