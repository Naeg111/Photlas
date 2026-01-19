import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { toast } from "sonner";
import { API_V1_URL } from "../config/api";

/**
 * Issue#20: アカウント設定ダイアログ
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
}: AccountSettingsDialogProps) {
  const navigate = useNavigate();

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

  // メールアドレス変更処理
  const handleEmailChange = async () => {
    if (!newEmail || !emailPassword) {
      toast.error("すべてのフィールドを入力してください");
      return;
    }

    setIsEmailLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("ログインが必要です");
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
        toast.success("メールアドレスを変更しました");
        setNewEmail("");
        setEmailPassword("");
      } else if (response.status === 401) {
        toast.error("パスワードが正しくありません");
      } else if (response.status === 409) {
        toast.error("このメールアドレスはすでに使用されています");
      } else if (response.status === 400) {
        toast.error("メールアドレスの形式が正しくありません");
      } else {
        toast.error("メールアドレスの変更に失敗しました");
      }
    } catch (error) {
      console.error("Email change error:", error);
      toast.error("メールアドレスの変更に失敗しました");
    } finally {
      setIsEmailLoading(false);
    }
  };

  // パスワード変更処理
  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("すべてのフィールドを入力してください");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("新しいパスワードが一致しません");
      return;
    }

    // Issue#21: パスワードバリデーション統一
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z0-9]{8,20}$/.test(newPassword)) {
      toast.error("パスワードは8〜20文字で、数字・小文字・大文字をそれぞれ1文字以上含め、記号は使用できません");
      return;
    }

    setIsPasswordLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("ログインが必要です");
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
        toast.success("パスワードを変更しました");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else if (response.status === 401) {
        toast.error("現在のパスワードが正しくありません");
      } else if (response.status === 400) {
        const errorData = await response.json();
        toast.error(errorData.message || "パスワードの形式が正しくありません");
      } else {
        toast.error("パスワードの変更に失敗しました");
      }
    } catch (error) {
      console.error("Password change error:", error);
      toast.error("パスワードの変更に失敗しました");
    } finally {
      setIsPasswordLoading(false);
    }
  };

  // アカウント削除処理
  const handleAccountDelete = async () => {
    if (!deletePassword) {
      toast.error("パスワードを入力してください");
      return;
    }

    setIsDeleteLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("ログインが必要です");
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
        toast.success("アカウントを削除しました");
        // ローカルストレージをクリア
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        // トップページにリダイレクト
        navigate("/");
        onOpenChange(false);
      } else if (response.status === 401) {
        toast.error("パスワードが正しくありません");
        setIsAlertOpen(false);
      } else {
        toast.error("アカウントの削除に失敗しました");
        setIsAlertOpen(false);
      }
    } catch (error) {
      console.error("Account delete error:", error);
      toast.error("アカウントの削除に失敗しました");
      setIsAlertOpen(false);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>アカウント設定</DialogTitle>
          <DialogDescription className="sr-only">
            アカウント情報とセキュリティ設定
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* メールアドレス変更 */}
          <div className="space-y-3">
            <h3>メールアドレスの変更</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="current-email">現在のメールアドレス</Label>
                <Input
                  id="current-email"
                  type="email"
                  value={currentEmail}
                  disabled
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="new-email">新しいメールアドレス</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="new@example.com"
                  className="mt-2"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email-password">パスワード</Label>
                <Input
                  id="email-password"
                  type="password"
                  placeholder="現在のパスワードを入力"
                  className="mt-2"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                />
              </div>
              <Button
                className="w-full mt-2"
                onClick={handleEmailChange}
                disabled={isEmailLoading}
              >
                {isEmailLoading ? "変更中..." : "メールアドレスを変更"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* パスワード変更 */}
          <div className="space-y-3">
            <h3>パスワードの変更</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="current-password">現在のパスワード</Label>
                <Input
                  id="current-password"
                  type="password"
                  className="mt-2"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="new-password">新しいパスワード</Label>
                <Input
                  id="new-password"
                  type="password"
                  className="mt-2"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">新しいパスワード（確認）</Label>
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
                disabled={isPasswordLoading}
              >
                {isPasswordLoading ? "変更中..." : "パスワードを変更"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* プラン確認 */}
          <div className="space-y-3">
            <h3>プラン</h3>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-500">現在のプラン</p>
              <p>無料プラン</p>
            </div>
            <Button variant="outline" className="w-full" disabled>
              プランをアップグレード（準備中）
            </Button>
          </div>

          <Separator />

          {/* アカウント削除 */}
          <div className="space-y-3 pt-2.5">
            <h3 className="text-red-600">アカウント削除</h3>
            <p className="text-sm text-gray-500">
              アカウントを削除すると、すべてのデータが完全に削除されます。この操作は取り消せません。
            </p>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  アカウントを削除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    この操作は取り消せません。アカウントとすべてのデータが完全に削除されます。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-4">
                  <Label htmlFor="delete-password">パスワードを入力して確認</Label>
                  <Input
                    id="delete-password"
                    type="password"
                    placeholder="パスワードを入力"
                    className="mt-2"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeletePassword("")}>
                    キャンセル
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleAccountDelete}
                    disabled={isDeleteLoading}
                  >
                    {isDeleteLoading ? "削除中..." : "削除する"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
