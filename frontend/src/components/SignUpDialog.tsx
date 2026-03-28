import { useState, useRef } from 'react'
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
import {
  getPasswordStrength,
  validatePassword,
  validateEmail,
  type PasswordStrength,
} from '../utils/validation'

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

/** パスワード強度に対応するラベルを返す */
function getPasswordStrengthLabel(strength: PasswordStrength): string {
  if (strength === 'strong') return '強'
  if (strength === 'medium') return '中'
  return '弱'
}

interface SignUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onShowTerms: () => void
  onShowLogin: () => void
}

export function SignUpDialog({
  open,
  onOpenChange,
  onShowTerms,
  onShowLogin,
}: Readonly<SignUpDialogProps>) {
  const [profileImage, setProfileImage] = useState<string>('')
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [snsLinks, setSnsLinks] = useState<Array<{ platform: string; url: string }>>([])
  const [isSnsEditDialogOpen, setIsSnsEditDialogOpen] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [cropperImageSrc, setCropperImageSrc] = useState('')

  const passwordStrength = password ? getPasswordStrength(password) : null

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // 表示名
    if (!displayName.trim()) {
      newErrors.displayName = '表示名を入力してください'
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
      newErrors.confirmPassword = 'パスワードが一致しません'
    }

    // 利用規約
    if (!agreedToTerms) {
      newErrors.terms = '利用規約に同意してください'
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
      const response = await fetch(`${API_V1_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: displayName,
          email,
          password,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const token = data.token

        // プロフィール画像が選択されていればアップロード
        if (profileImageFile && token) {
          await uploadProfileImage(token, profileImageFile)
        }

        // SNSリンクが入力されていれば送信
        const filledSnsLinks = snsLinks.filter(link => link.url.trim() !== '')
        if (filledSnsLinks.length > 0 && token) {
          await uploadSnsLinks(token, filledSnsLinks)
        }

        toast('確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。', {
          duration: 8000,
        })
        onOpenChange(false)
      } else if (response.status === 409) {
        setErrors({ email: 'このメールアドレスは既に登録されています' })
      } else {
        setErrors({ general: '登録に失敗しました' })
      }
    } catch {
      setErrors({ general: '登録に失敗しました' })
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
    onOpenChange(false)
  }

  /**
   * 登録後にSNSリンクをサーバーに送信する
   * SNSリンク送信の失敗は登録処理には影響しない
   */
  const uploadSnsLinks = async (token: string, links: Array<{ platform: string; url: string }>) => {
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
            <DialogTitle>アカウント作成</DialogTitle>
            <DialogDescription className="sr-only">
              新しいアカウントを作成する
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
            <Label htmlFor="signup-email">メールアドレス *</Label>
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email}</p>
            )}
            <Input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@photlas.com"
            />
          </div>

          {/* パスワード */}
          <div className="space-y-2">
            <Label htmlFor="signup-password">パスワード *</Label>
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password}</p>
            )}
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
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
                aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            {passwordStrength && (
              <div className="flex items-center gap-2">
                <span className="text-sm">強度:</span>
                <div
                  className={`text-sm px-2 py-1 rounded ${getPasswordStrengthStyle(passwordStrength)}`}
                >
                  {getPasswordStrengthLabel(passwordStrength)}
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
                type={showConfirmPassword ? 'text' : 'password'}
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
                aria-label={showConfirmPassword ? 'パスワードを非表示' : 'パスワードを表示'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* SNSリンク */}
          <div className="space-y-3">
            <Label>SNSリンク（任意）</Label>
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
              {snsLinks.length > 0 ? 'SNSリンクを編集' : 'SNSリンクを追加'}
            </Button>
          </div>

          <Separator />

          {/* 利用規約 */}
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
                  利用規約
                </a>
                に同意する
              </label>
            </div>
          </div>

          {/* ログインリンク Issue#26: 追加実装 */}
          <div className="text-center text-sm text-gray-600">
            すでにアカウントをお持ちの方は
            <Button
              variant="link"
              className="p-0 h-auto ml-1"
              onClick={handleLoginClick}
            >
              ログイン
            </Button>
          </div>

          {/* ボタン */}
          <div className="flex gap-3 pt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCancelClick}
            >
              キャンセル
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isLoading || !displayName.trim() || !email.trim() || !password || !confirmPassword || !agreedToTerms}
            >
              登録する
            </Button>
          </div>
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
