import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Eye, EyeOff } from "lucide-react";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowSignUp: () => void;
  onShowPasswordReset: () => void;
  onSuccess: () => void;
}

export function LoginDialog({
  open,
  onOpenChange,
  onShowSignUp,
  onShowPasswordReset,
  onSuccess,
}: LoginDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }

    // TODO: API呼び出し
    console.log("Login:", { email, password, rememberMe });
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ログイン</DialogTitle>
          <DialogDescription className="sr-only">
            アカウントにログインする
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* メールアドレス */}
          <div className="space-y-2">
            <Label htmlFor="login-email">メールアドレス</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@photlas.com"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {/* パスワード */}
          <div className="space-y-2">
            <Label htmlFor="login-password">パスワード</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* ログイン状態を保持 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
            />
            <Label htmlFor="remember" className="cursor-pointer">
              ログイン状態を保持する
            </Label>
          </div>

          {/* パスワードを忘れた */}
          <div className="text-center">
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => {
                onOpenChange(false);
                onShowPasswordReset();
              }}
            >
              パスワードをお忘れですか？
            </Button>
          </div>

          {/* ボタン */}
          <div className="pt-2.5">
            <Button className="w-full" onClick={handleSubmit}>
              ログイン
            </Button>
          </div>

          {/* アカウント作成へ */}
          <div className="text-center text-sm text-gray-600">
            アカウントをお持ちでない方は
            <Button
              variant="link"
              className="p-0 h-auto ml-1"
              onClick={() => {
                onOpenChange(false);
                onShowSignUp();
              }}
            >
              新規登録
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}