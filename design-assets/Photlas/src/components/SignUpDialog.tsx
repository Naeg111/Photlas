import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Upload, Eye, EyeOff } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";

interface SignUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowTerms: () => void;
  onSuccess: () => void;
}

type PasswordStrength = "weak" | "medium" | "strong";

export function SignUpDialog({
  open,
  onOpenChange,
  onShowTerms,
  onSuccess,
}: SignUpDialogProps) {
  const [profileImage, setProfileImage] = useState<string>("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [snsLinks, setSnsLinks] = useState<string[]>([""]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getPasswordStrength = (pwd: string): PasswordStrength => {
    if (pwd.length < 8) return "weak";
    
    const hasNumber = /[0-9]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    
    const conditions = [hasNumber, hasLower, hasUpper].filter(Boolean).length;
    
    if (conditions === 3 && pwd.length >= 12) return "strong";
    if (conditions >= 2) return "medium";
    return "weak";
  };

  const passwordStrength = password ? getPasswordStrength(password) : null;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 表示名
    if (!displayName.trim()) {
      newErrors.displayName = "表示名を入力してください";
    }

    // メールアドレス
    if (!email.trim()) {
      newErrors.email = "メールアドレスを入力してください";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "正しいメールアドレスの形式で入力してください";
    }

    // パスワード
    if (!password) {
      newErrors.password = "パスワードを入力してください";
    } else {
      if (password.length < 8 || password.length > 20) {
        newErrors.password = "パスワードは8文字以上20文字以内で入力してください";
      } else if (!/[0-9]/.test(password)) {
        newErrors.password = "パスワードには数字を1文字以上含めてください";
      } else if (!/[a-z]/.test(password)) {
        newErrors.password = "パスワードにはローマ字小文字を1文字以上含めてください";
      } else if (!/[A-Z]/.test(password)) {
        newErrors.password = "パスワードにはローマ字大文字を1文字以上含めてください";
      } else if (/[^a-zA-Z0-9]/.test(password)) {
        newErrors.password = "パスワードに記号を含めることはできません";
      }
    }

    // パスワード（確認用）
    if (password !== confirmPassword) {
      newErrors.confirmPassword = "パスワードが一致しません";
    }

    // 利用規約
    if (!agreedToTerms) {
      newErrors.terms = "利用規約に同意してください";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      // TODO: API呼び出し
      console.log("Sign up:", { displayName, email, password, snsLinks, profileImage });
      onSuccess();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProfileImage(url);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>アカウント作成</DialogTitle>
          <DialogDescription className="sr-only">
            新しいアカウントを作成する
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          {/* プロフィール画像 */}
          <div className="space-y-3">
            <Label>プロフィール画像（任意）</Label>
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={profileImage} />
                <AvatarFallback>
                  <Upload className="w-8 h-8 text-gray-400" />
                </AvatarFallback>
              </Avatar>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                画像を選択
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* 表示名 */}
          <div className="space-y-2">
            <Label htmlFor="displayName">表示名 *</Label>
            {errors.displayName && (
              <p className="text-sm text-red-600">{errors.displayName}</p>
            )}
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="山田太郎"
            />
          </div>

          {/* メールアドレス */}
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス *</Label>
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email}</p>
            )}
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@photlas.com"
            />
          </div>

          {/* パスワード */}
          <div className="space-y-2">
            <Label htmlFor="password">パスワード *</Label>
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password}</p>
            )}
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8-20文字、数字・小文字・大文字を含む"
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
            {passwordStrength && (
              <div className="flex items-center gap-2">
                <span className="text-sm">強度:</span>
                <div
                  className={`text-sm px-2 py-1 rounded ${
                    passwordStrength === "strong"
                      ? "bg-green-100 text-green-700"
                      : passwordStrength === "medium"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {passwordStrength === "strong"
                    ? "強"
                    : passwordStrength === "medium"
                    ? "中"
                    : "弱"}
                </div>
              </div>
            )}
          </div>

          {/* パスワード（確認用） */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">パスワード（確認用） *</Label>
            {errors.confirmPassword && (
              <p className="text-sm text-red-600">{errors.confirmPassword}</p>
            )}
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="パスワードを再入力"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                type="button"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* SNSリンク */}
          <div className="space-y-3">
            <Label>SNSリンク（任意）</Label>
            {snsLinks.map((link, index) => (
              <Input
                key={index}
                value={link}
                onChange={(e) => {
                  const newLinks = [...snsLinks];
                  newLinks[index] = e.target.value;
                  setSnsLinks(newLinks);
                }}
                placeholder="https://twitter.com/username"
              />
            ))}
            {snsLinks.length < 3 && (
              <Button
                variant="outline"
                onClick={() => setSnsLinks([...snsLinks, ""])}
                className="w-full"
              >
                SNSリンクを追加
              </Button>
            )}
          </div>

          <Separator />

          {/* 利用規約 */}
          <div className="space-y-3">
            <Label>利用規約</Label>
            <ScrollArea className="h-48 border rounded-md p-4 text-sm">
              <p className="text-gray-700">
                この利用規約（以下「本規約」）は、Photlas（以下「本サービス」）の利用条件を定めるものです。
                ユーザーの皆様には、本規約に従って本サービスをご利用いただきます。
              </p>
              <p className="mt-3 text-gray-700">
                1. ユーザーは、本サービスに登録する際、真実かつ正確な情報を提供するものとします。
              </p>
              <p className="mt-2 text-gray-700">
                2. ユーザーは、本サービスを通じて投稿したコンテンツについて、一切の責任を負うものとします。
              </p>
              <p className="mt-2 text-gray-700">
                3. 本サービスは、予告なく内容の変更や中断、終了をする場合があります。
              </p>
              <Button
                variant="link"
                className="p-0 h-auto mt-3"
                onClick={onShowTerms}
              >
                利用規約の全文を表示
              </Button>
            </ScrollArea>
            {errors.terms && (
              <p className="text-sm text-red-600">{errors.terms}</p>
            )}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              />
              <Label htmlFor="terms" className="cursor-pointer">
                利用規約に同意します
              </Label>
            </div>
          </div>

          {/* ボタン */}
          <div className="flex gap-3 pt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleSubmit}
              disabled={!displayName.trim() || !email.trim() || !password || !confirmPassword || !agreedToTerms}
            >
              登録する
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}