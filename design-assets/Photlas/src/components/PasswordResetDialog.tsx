import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { CheckCircle } from "lucide-react";

interface PasswordResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PasswordResetDialog({
  open,
  onOpenChange,
}: PasswordResetDialogProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");

    if (!email.trim()) {
      setError("メールアドレスを入力してください");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("正しいメールアドレスの形式で入力してください");
      return;
    }

    // TODO: API呼び出し
    console.log("Password reset requested for:", email);
    setSent(true);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        setSent(false);
        setEmail("");
        setError("");
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>パスワードリセット</DialogTitle>
          <DialogDescription className="sr-only">
            パスワードをリセットする
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          {sent ? (
            <div className="text-center py-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="mb-2">メールを送信しました</h3>
              <p className="text-sm text-gray-600 mb-6">
                {email} 宛にパスワード再設定用のリンクを送信しました。
                メールをご確認ください。
              </p>
              <Button onClick={() => onOpenChange(false)}>
                閉じる
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                登録されているメールアドレスを入力してください。
                パスワード再設定用のリンクをお送りします。
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reset-email">メールアドレス</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@photlas.com"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>

              <div className="flex gap-3 pt-2.5">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  キャンセル
                </Button>
                <Button className="flex-1" onClick={handleSubmit}>
                  送信
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}