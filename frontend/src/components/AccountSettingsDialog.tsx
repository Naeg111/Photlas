import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { toast } from "sonner";
import { API_V1_URL } from "../config/api";
import { useAuth } from "../contexts/AuthContext";

/**
 * Issue#20: アカウント設定ダイアログ
 * Issue#38: 認証トークン取得をAuthContextから行うよう修正
 */

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
}

export function AccountSettingsDialog({
  open,
  onOpenChange,
  currentEmail,
}: Readonly<AccountSettingsDialogProps>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getAuthToken, logout } = useAuth();

  // メールアドレス変更
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  // パスワード変更
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // アカウント削除
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isDeletionComplete, setIsDeletionComplete] = useState(false);

  // メールアドレス変更処理
  const handleEmailChange = async () => {
    if (!newEmail || !emailPassword) {
      toast.error(t('settings.fillAllFields'));
      return;
    }

    setIsEmailLoading(true);
    try {
      // Issue#38: AuthContextからトークンを取得
      const token = getAuthToken();
      if (!token) {
        toast.error(t('settings.loginRequired'));
        return;
      }

      const response = await fetch(
        `${API_V1_URL}/users/me/email`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            new_email: newEmail,
            current_password: emailPassword,
          }),
        }
      );

      if (response.ok) {
        toast.success(t('settings.emailConfirmSent'), { duration: 8000 });
        setNewEmail("");
        setEmailPassword("");
      } else if (response.status === 401) {
        toast.error(t('settings.wrongPassword'));
      } else if (response.status === 409) {
        toast.error(t('settings.emailAlreadyUsed'));
      } else if (response.status === 400) {
        toast.error(t('settings.invalidEmailFormat'));
      } else {
        toast.error(t('settings.emailChangeFailed'));
      }
    } catch {
      toast.error(t('settings.emailChangeFailed'));
    } finally {
      setIsEmailLoading(false);
    }
  };

  // パスワード変更処理
  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('settings.fillAllFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }

    // Issue#21: パスワードバリデーション統一
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z0-9]{8,20}$/.test(newPassword)) {
      toast.error(t('settings.passwordFormatError'));
      return;
    }

    setIsPasswordLoading(true);
    try {
      // Issue#38: AuthContextからトークンを取得
      const token = getAuthToken();
      if (!token) {
        toast.error(t('settings.loginRequired'));
        return;
      }

      const response = await fetch(
        `${API_V1_URL}/users/me/password`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
            new_password_confirm: confirmPassword,
          }),
        }
      );

      if (response.ok) {
        toast.success(t('settings.passwordChanged'));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else if (response.status === 401) {
        toast.error(t('settings.currentPasswordWrong'));
      } else if (response.status === 400) {
        const errorData = await response.json();
        toast.error(errorData.message || t('settings.passwordInvalidFormat'));
      } else {
        toast.error(t('settings.passwordChangeFailed'));
      }
    } catch {
      toast.error(t('settings.passwordChangeFailed'));
    } finally {
      setIsPasswordLoading(false);
    }
  };

  // アカウント削除処理
  const handleAccountDelete = async () => {
    if (!deletePassword) {
      toast.error(t('settings.enterPassword'));
      return;
    }

    setIsDeleteLoading(true);
    try {
      // Issue#38: AuthContextからトークンを取得
      const token = getAuthToken();
      if (!token) {
        toast.error(t('settings.loginRequired'));
        return;
      }

      const response = await fetch(
        `${API_V1_URL}/users/me`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            password: deletePassword,
          }),
        }
      );

      if (response.status === 204) {
        // Issue#72: 退会完了メッセージを表示
        setIsDeletionComplete(true);
      } else if (response.status === 401) {
        toast.error(t('settings.wrongPassword'));
        setIsAlertOpen(false);
      } else {
        toast.error(t('settings.deleteFailed'));
        setIsAlertOpen(false);
      }
    } catch {
      toast.error(t('settings.deleteFailed'));
      setIsAlertOpen(false);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isDeletionComplete ? undefined : onOpenChange}>
      <DialogContent className="max-h-[80vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '80dvh' }}>
        {isDeletionComplete ? (
          <>
            {/* Fixed header */}
            <div className="px-6 pt-6 pb-2 shrink-0">
              <DialogHeader>
                <DialogTitle>{t('settings.deleteCompleteTitle')}</DialogTitle>
                <DialogDescription className="sr-only">
                  {t('settings.deleteCompleteDescription')}
                </DialogDescription>
              </DialogHeader>
            </div>
            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-6 pb-6">
            <div className="space-y-4 mt-4 text-center">
              <p className="text-sm text-gray-700">
                {t('settings.deleteCompleteMessage1')}
              </p>
              <p className="text-sm text-gray-700">
                {t('settings.deleteCompleteMessage2')}
              </p>
              <Button
                className="w-full mt-4"
                onClick={() => {
                  logout();
                  navigate("/");
                  onOpenChange(false);
                }}
              >
                {t('common.close')}
              </Button>
            </div>
            </div>
          </>
        ) : (
          <>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>{t('settings.title')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('settings.description')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        <div className="space-y-6 mt-4">
          {/* メールアドレス変更 */}
          <div className="space-y-4">
            <h3 className="font-medium">{t('settings.changeEmail')}</h3>
            <div className="space-y-4 mt-5">
              <div>
                <Label htmlFor="current-email">{t('settings.currentEmail')}</Label>
                <Input
                  id="current-email"
                  type="email"
                  value={currentEmail}
                  disabled
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="new-email">{t('settings.newEmail')}</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder={t('settings.newEmailPlaceholder')}
                  className="mt-2"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email-password">{t('settings.passwordLabel')}</Label>
                <Input
                  id="email-password"
                  type="password"
                  placeholder={t('settings.currentPasswordPlaceholder')}
                  className="mt-2"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                />
              </div>
              <Button
                className="w-full mt-2"
                onClick={handleEmailChange}
                disabled={isEmailLoading || !newEmail || !emailPassword}
              >
                {isEmailLoading ? t('settings.changing') : t('settings.changeEmailButton')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* パスワード変更 */}
          <div className="space-y-4">
            <h3 className="font-medium">{t('settings.changePassword')}</h3>
            <div className="space-y-4 mt-5">
              <div>
                <Label htmlFor="current-password">{t('settings.currentPassword')}</Label>
                <Input
                  id="current-password"
                  type="password"
                  className="mt-2"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="new-password">{t('settings.newPassword')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  className="mt-2"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">{t('settings.newPasswordConfirm')}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  className="mt-2"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button
                className="w-full mt-2"
                onClick={handlePasswordChange}
                disabled={isPasswordLoading || !currentPassword || !newPassword || !confirmPassword}
              >
                {isPasswordLoading ? t('settings.changing') : t('settings.changePasswordButton')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* プラン確認 */}
          <div className="space-y-3">
            <h3>{t('settings.plan')}</h3>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-500">{t('settings.currentPlan')}</p>
              <p>{t('settings.freePlan')}</p>
            </div>
            <Button variant="outline" className="w-full" disabled>
              {t('settings.upgradePlan')}
            </Button>
          </div>

          <Separator />

          {/* アカウント削除 */}
          <div className="space-y-3 pt-2.5">
            <h3 className="text-red-600">{t('settings.deleteAccount')}</h3>
            <p className="text-sm text-gray-500">
              {t('settings.deleteWarning')}
            </p>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  {t('settings.deleteButton')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.deleteConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.deleteConfirmDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-4">
                  <Label htmlFor="delete-password">{t('settings.enterPasswordConfirm')}</Label>
                  <Input
                    id="delete-password"
                    type="password"
                    placeholder={t('settings.enterPassword')}
                    className="mt-2"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeletePassword("")}>
                    {t('common.cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleAccountDelete}
                    disabled={isDeleteLoading}
                  >
                    {isDeleteLoading ? t('settings.deleting') : t('settings.deleteAction')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
