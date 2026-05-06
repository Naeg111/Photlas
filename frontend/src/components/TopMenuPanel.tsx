import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { User, Settings, FileText, Shield, LogOut, /* Heart, */ LogIn, CircleHelp, UserX, BookOpen, Bell, Mail, Compass } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuth } from "../contexts/AuthContext";
import { type SupportedLanguage } from "../i18n";

interface TopMenuPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoggedIn: boolean;
  isAdmin?: boolean;
  onMyPageClick: () => void;
  // onFavoritesClick: () => void; // 行きたい場所リスト（一時非表示）
  onAccountSettingsClick: () => void;
  onModerationClick?: () => void;
  onDeletedUsersClick?: () => void;
  onTermsClick: () => void;
  onPrivacyClick: () => void;
  onAboutClick: () => void;
  onHowToUseClick: () => void;
  onContactClick: () => void;
  /** Issue#115: 方角インジケーター ON/OFF 状態 */
  headingIndicatorEnabled: boolean;
  /** Issue#115: 方角インジケーター ON/OFF 切替（OS 許可リクエストを含む） */
  onHeadingIndicatorChange: (enabled: boolean) => void;
  /** Issue#115: 方角インジケーターが利用可能か（デスクトップ等の非対応環境では false → スイッチ disabled）。既定: true */
  headingIndicatorAvailable?: boolean;
  onLoginClick: () => void;
  // Issue#104: onSignUpClick を削除（メニューから「新規アカウント作成」ボタンを削除）
  onLogout: () => void;
}

export function TopMenuPanel({
  open,
  onOpenChange,
  isLoggedIn,
  isAdmin,
  onMyPageClick,
  // onFavoritesClick, // 行きたい場所リスト（一時非表示）
  onAccountSettingsClick,
  onModerationClick,
  onDeletedUsersClick,
  onAboutClick,
  onHowToUseClick,
  onContactClick,
  headingIndicatorEnabled,
  onHeadingIndicatorChange,
  headingIndicatorAvailable = true,
  onTermsClick,
  onPrivacyClick,
  onLoginClick,
  onLogout,
}: Readonly<TopMenuPanelProps>) {
  const { t, i18n } = useTranslation();
  const { changeLanguage } = useAuth();

  const handleLanguageChange = (lang: SupportedLanguage) => {
    changeLanguage(lang);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="w-full h-full md:w-[60%] md:left-[20%] md:overflow-hidden bg-transparent p-0 gap-0 border-none shadow-none">
        <div className="bg-background w-full px-16 pb-10 pt-[calc(2.5rem+var(--safe-area-top))] border-b shadow-lg md:rounded-b-lg md:overflow-y-auto md:max-h-[90vh]">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('menu.title')}</SheetTitle>
            <SheetDescription>
              {t('menu.description')}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 mt-[25px]">
            {/* 1. ログイン or（ログイン中はプロフィール / アカウント設定 / モデレーション / ログアウト） */}
            {isLoggedIn ? (
              <>
                <Button
                  variant="ghost"
                  className="justify-start gap-3"
                  onClick={() => {
                    onMyPageClick();
                    onOpenChange(false);
                  }}
                >
                  <User className="w-5 h-5" />
                  {t('menu.profile')}
                </Button>
                <Separator />
                <Button
                  variant="ghost"
                  className="justify-start gap-3"
                  onClick={() => {
                    onAccountSettingsClick();
                    onOpenChange(false);
                  }}
                >
                  <Settings className="w-5 h-5" />
                  {t('menu.accountSettings')}
                </Button>
                <Separator />
                {isAdmin && onModerationClick && (
                  <>
                    <Button
                      variant="ghost"
                      className="justify-start gap-3"
                      onClick={() => {
                        onModerationClick();
                        onOpenChange(false);
                      }}
                      data-testid="moderation-menu-button"
                    >
                      <Shield className="w-5 h-5" />
                      {t('menu.moderation')}
                    </Button>
                    <Separator />
                    {onDeletedUsersClick && (
                      <>
                        <Button
                          variant="ghost"
                          className="justify-start gap-3"
                          onClick={() => {
                            onDeletedUsersClick();
                            onOpenChange(false);
                          }}
                          data-testid="deleted-users-menu-button"
                        >
                          <UserX className="w-5 h-5" />
                          {t('menu.deletedUsers')}
                        </Button>
                        <Separator />
                      </>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  className="justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={onLogout}
                >
                  <LogOut className="w-5 h-5" />
                  {t('common.logout')}
                </Button>
                <Separator />
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="justify-start gap-3"
                  onClick={() => {
                    onLoginClick();
                    onOpenChange(false);
                  }}
                >
                  <LogIn className="w-5 h-5" />
                  {t('common.login')}
                </Button>
                <Separator />
              </>
            )}
            {/* 2. お知らせ（非活性、中身は別Issueで実装） */}
            <Button
              variant="ghost"
              className="justify-start gap-3"
              disabled
            >
              <Bell className="w-5 h-5" />
              {t('menu.news')}
            </Button>
            <Separator />
            {/* 3. Photlasとは？ */}
            <Button
              variant="ghost"
              className="justify-start gap-3"
              onClick={() => {
                onAboutClick();
                onOpenChange(false);
              }}
            >
              <CircleHelp className="w-5 h-5" />
              {t('menu.about')}
            </Button>
            <Separator />
            {/* 4. 操作方法 */}
            <Button
              variant="ghost"
              className="justify-start gap-3"
              onClick={() => {
                onHowToUseClick();
                onOpenChange(false);
              }}
            >
              <BookOpen className="w-5 h-5" />
              {t('menu.howToUse')}
            </Button>
            <Separator />
            {/* 5. 利用規約 */}
            <Button
              variant="ghost"
              className="justify-start gap-3"
              onClick={() => {
                onTermsClick();
                onOpenChange(false);
              }}
            >
              <FileText className="w-5 h-5" />
              {t('menu.terms')}
            </Button>
            <Separator />
            {/* 6. プライバシーポリシー */}
            <Button
              variant="ghost"
              className="justify-start gap-3"
              onClick={() => {
                onPrivacyClick();
                onOpenChange(false);
              }}
            >
              <Shield className="w-5 h-5" />
              {t('menu.privacy')}
            </Button>
            <Separator />
            {/* 7. お問い合わせ */}
            <Button
              variant="ghost"
              className="justify-start gap-3"
              onClick={() => {
                onContactClick();
                onOpenChange(false);
              }}
            >
              <Mail className="w-5 h-5" />
              {t('menu.contact')}
            </Button>
            <Separator />
            {/* 8. 向いている方角（ON/OFF スイッチ） */}
            <div className="flex items-center justify-between pl-3 pr-5 py-2">
              <div className="flex items-center gap-3">
                <Compass className="w-5 h-5" />
                <span className="text-sm">{t('menu.headingIndicator')}</span>
              </div>
              <Switch
                checked={headingIndicatorEnabled}
                onCheckedChange={onHeadingIndicatorChange}
                disabled={!headingIndicatorAvailable}
                aria-label={t('menu.headingIndicator')}
              />
            </div>
            <Separator />
            {/* Issue#93: 言語スイッチ */}
            <div className="flex justify-center py-2">
              <LanguageSwitcher
                currentLanguage={i18n.language as SupportedLanguage}
                onLanguageChange={handleLanguageChange}
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
