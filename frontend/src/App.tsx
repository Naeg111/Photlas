import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import FilterButton from './components/FilterButton'
import { FilterPanel } from './components/FilterPanel'
import type { FilterConditions } from './components/FilterPanel'
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
 * Issue#1: プロジェクトセットアップと基本レイアウト - メインページ
 * Issue#16: フィルター機能 - フィルター状態管理とUI統合
 *
 * 【目的】
 * - アプリケーションのメイン画面（ルート path="/" ）
 * - 地図ベースのUIレイアウトを提供
 * - UI設計書(08_ui_design.md)に基づくフローティング要素の配置
 *
 * 【レイアウト構成】
 * - 背景: 地図表示エリア（Google Maps Platform統合予定）
 * - 前景: フローティングUI要素群
 * - レスポンシブ対応: モバイル・デスクトップ両対応
 *
 * 【設計パターン】
 * - Overlay Pattern: 地図の上にUI要素を重ねる構成
 * - Floating Action Pattern: 主要機能への快適なアクセス
 * - Z-index Layering: 適切な重ね順での要素配置
 */
function HomePage() {
  // Issue#16: フィルターパネルの開閉状態
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Issue#16: 現在のフィルター条件
  // TODO: Issue#13との統合時にMapViewコンポーネントで使用
  const [_currentFilters, setCurrentFilters] = useState<FilterConditions>({
    categories: [],
    months: [],
    timesOfDay: [],
    weathers: []
  });

  // Issue#16: カテゴリー名→IDマッピング
  const [categoryMap, setCategoryMap] = useState<Map<string, number>>(new Map());

  /**
   * コンポーネントマウント時にカテゴリー一覧を取得
   */
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categories = await fetchCategories();
        const map = new Map<string, number>();
        categories.forEach(category => {
          map.set(category.name, category.categoryId);
        });
        setCategoryMap(map);
        console.log('Categories loaded:', categories.length, 'categories');
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };

    loadCategories();
  }, []);

  /**
   * フィルター適用時のハンドラー
   * Issue#16: フィルター条件を変換してAPI呼び出しを準備
   *
   * TODO: Issue#13との統合 - 地図操作時にもフィルター条件を保持
   * TODO: Spots API呼び出しの実装
   */
  const handleApplyFilter = (conditions: FilterConditions) => {
    // フィルター条件を保存
    setCurrentFilters(conditions);

    // UI値をAPI値に変換
    const transformedCategories = transformCategories(conditions.categories);
    const categoryIds = categoryNamesToIds(transformedCategories, categoryMap);

    const apiParams = {
      subject_categories: categoryIds,
      months: transformMonths(conditions.months),
      times_of_day: transformTimesOfDay(conditions.timesOfDay),
      weathers: transformWeathers(conditions.weathers)
    };

    console.log('Filter applied:', conditions);
    console.log('Transformed API params:', apiParams);

    // TODO: Spots API呼び出し
    // fetchSpots(mapBounds, apiParams);

    // パネルを閉じる (FilterPanel内でonOpenChange(false)が呼ばれる)
  };

  return (
    <div className={
      "relative " +           // 相対位置: 子要素のabsolute配置の基準点
      "w-full h-screen " +    // サイズ: 画面全体（幅100%, 高さ100vh）
      "overflow-hidden"       // オーバーフロー非表示: はみ出し要素をクリップ
    }>
      
      {/* === 地図表示エリア（背景レイヤー） === */}
      {/* 
        Issue#1要件: 全画面を覆う地図表示用コンテナ
        将来的にGoogle Maps Platform APIを統合予定
      */}
      <div className={
        "absolute inset-0 " +        // 位置: 親要素全体を覆う（top:0, right:0, bottom:0, left:0）
        "bg-gray-200 " +             // 背景色: 薄いグレー（地図読み込み前のプレースホルダー）
        "flex items-center justify-center"  // Flexbox: 中央寄せ（開発中表示用）
      }>
        {/* === 開発中表示（プレースホルダー） === */}
        <div className="text-center text-gray-600">
          {/* アプリケーション名 */}
          <h1 className="text-3xl font-bold mb-2">Photlas</h1>
          
          {/* 機能説明 */}
          <p className="text-lg">地図表示エリア (Google Maps Platform)</p>
          
          {/* 実装状況 */}
          <p className="text-sm mt-1">※Issue#1: 基本レイアウト実装完了</p>
        </div>
      </div>

      {/* === フローティングUI要素群（前景レイヤー） === */}
      {/* 
        08_ui_design.md仕様に基づく配置
        地図の上に重ねられる機能ボタン群
        z-10で地図より前面に表示
      */}
      
      {/* === フィルターボタン（左上配置） === */}
      <div className={
        "absolute top-4 left-4 " +   // 位置: 上から16px、左から16px
        "z-10"                       // Z-index: 地図より前面（重ね順10）
      }>
        <FilterButton onClick={() => setFilterPanelOpen(true)} />
      </div>

      {/* === フィルターパネル === */}
      <FilterPanel
        open={filterPanelOpen}
        onOpenChange={setFilterPanelOpen}
        onApply={handleApplyFilter}
      />

      {/* === カテゴリーボタン群（上部中央配置） === */}
      <div className={
        "absolute top-4 " +          // 位置: 上から16px
        "left-1/2 " +                // 位置: 左から50%（水平中央基準点）
        "transform -translate-x-1/2 " +  // 変換: 要素幅の半分だけ左にシフト（完全中央揃え）
        "z-10 " +                    // Z-index: 地図より前面
        "max-w-sm"                   // 最大幅: 384px（レスポンシブ対応）
      }>
        <CategoryButtons />
      </div>

      {/* === メニューボタン（右上配置） === */}
      <div className={
        "absolute top-4 right-4 " +  // 位置: 上から16px、右から16px
        "z-10 " +                    // Z-index: 地図より前面
        "flex gap-2"                 // Flexbox: ボタン間のスペース
      }>
        <LogoutButton />
        <MenuButton />
      </div>

      {/* === 投稿ボタン（右下配置） === */}
      <div className={
        "absolute bottom-6 right-6 " +  // 位置: 下から24px、右から24px
        "z-10"                          // Z-index: 地図より前面
      }>
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
