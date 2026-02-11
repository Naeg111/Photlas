import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { User, Settings, FileText, Shield, LogOut, Heart, LogIn, UserPlus } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

interface TopMenuPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoggedIn: boolean;
  onMyPageClick: () => void;
  onFavoritesClick: () => void;
  onAccountSettingsClick: () => void;
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
  onMyPageClick,
  onFavoritesClick,
  onAccountSettingsClick,
  onAboutClick,
  onTermsClick,
  onPrivacyClick,
  onLoginClick,
  onSignUpClick,
  onLogout,
}: TopMenuPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="w-full px-16 py-10">
        <SheetHeader className="sr-only">
          <SheetTitle>メニュー</SheetTitle>
          <SheetDescription>
            アプリケーションのメインメニュー
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            className="justify-start gap-3"
            onClick={() => {
              onAboutClick();
              onOpenChange(false);
            }}
          >
            <svg className="w-5 h-5" viewBox="56 60 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M256 80C180 80 120 140 120 216c0 96 136 228 136 228s136-132 136-228C392 140 332 80 256 80z" fill="currentColor"/>
              <rect x="182" y="190" width="148" height="86" rx="12" fill="white"/>
              <rect x="224" y="170" width="56" height="28" rx="6" fill="white"/>
              <circle cx="256" cy="230" r="30" fill="currentColor"/>
              <circle cx="256" cy="230" r="18" fill="white"/>
            </svg>
            Photlasとは？
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
                マイページ
              </Button>
              <Separator />
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
              <Button
                variant="ghost"
                className="justify-start gap-3"
                onClick={() => {
                  onAccountSettingsClick();
                  onOpenChange(false);
                }}
              >
                <Settings className="w-5 h-5" />
                アカウント設定
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
                ログイン
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
                新規アカウント作成
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
            利用規約
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
            プライバシーポリシー
          </Button>
          <Separator />
          {isLoggedIn && (
            <Button
              variant="ghost"
              className="justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={onLogout}
            >
              <LogOut className="w-5 h-5" />
              ログアウト
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
