import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Checkbox } from './ui/checkbox'
import { Eye, EyeOff } from 'lucide-react'
import { API_V1_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

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
  const { t } = useTranslation()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isEmailNotVerified, setIsEmailNotVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setIsEmailNotVerified(false)

    if (!email.trim() || !password.trim()) {
      setError(t('auth.enterBothFields'))
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
        toast(t('auth.loginSuccess'))
        onOpenChange(false)
      } else if (response.status === 403) {
        const data = await response.json()
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setIsEmailNotVerified(true)
          setError(t('errors.EMAIL_NOT_VERIFIED'))
        } else if (data.code === 'ACCOUNT_SUSPENDED') {
          // Issue#54: 永久停止アカウント
          setError(t('auth.accountSuspended'))
        } else {
          setError(t('auth.loginFailed'))
        }
      } else if (response.status === 401) {
        // Issue#72: 退会済みアカウントの場合はバックエンドのメッセージを表示
        try {
          const data = await response.json()
          setError(data.code ? t('errors.' + data.code) : t('errors.INVALID_CREDENTIALS'))
        } catch {
          setError(t('errors.INVALID_CREDENTIALS'))
        }
      } else {
        setError(t('errors.INVALID_CREDENTIALS'))
      }
    } catch {
      setError(t('auth.loginFailed'))
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
        toast(t('auth.resendSuccess'))
      } else {
        toast(t('auth.resendFailed'))
      }
    } catch {
      toast(t('auth.resendFailed'))
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
            <DialogTitle>{t('auth.loginTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('auth.loginDescription')}
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
                  {isResending ? t('auth.resendLoading') : t('auth.resendVerification')}
                </Button>
              )}
            </div>
          )}

          {/* メールアドレス */}
          <div className="space-y-2">
            <Label htmlFor="login-email">{t('auth.email')}</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* パスワード */}
          <div className="space-y-2">
            <Label htmlFor="login-password">{t('auth.password')}</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
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
              {t('auth.keepLoggedIn')}
            </Label>
          </div>

          {/* パスワードを忘れた */}
          <div className="text-center">
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={handlePasswordResetClick}
            >
              {t('auth.forgotPassword')}
            </Button>
          </div>

          {/* ボタン */}
          <div className="pt-2.5">
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {t('common.login')}
            </Button>
          </div>

          {/* アカウント作成へ */}
          <div className="text-center text-sm text-gray-600">
            {t('auth.noAccount')}
            <Button
              variant="link"
              className="p-0 h-auto ml-1"
              onClick={handleSignUpClick}
            >
              {t('common.signup')}
            </Button>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
