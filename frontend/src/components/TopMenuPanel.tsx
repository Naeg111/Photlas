import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { User, Settings, FileText, Shield, LogOut, /* Heart, */ LogIn, UserPlus, CircleHelp, UserX } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
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
  onLoginClick: () => void;
  onSignUpClick: () => void;
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
  onTermsClick,
  onPrivacyClick,
  onLoginClick,
  onSignUpClick,
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
                {/* 行きたい場所リスト（一時非表示）
                <Button
                  variant="ghost"
                  className="justify-start gap-3"
                  onClick={() => {
                    onFavoritesClick();
                    onOpenChange(false);
                  }}
                >
                  <Heart className="w-5 h-5" />
                  行きたい場所リスト
                </Button>
                <Separator />
                */}
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
                    {onDeletedUsersClick && (
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
                    )}
                    <Separator />
                  </>
                )}
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
                <Button
                  variant="ghost"
                  className="justify-start gap-3"
                  onClick={() => {
                    onSignUpClick();
                    onOpenChange(false);
                  }}
                >
                  <UserPlus className="w-5 h-5" />
                  {t('auth.createAccount')}
                </Button>
                <Separator />
              </>
            )}
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
            {isLoggedIn && (
              <>
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
            )}
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
