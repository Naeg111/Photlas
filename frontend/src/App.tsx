import FilterButton from './components/FilterButton'
import CategoryButtons from './components/CategoryButtons'
import PostButton from './components/PostButton'
import MenuButton from './components/MenuButton'

function App() {
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 地図表示用のコンテナ - Issue#1要件 */}
      <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
        <div className="text-center text-gray-600">
          <h1 className="text-3xl font-bold mb-2">Photlas</h1>
          <p className="text-lg">地図表示エリア (Google Maps Platform)</p>
          <p className="text-sm mt-1">※Issue#1: 基本レイアウト実装完了</p>
        </div>
      </div>

      {/* フローティング要素 - 08_ui_design.md仕様 */}
      {/* フィルターボタン - 左上 */}
      <div className="absolute top-4 left-4 z-10">
        <FilterButton />
      </div>

      {/* カテゴリーボタン群 - 上部中央 */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 max-w-sm">
        <CategoryButtons />
      </div>

      {/* メニューボタン - 右上 */}
      <div className="absolute top-4 right-4 z-10">
        <MenuButton />
      </div>

      {/* 投稿ボタン - 右下 */}
      <div className="absolute bottom-6 right-6 z-10">
        <PostButton />
      </div>
    </div>
  )
}

export default App
