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
          {/* 行全体を <label> でラップしてクリック範囲を行全体に拡大。
              内部の <button>（利用規約等のリンク）を押した場合は HTML 仕様上 label 連動が
              発動しないため、それ以外（チェックボックス本体・余白・「に同意する」テキスト）
              のどこを押してもチェックボックスがトグルする。
              p-2 -mx-2 で見た目を維持しつつタッチ領域を上下8px拡大している。 */}
          <label
            htmlFor="terms-agreement-tos"
            className="flex items-center space-x-3 cursor-pointer p-2 -mx-2 select-none"
          >
            <Checkbox
              id="terms-agreement-tos"
              checked={agreedTerms}
              onCheckedChange={(checked) => setAgreedTerms(checked === true)}
              disabled={isSubmitting}
            />
            <span className="text-sm">
              <button
                type="button"
                className="text-blue-600 underline hover:text-blue-800"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onShowTerms()
                }}
              >
                {t('auth.termsOfService')}
              </button>
              {t('auth.agreeToTerms')}
            </span>
          </label>

          <label
            htmlFor="terms-agreement-pp"
            className="flex items-center space-x-3 cursor-pointer p-2 -mx-2 select-none"
          >
            <Checkbox
              id="terms-agreement-pp"
              checked={agreedPrivacy}
              onCheckedChange={(checked) => setAgreedPrivacy(checked === true)}
              disabled={isSubmitting}
            />
            <span className="text-sm">
              <button
                type="button"
                className="text-blue-600 underline hover:text-blue-800"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onShowPrivacyPolicy()
                }}
              >
                {t('auth.privacyPolicy')}
              </button>
              {t('auth.termsAgreement.agreeToPrivacyPolicySuffix')}
            </span>
          </label>

          {/* Issue#109: 13 歳以上であることの自己申告 */}
          <label
            htmlFor="terms-agreement-age"
            className="flex items-center space-x-3 cursor-pointer p-2 -mx-2 select-none"
          >
            <Checkbox
              id="terms-agreement-age"
              checked={ageConfirmed}
              onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
              disabled={isSubmitting}
            />
            <span className="text-sm">
              {t('auth.ageConfirmation')}
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <Button
            type="button"
            className="w-full h-11"
            onClick={handleStart}
            disabled={!canStart}
          >
            {t('auth.termsAgreement.start')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
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
