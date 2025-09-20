/**
 * PostButton コンポーネント
 * Issue#1: 基本レイアウトの投稿ボタン（フローティングアクションボタン）
 * 
 * TDD Green段階: テストを通すための最小実装
 */
function PostButton() {
  return (
    <button className="bg-blue-500 hover:bg-blue-600 text-white shadow-lg rounded-full w-14 h-14 flex items-center justify-center text-2xl font-bold transition-colors">
      +
    </button>
  );
}

export default PostButton;
