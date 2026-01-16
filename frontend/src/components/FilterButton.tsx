/**
 * FilterButton コンポーネント
 * Issue#1, #16: フィルター機能へのエントリーポイント
 *
 * 左上に配置されるフローティングボタン。クリック時にフィルターパネルを開く。
 */
interface FilterButtonProps {
  onClick?: () => void;
}

function FilterButton({ onClick }: FilterButtonProps) {
  return (
    <button
      className="bg-white shadow-lg rounded-lg border px-4 py-2 hover:bg-gray-50 transition-colors text-sm font-medium"
      aria-label="写真フィルター機能を開く"
      title="写真の絞り込み条件を設定できます"
      onClick={onClick}
    >
      フィルター
    </button>
  );
}

export default FilterButton;
