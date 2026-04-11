/**
 * FilterButton コンポーネント
 * Issue#1, #16: フィルター機能へのエントリーポイント
 *
 * 左上に配置されるフローティングボタン。クリック時にフィルターパネルを開く。
 */
import { useTranslation } from "react-i18next";

interface FilterButtonProps {
  onClick?: () => void;
}

function FilterButton({ onClick }: Readonly<FilterButtonProps>) {
  const { t } = useTranslation();
  return (
    <button
      className="bg-white shadow-lg rounded-lg border px-4 py-2 text-sm font-medium"
      aria-label={t('filter.openFilter')}
      title={t('filter.filterDescription')}
      onClick={onClick}
    >
      {t('filter.title')}
    </button>
  );
}

export default FilterButton;
