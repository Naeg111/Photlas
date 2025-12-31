/**
 * FilterButton コンポーネント
 * Issue#1: プロジェクトセットアップと基本レイアウト - フィルターボタン
 * Issue#16: フィルター機能 - フィルターパネル開閉ボタン
 *
 * 【目的】
 * - 地図上の写真をカテゴリーやタグで絞り込むためのフィルター機能へのエントリーポイント
 * - UI設計書(08_ui_design.md)に基づく基本レイアウトの一部
 * - 左上に配置されるフローティングボタン
 *
 * 【機能】
 * - クリック時にフィルターパネルを開く
 */

interface FilterButtonProps {
  onClick?: () => void;
}

function FilterButton({ onClick }: FilterButtonProps) {
  return (
    <button
      className={
        // === ベース スタイル ===
        "bg-white " +           // 背景色: 白色（地図上で視認性を確保）
        "shadow-lg " +          // ドロップシャドウ: 大きめの影でフローティング感を演出
        "rounded-lg " +         // 角の丸み: 8px（モダンなUI デザイン）
        "border " +             // ボーダー: 1px solid（デフォルトのグレー）

        // === 内側の余白 ===
        "px-4 py-2 " +          // パディング: 左右16px、上下8px（適度なクリック領域確保）

        // === インタラクション ===
        "hover:bg-gray-50 " +   // ホバー時: 薄いグレー背景でフィードバック
        "transition-colors " +  // アニメーション: 色変化をスムーズに

        // === テキスト スタイル ===
        "text-sm " +            // フォントサイズ: 14px（読みやすさと省スペースのバランス）
        "font-medium"           // フォント太さ: ミディアム（視認性向上）
      }

      // === アクセシビリティ ===
      aria-label="写真フィルター機能を開く"  // スクリーンリーダー対応
      title="写真の絞り込み条件を設定できます" // ツールチップ表示用

      onClick={onClick}
    >
      {/* ボタンテキスト: シンプルで分かりやすいラベル */}
      フィルター
    </button>
  );
}

// ES6 モジュールとしてエクスポート
// 他のコンポーネントから import FilterButton from './FilterButton' でインポート可能
export default FilterButton;
