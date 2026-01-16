import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import FilterButton from './components/FilterButton'
import { FilterPanel } from './components/FilterPanel'
import type { FilterConditions } from './components/FilterPanel'
import MapView from './components/MapView'
import type { MapViewFilterParams } from './components/MapView'
import CategoryButtons from './components/CategoryButtons'
import PostButton from './components/PostButton'
import MenuButton from './components/MenuButton'
import LogoutButton from './components/LogoutButton'
import RegisterPage from './pages/RegisterPage'
import RegisterSuccessPage from './pages/RegisterSuccessPage'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import PhotoViewerPage from './pages/PhotoViewerPage'
import { AuthProvider } from './contexts/AuthContext'
import { transformMonths, transformTimesOfDay, transformWeathers, transformCategories, categoryNamesToIds } from './utils/filterTransform'
import { fetchCategories } from './utils/apiClient'

/**
 * HomePage コンポーネント
 * Issue#1, #16: メイン画面（地図ベースUI + フィルター機能）
 *
 * 地図の上にフローティングUI要素を配置。
 */
function HomePage() {
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [mapFilterParams, setMapFilterParams] = useState<MapViewFilterParams | undefined>(undefined);
  const [categoryMap, setCategoryMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categories = await fetchCategories();
        const map = new Map<string, number>();
        categories.forEach(category => {
          map.set(category.name, category.categoryId);
        });
        setCategoryMap(map);
      } catch (error) {
        // カテゴリー読み込みに失敗してもアプリは継続
      }
    };

    loadCategories();
  }, []);

  const handleApplyFilter = (conditions: FilterConditions) => {
    const transformedCategories = transformCategories(conditions.categories);
    const categoryIds = categoryNamesToIds(transformedCategories, categoryMap);

    const apiParams: MapViewFilterParams = {
      subject_categories: categoryIds.length > 0 ? categoryIds : undefined,
      months: conditions.months.length > 0 ? transformMonths(conditions.months) : undefined,
      times_of_day: conditions.timesOfDay.length > 0 ? transformTimesOfDay(conditions.timesOfDay) : undefined,
      weathers: conditions.weathers.length > 0 ? transformWeathers(conditions.weathers) : undefined
    };

    setMapFilterParams(apiParams);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div className="absolute inset-0">
        <MapView filterParams={mapFilterParams} />
      </div>

      <div className="absolute top-4 left-4 z-10">
        <FilterButton onClick={() => setFilterPanelOpen(true)} />
      </div>

      <FilterPanel
        open={filterPanelOpen}
        onOpenChange={setFilterPanelOpen}
        onApply={handleApplyFilter}
      />

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 max-w-sm">
        <CategoryButtons />
      </div>

      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <LogoutButton />
        <MenuButton />
      </div>

      <div className="absolute bottom-6 right-6 z-10">
        <PostButton />
      </div>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-700 mb-4">ページが見つかりません</h1>
        <p className="text-gray-500">お探しのページは存在しません。</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/success" element={<RegisterSuccessPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/photo-viewer/:photoId" element={<PhotoViewerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
