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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="bg-white shadow-lg rounded-lg border px-4 py-2 hover:bg-gray-50 transition-colors text-sm font-medium"
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
