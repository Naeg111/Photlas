import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "./ui/sheet";
import { AccountSettingsDialog } from "./AccountSettingsDialog";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";

/**
 * MenuButton コンポーネント
 * Issue#1, #20: ユーザー関連機能へのアクセスポイント
 *
 * 右上に配置されるメニューボタン。
 * アカウント設定などの機能にアクセスできる。
 * Sheet（フィルターと同じ仕組み）を使用し、モバイルのステータスバー白色化を防止。
 */
function MenuButton() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);

  return (
    <>
      <button
        className="bg-white shadow-lg rounded-lg border px-4 py-2 text-sm font-medium"
        aria-label={t('menu.openMenu')}
        title={t('menu.menuDescription')}
        onClick={() => setIsMenuOpen(true)}
      >
        {t('menu.title')}
      </button>

      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="right" className="w-64 sm:max-w-xs">
          <SheetHeader>
            <SheetTitle>{t('menu.title')}</SheetTitle>
            <SheetDescription className="sr-only">
              {t('menu.menuDescription')}
            </SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            <SheetClose asChild>
              <button
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
                onClick={() => setIsAccountSettingsOpen(true)}
              >
                <Settings className="w-4 h-4" />
                {t('menu.accountSettings')}
              </button>
            </SheetClose>
          </nav>
        </SheetContent>
      </Sheet>

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
