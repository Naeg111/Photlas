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
 * Issue#1, #20: ユーザー関連機能へのアクセスポイント
 *
 * 右上に配置されるドロップダウンメニューボタン。
 * アカウント設定などの機能にアクセスできる。
 */
function MenuButton() {
  const { user } = useAuth();
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* メニュー展開時のオーバーレイ（モバイルステータスバー白色防止） */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="bg-white shadow-lg rounded-lg border px-4 py-2 text-sm font-medium"
            aria-label="ユーザーメニューを開く"
            title="アカウント設定やその他の機能にアクセス"
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

export default MenuButton;
