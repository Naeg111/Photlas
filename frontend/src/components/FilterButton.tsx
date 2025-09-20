/**
 * FilterButton コンポーネント
 * Issue#1: 基本レイアウトのフィルターボタン
 * 
 * TDD Green段階: テストを通すための最小実装
 */
function FilterButton() {
  return (
    <button className="bg-white shadow-lg rounded-lg px-4 py-2 border hover:bg-gray-50 transition-colors text-sm font-medium">
      フィルター
    </button>
  );
}

export default FilterButton;
