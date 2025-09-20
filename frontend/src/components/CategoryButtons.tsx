/**
 * CategoryButtons コンポーネント
 * Issue#1: 基本レイアウトのカテゴリボタン群
 * 
 * TDD Green段階: テストを通すための最小実装
 */
function CategoryButtons() {
  const categories = ['風景', '建築', 'ストリート', 'ポートレート', '乗り物'];

  return (
    <div role="group" data-testid="category-buttons" className="flex space-x-2 overflow-x-auto">
      {categories.map((category) => (
        <button
          key={category}
          className="bg-white shadow-md rounded-full px-3 py-1 whitespace-nowrap hover:bg-blue-50 transition-colors border text-sm"
        >
          {category}
        </button>
      ))}
    </div>
  );
}

export default CategoryButtons;
