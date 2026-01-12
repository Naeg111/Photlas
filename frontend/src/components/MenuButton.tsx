import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { AccountSettingsDialog } from "./AccountSettingsDialog";
import { useAuth } from "../contexts/AuthContext";
import { Settings } from "lucide-react";

/**
 * MenuButton コンポーネント
 * Issue#1: プロジェクトセットアップと基本レイアウト - メニューボタン
 * Issue#20: アカウント設定機能 - メニューからアカウント設定を開く
 *
 * 【目的】
 * - ユーザー関連機能（ログイン、設定、プロフィール等）へのアクセスポイント
 * - アプリケーションの二次的な機能群をまとめるハブ
 * - 右上に配置されるナビゲーション要素
 *
 * 【機能】
 * - アカウント設定ダイアログを開く
 */
function MenuButton() {
  const { user } = useAuth();
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={
              // === ベーススタイル ===
              // FilterButtonと同じスタイルを採用し、UI全体の統一感を保持
              "bg-white " +           // 背景色: 白色（地図上での視認性確保）
              "shadow-lg " +          // ドロップシャドウ: 大きめの影でフローティング感演出
              "rounded-lg " +         // 角の丸み: 8px（モダンなデザイン）
              "border " +             // ボーダー: 1px solid（輪郭の明確化）

              // === 内側の余白 ===
              "px-4 py-2 " +          // パディング: 左右16px、上下8px（適度なクリック領域）

              // === インタラクション ===
              "hover:bg-gray-50 " +   // ホバー時: 薄いグレー背景（視覚的フィードバック）
              "transition-colors " +  // アニメーション: 色変化をスムーズに

              // === テキストスタイル ===
              "text-sm " +            // フォントサイズ: 14px（読みやすさと省スペース）
              "font-medium"           // フォント太さ: ミディアム（視認性向上）
            }

            // === アクセシビリティ ===
            aria-label="ユーザーメニューを開く"          // スクリーンリーダー対応
            title="アカウント設定やその他の機能にアクセス"  // ツールチップ表示用
          >
            メニュー
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsAccountSettingsOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            アカウント設定
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {user && (
        <AccountSettingsDialog
          open={isAccountSettingsOpen}
          onOpenChange={setIsAccountSettingsOpen}
          currentEmail={user.email}
        />
      )}
    </>
  );
}

// ES6 モジュールとしてエクスポート
// App.tsx でフローティング要素として配置される
export default MenuButton;
