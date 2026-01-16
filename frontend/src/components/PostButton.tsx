/**
 * PostButton コンポーネント
 * Issue#1: プロジェクトセットアップと基本レイアウト
 *
 * 新しい写真投稿機能へのエントリーポイント。
 * 右下に固定配置されるフローティングアクションボタン（FAB）。
 */
function PostButton() {
  return (
    <button
      className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center text-2xl font-bold transition-colors"
      aria-label="新しい写真を投稿する"
      title="写真を投稿"
    >
      +
    </button>
  );
}

export default PostButton;
