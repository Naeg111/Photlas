import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { toast } from 'sonner'
import { API_V1_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'

/**
 * Issue#104: 利用規約・プライバシーポリシー同意ダイアログ
 *
 * <p>OAuth 経由の新規ユーザーが認証完了後に表示するダイアログ。
 * 利用規約とプライバシーポリシーへの同意を必須とし、両方チェックされるまで
 * 「利用を開始する」ボタンが活性化しない。
 *
 * <p>キャンセル時は未同意アカウントを物理削除（DELETE cancel-registration）し、
 * ログアウト + トースト表示してホームに戻る。
 *
 * <p>右上の閉じるボタン（×）は設けない（モーダルで強制同意フローのため）。
 */
interface TermsAgreementDialogProps {
  open: boolean
  /** 「利用を開始する」押下後の同意完了コールバック */
  onAgreed: () => void
  /** 「キャンセル」押下後のコールバック（呼び出し側でログアウト等を行う） */
  onCancelled: () => void
  /** 利用規約画面を表示する */
  onShowTerms: () => void
  /** プライバシーポリシー画面を表示する */
  onShowPrivacyPolicy: () => void
}

export default function TermsAgreementDialog({
  open,
  onAgreed,
  onCancelled,
  onShowTerms,
  onShowPrivacyPolicy,
}: TermsAgreementDialogProps) {
  const { t } = useTranslation()
  const { logout, getAuthToken } = useAuth()
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  // Issue#109: 13 歳以上であることの自己申告
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canStart = agreedTerms && agreedPrivacy && ageConfirmed && !isSubmitting

  /** 「利用を開始する」押下: POST /agree-terms 後に親に通知 */
  const handleStart = async () => {
    if (!canStart) return
    setIsSubmitting(true)
    try {
      const token = getAuthToken()
      await fetch(`${API_V1_URL}/users/me/agree-terms`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      toast(t('auth.loginSuccess'))
      onAgreed()
    } catch {
      toast(t('auth.errorOccurred'))
      setIsSubmitting(false)
    }
  }

  /** 「キャンセル」押下: DELETE /cancel-registration → logout → トップへ → トースト表示 */
  const handleCancel = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    const token = getAuthToken()
    // API 失敗時もログアウト処理は実行する（最低限ログアウト状態を保証）
    try {
      await fetch(`${API_V1_URL}/users/me/cancel-registration`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch {
      // ネットワークエラー等は無視（後段の logout + リダイレクトを実行）
    }
    logout()
    toast(t('auth.termsAgreement.cancelledToast'))
    onCancelled()
  }

  return (
    <Dialog open={open}>
      <DialogContent
        hideCloseButton={true}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('auth.termsAgreement.title')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('auth.oauth.consentNotice')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="terms-agreement-tos"
              checked={agreedTerms}
              onCheckedChange={(checked) => setAgreedTerms(checked === true)}
              disabled={isSubmitting}
            />
            <label htmlFor="terms-agreement-tos" className="text-sm">
              <button
                type="button"
                className="text-blue-600 underline hover:text-blue-800"
                onClick={onShowTerms}
              >
                {t('auth.termsOfService')}
              </button>
              {t('auth.agreeToTerms')}
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="terms-agreement-pp"
              checked={agreedPrivacy}
              onCheckedChange={(checked) => setAgreedPrivacy(checked === true)}
              disabled={isSubmitting}
            />
            <label htmlFor="terms-agreement-pp" className="text-sm">
              <button
                type="button"
                className="text-blue-600 underline hover:text-blue-800"
                onClick={onShowPrivacyPolicy}
              >
                {t('auth.privacyPolicy')}
              </button>
              {t('auth.termsAgreement.agreeToPrivacyPolicySuffix')}
            </label>
          </div>

          {/* Issue#109: 13 歳以上であることの自己申告 */}
          <div className="flex items-center space-x-3">
            <Checkbox
              id="terms-agreement-age"
              checked={ageConfirmed}
              onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
              disabled={isSubmitting}
            />
            <label htmlFor="terms-agreement-age" className="text-sm">
              {t('auth.ageConfirmation')}
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <Button
            type="button"
            className="w-full"
            onClick={handleStart}
            disabled={!canStart}
          >
            {t('auth.termsAgreement.start')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {t('auth.termsAgreement.cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
