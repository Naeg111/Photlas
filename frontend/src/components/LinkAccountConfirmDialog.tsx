import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { API_V1_URL } from '../config/api'
import { ApiError } from '../utils/apiClient'
import { fetchJson } from '../utils/fetchJson'

interface LinkAccountConfirmDialogProps {
  open: boolean
  /** OAuthCallbackPage 経由で渡される短命トークン（hex 64 文字） */
  linkConfirmationToken: string
  /** プロバイダ表示用（"GOOGLE" | "LINE"） */
  provider: string
  onClose: () => void
  /** リンク成功時に JWT とメールアドレスを親に渡す */
  onLinked: (token: string, email: string) => void
}

/**
 * Issue#81 Phase 5d - 既存アカウントとの OAuth 連携確認ダイアログ。
 *
 * OAuth ログイン時に email が既存のパスワードアカウントに一致した場合、
 * バックエンドが短命トークンを発行して `/oauth/callback#link_confirmation_token=...`
 * にリダイレクトする。本ダイアログでユーザーに確認を取り、「連携する」を選ぶと
 * `POST /api/v1/auth/oauth2/confirm-link` に token を送信して UserOAuthConnection を
 * 作成する。
 */
export default function LinkAccountConfirmDialog({
  open,
  linkConfirmationToken,
  provider,
  onClose,
  onLinked,
}: LinkAccountConfirmDialogProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleLink = async () => {
    setErrorMessage('')
    setIsLoading(true)
    try {
      const response = await fetchJson<{ token: string; email: string }>(
        `${API_V1_URL}/auth/oauth2/confirm-link`,
        {
          method: 'POST',
          body: { token: linkConfirmationToken },
        }
      )
      onLinked(response.token, response.email)
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.responseMessage || t('auth.errorOccurred'))
      } else {
        setErrorMessage(t('auth.errorOccurred'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('auth.oauth.linkConfirm.title')}</DialogTitle>
          <DialogDescription>
            {t('auth.oauth.linkConfirm.description', { provider: formatProvider(provider) })}
          </DialogDescription>
        </DialogHeader>
        {errorMessage && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage}
          </p>
        )}
        <DialogFooter className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            {t('auth.oauth.linkConfirm.cancel')}
          </Button>
          <Button type="button" onClick={handleLink} disabled={isLoading}>
            {t('auth.oauth.linkConfirm.link')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatProvider(code: string): string {
  switch (code) {
    case 'GOOGLE':
      return 'Google'
    case 'LINE':
      return 'LINE'
    default:
      return code
  }
}
