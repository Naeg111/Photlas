import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Checkbox } from './ui/checkbox'
import { Separator } from './ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import ProfileImageCropper from './ProfileImageCropper'
import { Upload, Eye, EyeOff } from 'lucide-react'
import { SnsLinkEditDialog } from './SnsLinkEditDialog'
import { API_V1_URL } from '../config/api'
import { toast } from 'sonner'
import { ApiError } from '../utils/apiClient'
import { fetchJson } from '../utils/fetchJson'
import { getRateLimitInlineMessage } from '../utils/notifyIfRateLimited'
import { useRateLimitCooldown } from '../hooks/useRateLimitCooldown'
import {
  getPasswordStrength,
  validatePassword,
  validateEmail,
  type PasswordStrength,
} from '../utils/validation'
import { validateUsername } from '../utils/validation/username'
import { localizeFieldError } from '../utils/validation/localizeFieldError'

/**
 * SignUpDialog コンポーネント
 * Issue#26: 認証機能のモーダルベース移行
 *
 * マップ画面を離れることなく新規登録を行えるダイアログ
 */

/** パスワード強度に対応するスタイルクラスを返す */
function getPasswordStrengthStyle(strength: PasswordStrength): string {
  if (strength === 'strong') return 'bg-green-100 text-green-700'
  if (strength === 'medium') return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}


interface SignUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onShowTerms: () => void
  /** Issue#104: プライバシーポリシー画面を表示する */
  onShowPrivacyPolicy: () => void
  onShowLogin: () => void
  /**
   * Issue#81 Phase 8e: キャンセルクリック時のコールバック（SignUpMethodDialog に戻る等）。
   * 省略時は従来通り onOpenChange(false) で単純に閉じる。
   */
  onBack?: () => void
}

