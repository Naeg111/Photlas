import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { User, Settings, FileText, Shield, LogOut, Heart, LogIn, UserPlus, CircleHelp, UserX } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

interface TopMenuPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoggedIn: boolean;
  isAdmin?: boolean;
  onMyPageClick: () => void;
  onFavoritesClick: () => void;
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
  onFavoritesClick,
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="w-full h-full md:w-[60%] md:left-[20%] md:overflow-hidden bg-transparent p-0 gap-0 border-none shadow-none">
        <div className="bg-background w-full px-16 pb-10 pt-[calc(2.5rem+var(--safe-area-top))] border-b shadow-lg md:rounded-b-lg md:overflow-y-auto md:max-h-[90vh]">
          <SheetHeader className="sr-only">
            <SheetTitle>メニュー</SheetTitle>
            <SheetDescription>
              アプリケーションのメインメニュー
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
                      モデレーション管理
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
                        退会済みユーザー管理
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
