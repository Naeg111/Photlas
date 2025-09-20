/**
 * CategoryButtons コンポーネント
 * Issue#1: 基本レイアウトのカテゴリボタン群
 * 
 * TDD Green段階: テストを通すための最小実装
 */
function CategoryButtons() {
  const categories = ['風景', '建築', 'ストリート', 'ポートレート', '乗り物'];

  return (
    <div role="group" data-testid="category-buttons" className="category-buttons">
      {categories.map((category) => (
        <button
          key={category}
          className="category-button"
        >
          {category}
        </button>
      ))}
    </div>
  );
}

export default CategoryButtons;
