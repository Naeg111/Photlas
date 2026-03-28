import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Checkbox } from './ui/checkbox'
import { Eye, EyeOff } from 'lucide-react'
import { API_V1_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

/** メール未認証エラーメッセージのプレフィックス */
const EMAIL_NOT_VERIFIED_PREFIX = 'メールアドレスが認証されていません'

/**
 * LoginDialog コンポーネント
 * Issue#26: 認証機能のモーダルベース移行
 *
 * マップ画面を離れることなくログインを行えるダイアログ
 */

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onShowSignUp: () => void
  onShowPasswordReset: () => void
}

export function LoginDialog({
  open,
  onOpenChange,
  onShowSignUp,
  onShowPasswordReset,
}: Readonly<LoginDialogProps>) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isEmailNotVerified, setIsEmailNotVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setIsEmailNotVerified(false)

    if (!email.trim() || !password.trim()) {
      setError('メールアドレスとパスワードを入力してください')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${API_V1_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        login(
          { userId: data.user.id, email: data.user.email, username: data.user.username, role: data.user.role || 'user' },
          data.token,
          rememberMe
        )
        toast('ログインしました')
        onOpenChange(false)
      } else if (response.status === 403) {
        const data = await response.json()
        if (data.message?.startsWith(EMAIL_NOT_VERIFIED_PREFIX)) {
          setIsEmailNotVerified(true)
          setError(data.message)
        } else if (data.message === 'アカウントが停止されています') {
          // Issue#54: 永久停止アカウント
          setError('アカウントが停止されています。詳しくはお問い合わせください。')
        } else {
          setError('ログインに失敗しました')
        }
      } else if (response.status === 401) {
        // Issue#72: 退会済みアカウントの場合はバックエンドのメッセージを表示
        try {
          const data = await response.json()
          setError(data.message || 'メールアドレスまたはパスワードが正しくありません')
        } catch {
          setError('メールアドレスまたはパスワードが正しくありません')
        }
      } else {
        setError('メールアドレスまたはパスワードが正しくありません')
      }
    } catch {
      setError('ログインに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 認証メール再送ハンドラー
   */
  const handleResendVerification = async () => {
    setIsResending(true)
    try {
      const response = await fetch(`${API_V1_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        toast('認証メールを再送信しました。メールをご確認ください。')
      } else {
        toast('認証メールの再送信に失敗しました')
      }
    } catch {
      toast('認証メールの再送信に失敗しました')
    } finally {
      setIsResending(false)
    }
  }

  const handleSignUpClick = () => {
    onOpenChange(false)
    onShowSignUp()
  }

  const handlePasswordResetClick = () => {
    onOpenChange(false)
    onShowPasswordReset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>ログイン</DialogTitle>
            <DialogDescription className="sr-only">
              アカウントにログインする
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        <div className="space-y-5 mt-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
              {isEmailNotVerified && (
                <Button
                  variant="link"
                  className="p-0 h-auto text-sm mt-1"
                  onClick={handleResendVerification}
                  disabled={isResending}
                >
                  {isResending ? '送信中...' : '認証メールを再送信する'}
                </Button>
              )}
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
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* パスワード */}
          <div className="space-y-2">
            <Label htmlFor="login-password">パスワード</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
                aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'}
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
              onClick={handlePasswordResetClick}
            >
              パスワードをお忘れですか？
            </Button>
          </div>

          {/* ボタン */}
          <div className="pt-2.5">
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              ログイン
            </Button>
          </div>

          {/* アカウント作成へ */}
          <div className="text-center text-sm text-gray-600">
            アカウントをお持ちでない方は
            <Button
              variant="link"
              className="p-0 h-auto ml-1"
              onClick={handleSignUpClick}
            >
              新規登録
            </Button>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
