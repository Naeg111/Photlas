/**
 * CategoryButtons コンポーネント
 * Issue#1: プロジェクトセットアップと基本レイアウト
 *
 * 写真カテゴリーの選択・切り替え機能を提供する横スクロール可能なボタン群。
 */
function CategoryButtons() {
  const categories = ['風景', '建築', 'ストリート', 'ポートレート', '乗り物'];

  return (
    <div
      role="group"
      data-testid="category-buttons"
      className="flex space-x-2 overflow-x-auto"
    >
      {categories.map((category) => (
        <button
          key={category}
          className="bg-white shadow-md rounded-full border px-3 py-1 whitespace-nowrap text-sm hover:bg-blue-50 transition-colors"
        >
          {category}
        </button>
      ))}
    </div>
  );
}

export default CategoryButtons;
