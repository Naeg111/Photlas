/**
 * MenuButton コンポーネント
 * Issue#1: 基本レイアウトのメニューボタン
 * 
 * TDD Green段階: テストを通すための最小実装
 */
function MenuButton() {
  return (
    <button className="bg-white shadow-lg rounded-lg px-4 py-2 border hover:bg-gray-50 transition-colors text-sm font-medium">
      メニュー
    </button>
  );
}

export default MenuButton;
