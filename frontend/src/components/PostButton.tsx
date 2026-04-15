/**
 * PostButton コンポーネント
 * Issue#1: プロジェクトセットアップと基本レイアウト
 *
 * 新しい写真投稿機能へのエントリーポイント。
 * 右下に固定配置されるフローティングアクションボタン（FAB）。
 */
import { useTranslation } from "react-i18next";

function PostButton() {
  const { t } = useTranslation();
  return (
    <button
      className="bg-blue-500 text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center text-2xl font-bold"
      aria-label={t('photo.postPhoto')}
      title={t('photo.postPhotoTitle')}
    >
      +
    </button>
  );
}

export default PostButton;