export function SignUpDialog({
  open,
  onOpenChange,
  onShowTerms,
  onShowPrivacyPolicy,
  onShowLogin,
  onBack,
}: Readonly<SignUpDialogProps>) {
  const { t } = useTranslation()
  const [profileImage, setProfileImage] = useState<string>('')
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [snsLinks, setSnsLinks] = useState<Array<{ platform: number; url: string }>>([])
  const [isSnsEditDialogOpen, setIsSnsEditDialogOpen] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  // Issue#104: プライバシーポリシー同意チェックボックス追加
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [registerRateLimitError, setRegisterRateLimitError] = useState<ApiError | null>(null)
  const registerCooldown = useRateLimitCooldown(registerRateLimitError)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [cropperImageSrc, setCropperImageSrc] = useState('')

  const passwordStrength = password ? getPasswordStrength(password) : null

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // 表示名 (Issue#98: 軽量バリデーション)
    const usernameErrorKey = validateUsername(displayName)
    if (usernameErrorKey) {
      newErrors.displayName = t(`errors.${usernameErrorKey}`)
    }

    // メールアドレス
    const emailValidation = validateEmail(email)
    if (!emailValidation.isValid && emailValidation.errorMessage) {
      newErrors.email = emailValidation.errorMessage
    }

    // パスワード
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid && passwordValidation.errorMessage) {
      newErrors.password = passwordValidation.errorMessage
    }

    // パスワード（確認用）
    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch')
    }

    // 利用規約
    if (!agreedToTerms) {
      newErrors.terms = t('auth.agreeRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * 登録後にプロフィール画像をアップロードする
   * 画像アップロードの失敗は登録処理には影響しない
   */
  const uploadProfileImage = async (token: string, file: File) => {
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
      const contentType = file.type || 'image/png'

      const presignedResponse = await fetch(
        `${API_V1_URL}/users/me/profile-image/presigned-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ extension, contentType }),
        }
      )

      if (!presignedResponse.ok) return

      const { uploadUrl, objectKey } = await presignedResponse.json()

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
      })

      await fetch(`${API_V1_URL}/users/me/profile-image`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ objectKey }),
      })
    } catch {
      // 画像アップロードの失敗は登録処理に影響しない
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    try {
      const data = await fetchJson<{ token?: string }>(`${API_V1_URL}/auth/register`, {
        method: 'POST',
        body: {
          username: displayName,
          email,
          password,
        },
      })
      const token = data.token

      if (profileImageFile && token) {
        await uploadProfileImage(token, profileImageFile)
      }

      const filledSnsLinks = snsLinks.filter(link => link.url.trim() !== '')
      if (filledSnsLinks.length > 0 && token) {
        await uploadSnsLinks(token, filledSnsLinks)
      }

      toast(t('auth.signupSuccess'), {
        duration: 8000,
      })
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isRateLimited) {
          setRegisterRateLimitError(err)
          setErrors({ general: getRateLimitInlineMessage(err, t) })
        } else if (err.status === 409) {
          setErrors({ email: t('auth.emailAlreadyUsed') })
        } else if (err.status === 400) {
          // Issue#98: バリデーションエラーの field-level メッセージを取得
          const usernameErr = err.getFieldErrorMessage('username')
          if (usernameErr) {
            setErrors({ displayName: localizeFieldError(usernameErr, t) })
          } else {
            setErrors({ general: t('auth.signupFailed') })
          }
        } else {
          setErrors({ general: t('auth.signupFailed') })
        }
      } else {
        setErrors({ general: t('auth.signupFailed') })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setCropperImageSrc(reader.result as string)
        setIsCropperOpen(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCropComplete = (croppedBlob: Blob) => {
    const url = URL.createObjectURL(croppedBlob)
    setProfileImage(url)
    const croppedFile = new File([croppedBlob], 'profile.jpg', { type: 'image/jpeg' })
    setProfileImageFile(croppedFile)
    setIsCropperOpen(false)
  }

  const handleCropCancel = () => {
    setIsCropperOpen(false)
    setCropperImageSrc('')
  }

  const handleLoginClick = () => {
    onOpenChange(false)
    onShowLogin()
  }

  const handleCancelClick = () => {
    // Issue#81 Phase 8e: onBack 指定時は親のダイアログ切替に委ね、onOpenChange(false) は呼ばない
    if (onBack) {
      onBack()
      return
    }
    onOpenChange(false)
  }

  /**
   * 登録後にSNSリンクをサーバーに送信する
   * SNSリンク送信の失敗は登録処理には影響しない
   */
  const uploadSnsLinks = async (token: string, links: Array<{ platform: number; url: string }>) => {
    try {
      await fetch(`${API_V1_URL}/users/me/sns-links`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ snsLinks: links.map(({ platform, url }) => ({ platform, url })) }),
      })
    } catch {
      // SNSリンク送信の失敗は登録処理に影響しない
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>{t('auth.signupTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('auth.signupDescription')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        <div className="space-y-10 mt-4">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          {/* OAuth 登録への誘導リンク */}
          <div className="text-center text-sm text-gray-600">
            {t('auth.oauthSignupNotice')}
            <Button
              variant="link"
              className="p-0 h-auto ml-1"
              onClick={handleLoginClick}
            >
              {t('auth.oauthSignupNoticeLink')}
            </Button>
          </div>

          {/* プロフィール画像 */}
          <div className="space-y-3">
            <Label>{t('auth.profileImage')}</Label>
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
                {t('auth.selectImage')}
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
            <Label htmlFor="displayName">{t('auth.displayName')}</Label>
            <p className="text-xs text-gray-500 whitespace-pre-line">{t('auth.displayNameFormatHint')}</p>
            {errors.displayName && (
              <p className="text-sm text-red-600">{errors.displayName}</p>
            )}
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('auth.displayNamePlaceholder')}
            />
          </div>

          {/* メールアドレス */}
          <div className="space-y-2">
            <Label htmlFor="signup-email">{t('auth.emailRequired')}</Label>
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email}</p>
            )}
            <Input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>

          {/* パスワード */}
          <div className="space-y-2">
            <Label htmlFor="signup-password">{t('auth.passwordRequired')}</Label>
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password}</p>
            )}
            <p className="text-xs text-gray-500">{t('auth.passwordFormatHint')}</p>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordExample')}
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
            {passwordStrength && (
              <div className="flex items-center gap-2">
                <span className="text-sm">{t('auth.passwordStrength')}</span>
                <div
                  className={`text-sm px-2 py-1 rounded ${getPasswordStrengthStyle(passwordStrength)}`}
                >
                  {passwordStrength === 'strong' ? t('auth.strengthStrong') : passwordStrength === 'medium' ? t('auth.strengthMedium') : t('auth.strengthWeak')}
                </div>
              </div>
            )}
          </div>

          {/* パスワード（確認用） */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.passwordConfirm')}</Label>
            {errors.confirmPassword && (
              <p className="text-sm text-red-600">{errors.confirmPassword}</p>
            )}
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.passwordConfirmPlaceholder')}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                type="button"
                aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* SNSリンク */}
          <div className="space-y-3">
            <Label>{t('auth.snsLinks')}</Label>
            {snsLinks.length > 0 && (
              <p className="text-sm text-gray-600">
                {snsLinks.map(l => l.url).join(', ')}
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => setIsSnsEditDialogOpen(true)}
              className="w-full"
              type="button"
            >
              {snsLinks.length > 0 ? t('auth.editSnsLinks') : t('auth.addSnsLinks')}
            </Button>
          </div>

          <Separator />

          {/* 利用規約・プライバシーポリシー（Issue#104 でプライバシーポリシー追加） */}
          <div className="space-y-3 my-[50px]">
            {errors.terms && (
              <p className="text-sm text-red-600">{errors.terms}</p>
            )}
            <div className="flex items-center justify-center space-x-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <label htmlFor="terms" className="text-sm">
                <a
                  href="#"
                  role="link"
                  className="text-blue-600 underline hover:text-blue-800"
                  onClick={(e) => {
                    e.preventDefault()
                    onShowTerms()
                  }}
                >
                  {t('auth.termsOfService')}
                </a>
                {t('auth.agreeToTerms')}
              </label>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Checkbox
                id="privacy"
                checked={agreedToPrivacy}
                onCheckedChange={(checked) => setAgreedToPrivacy(checked === true)}
              />
              <label htmlFor="privacy" className="text-sm">
                <a
                  href="#"
                  role="link"
                  className="text-blue-600 underline hover:text-blue-800"
                  onClick={(e) => {
                    e.preventDefault()
                    onShowPrivacyPolicy()
                  }}
                >
                  {t('auth.privacyPolicy')}
                </a>
                {t('auth.termsAgreement.agreeToPrivacyPolicySuffix')}
              </label>
            </div>
          </div>

          {/* ボタン（Issue#81 Phase 8r-2: 「キャンセル」→「戻る」、handleCancelClick → handleBackClick 相当） */}
          <div className="flex gap-3 pt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCancelClick}
            >
              {t('common.back')}
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isLoading || registerCooldown.isOnCooldown || !displayName.trim() || !email.trim() || !password || !confirmPassword || !agreedToTerms || !agreedToPrivacy}
              aria-live="polite"
            >
              {registerCooldown.isOnCooldown
                ? t('common.submitWithCooldown', { seconds: registerCooldown.remainingSeconds })
                : t('auth.register')}
            </Button>
          </div>

          {/* Issue#81 Phase 8e: OAuth 新規登録ボタンは OAuthSignUpDialog に分離したため削除 */}
        </div>

        {/* プロフィール画像トリミングモーダル */}
        {isCropperOpen && (
          <ProfileImageCropper
            imageSrc={cropperImageSrc}
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
          />
        )}

        {/* SNSリンク編集ダイアログ */}
        <SnsLinkEditDialog
          open={isSnsEditDialogOpen}
          onOpenChange={setIsSnsEditDialogOpen}
          initialLinks={snsLinks}
          onSave={(newLinks) => {
            setSnsLinks(newLinks)
          }}
        />
        </div>
      </DialogContent>
    </Dialog>
  )
}
