import { useState, useEffect, useRef } from 'react'
import { AnimatePresence } from 'motion/react'
import { SplashScreen } from './components/SplashScreen'
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
import { PhotoLightbox } from './components/PhotoLightbox'
import MapView from './components/MapView'
import type { MapViewFilterParams, MapViewHandle } from './components/MapView'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useDialogState } from './hooks/useDialogState'
import { transformMonths, transformTimesOfDay, transformWeathers, transformCategories, categoryNamesToIds } from './utils/filterTransform'
import { fetchCategories } from './utils/apiClient'
import { SPLASH_SCREEN_DURATION_MS } from './config/app'
import { SlidersHorizontal, Menu, Plus, LocateFixed } from 'lucide-react'
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
      weathers: conditions.weathers.length > 0 ? transformWeathers(conditions.weathers) : undefined
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

  // ログアウトハンドラー
  const handleLogout = () => {
    logout()
    dialog.close('topMenu')
  }

  // マイページハンドラー
  const handleShowProfile = () => {
    dialog.open('profile')
  }

  // スポットクリックハンドラー（MapViewから呼び出される）
  // TODO: MapViewにonSpotClickを追加後に有効化
  // const handleSpotClick = (spotId: number) => {
  //   setSelectedSpotId(spotId)
  //   dialog.open('photoDetail')
  // }

  // ライトボックス表示ハンドラー
  // TODO: PhotoDetailDialogから呼び出されるように修正後に有効化
  // const handleShowLightbox = (imageUrl: string) => {
  //   setSelectedImageUrl(imageUrl)
  //   dialog.open('lightbox')
  // }

  return (
    <div className="relative w-full h-full overflow-hidden isolate">
      {/* MapView - メインコンテンツ（z-0で最下層に配置、画面全体を覆う） */}
      <div className="fixed inset-0 z-0">
        <MapView ref={mapRef} filterParams={mapFilterParams} />
      </div>

      {/* フローティングUI - 左上: フィルターボタン、右上: メニューボタン */}
      <div className="absolute top-4 left-6 right-6 z-10 flex items-start justify-between gap-3">
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
      </div>

      {/* フローティングUI - 右下: 現在位置ボタン + 投稿ボタン (FAB) */}
      <div
        className="absolute right-6 z-10 flex flex-col items-center gap-3"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* 現在位置ボタン（投稿ボタンの75%サイズ） */}
        <Button
          variant="secondary"
          className="w-10.5 h-10.5 rounded-full shadow-lg hover:bg-secondary"
          style={{ width: '42px', height: '42px' }}
          onClick={() => mapRef.current?.centerOnUserLocation()}
          aria-label="現在位置"
        >
          <LocateFixed className="w-5 h-5" />
        </Button>

        {/* 投稿ボタン */}
        <Button
          className={`${FLOATING_BUTTON_STYLES.fab} hover:bg-primary`}
          onClick={handlePostClick}
          aria-label="投稿"
        >
          <Plus className="w-6 h-6" />
        </Button>
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
        onAccountSettingsClick={() => dialog.open('accountSettings')}
        onTermsClick={() => dialog.open('terms')}
        onPrivacyClick={() => dialog.open('privacy')}
        onLoginClick={() => dialog.open('login')}
        onSignUpClick={() => dialog.open('signUp')}
        onLogout={handleLogout}
      />

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

      <PhotoContributionDialog {...dialog.getProps('photoContribution')} />

      {user && (
        <AccountSettingsDialog
          {...dialog.getProps('accountSettings')}
          currentEmail={user.email}
        />
      )}

      {/* ProfileDialog - ユーザープロフィール表示 */}
      {user && (
        <ProfileDialog
          open={dialog.isOpen('profile')}
          onClose={() => dialog.close('profile')}
          userProfile={{
            userId: 0, // TODO: 実際のユーザーIDを取得
            username: user.username || '',
            email: user.email,
            profileImageUrl: null,
            snsLinks: [],
          }}
          isOwnProfile={true}
          photos={[]}
          onPhotoClick={() => {
            // TODO: 写真クリック時の処理
          }}
        />
      )}

      {/* PhotoDetailDialog - 写真詳細表示 */}
      {selectedSpotId !== null && (
        <PhotoDetailDialog
          open={dialog.isOpen('photoDetail')}
          spotId={selectedSpotId}
          onClose={() => {
            dialog.close('photoDetail')
            setSelectedSpotId(null)
          }}
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
 * App コンポーネント
 * SplashScreenとAuthProviderを管理
 */
function App() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), SPLASH_SCREEN_DURATION_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AuthProvider>
      <AnimatePresence>
        {isLoading && <SplashScreen />}
      </AnimatePresence>
      {!isLoading && <MainContent />}
      <Toaster />
    </AuthProvider>
  )
}

export default App
