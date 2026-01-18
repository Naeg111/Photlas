import { useState, useEffect } from 'react'
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
import MapView from './components/MapView'
import type { MapViewFilterParams } from './components/MapView'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { transformMonths, transformTimesOfDay, transformWeathers, transformCategories, categoryNamesToIds } from './utils/filterTransform'
import { fetchCategories } from './utils/apiClient'
import { SPLASH_SCREEN_DURATION_MS } from './config/app'
import { SlidersHorizontal, Menu, Plus } from 'lucide-react'
import { Button } from './components/ui/button'
import { Toaster } from './components/ui/sonner'

/**
 * App コンポーネント
 * Issue#28: App.tsx再構築と不要ファイル削除
 *
 * React Routerを削除し、モーダルベースのナビゲーションに移行。
 * 全てのダイアログ状態をApp.tsxで集中管理。
 */

/**
 * MainContent コンポーネント
 * useAuthを使用するためAuthProvider内で使用
 */
function MainContent() {
  const { user, logout } = useAuth()

  // フィルター関連の状態
  const [mapFilterParams, setMapFilterParams] = useState<MapViewFilterParams | undefined>(undefined)
  const [categoryMap, setCategoryMap] = useState<Map<string, number>>(new Map())

  // パネル・ダイアログの状態管理
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [topMenuOpen, setTopMenuOpen] = useState(false)
  const [loginRequiredOpen, setLoginRequiredOpen] = useState(false)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [signUpDialogOpen, setSignUpDialogOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [passwordResetOpen, setPasswordResetOpen] = useState(false)
  const [photoContributionOpen, setPhotoContributionOpen] = useState(false)
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

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
      setPhotoContributionOpen(true)
    } else {
      setLoginRequiredOpen(true)
    }
  }

  // ダイアログ遷移ハンドラー
  const handleShowLogin = () => {
    setLoginDialogOpen(true)
  }

  const handleShowSignUp = () => {
    setSignUpDialogOpen(true)
  }

  const handleShowTerms = () => {
    setTermsOpen(true)
  }

  const handleShowPrivacy = () => {
    setPrivacyOpen(true)
  }

  const handleShowPasswordReset = () => {
    setPasswordResetOpen(true)
  }

  const handleShowAccountSettings = () => {
    setAccountSettingsOpen(true)
  }

  const handleShowProfile = () => {
    setProfileOpen(true)
  }

  const handleLogout = () => {
    logout()
    setTopMenuOpen(false)
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* MapView - メインコンテンツ */}
      <div className="absolute inset-0">
        <MapView filterParams={mapFilterParams} />
      </div>

      {/* フローティングUI - 左上: フィルターボタン */}
      <div className="absolute top-4 left-4 z-10">
        <Button
          variant="outline"
          className="bg-white shadow-lg gap-2"
          onClick={() => setFilterPanelOpen(true)}
          aria-label="フィルター"
        >
          <SlidersHorizontal className="w-4 h-4" />
          フィルター
        </Button>
      </div>

      {/* フローティングUI - 右上: メニューボタン */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="outline"
          className="bg-white shadow-lg gap-2"
          onClick={() => setTopMenuOpen(true)}
          aria-label="メニュー"
        >
          <Menu className="w-4 h-4" />
          メニュー
        </Button>
      </div>

      {/* フローティングUI - 右下: 投稿ボタン (FAB) */}
      <div className="absolute bottom-6 right-6 z-10">
        <Button
          className="w-14 h-14 rounded-full shadow-lg"
          onClick={handlePostClick}
          aria-label="投稿"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* パネル・ダイアログ群 */}
      <FilterPanel
        open={filterPanelOpen}
        onOpenChange={setFilterPanelOpen}
        onApply={handleApplyFilter}
      />

      <TopMenuPanel
        open={topMenuOpen}
        onOpenChange={setTopMenuOpen}
        isLoggedIn={!!user}
        onMyPageClick={handleShowProfile}
        onAccountSettingsClick={handleShowAccountSettings}
        onTermsClick={handleShowTerms}
        onPrivacyClick={handleShowPrivacy}
        onLoginClick={handleShowLogin}
        onSignUpClick={handleShowSignUp}
        onLogout={handleLogout}
      />

      <LoginRequiredDialog
        open={loginRequiredOpen}
        onOpenChange={setLoginRequiredOpen}
        onShowLogin={handleShowLogin}
        onShowSignUp={handleShowSignUp}
      />

      <LoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
        onShowSignUp={handleShowSignUp}
        onShowPasswordReset={handleShowPasswordReset}
      />

      <SignUpDialog
        open={signUpDialogOpen}
        onOpenChange={setSignUpDialogOpen}
        onShowTerms={handleShowTerms}
        onShowLogin={handleShowLogin}
      />

      <TermsOfServicePage
        open={termsOpen}
        onOpenChange={setTermsOpen}
      />

      <PrivacyPolicyPage
        open={privacyOpen}
        onOpenChange={setPrivacyOpen}
      />

      <PasswordResetRequestModal
        open={passwordResetOpen}
        onClose={() => setPasswordResetOpen(false)}
      />

      <PhotoContributionDialog
        open={photoContributionOpen}
        onOpenChange={setPhotoContributionOpen}
      />

      {user && (
        <>
          <AccountSettingsDialog
            open={accountSettingsOpen}
            onOpenChange={setAccountSettingsOpen}
            currentEmail={user.email}
          />

          <ProfileDialog
            open={profileOpen}
            onOpenChange={setProfileOpen}
          />
        </>
      )}
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
