import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { API_V1_URL } from '../config/api'
import { fetchJson } from '../utils/fetchJson'
import { useAuth } from '../contexts/AuthContext'

interface PasswordRecommendationBannerProps {
  /** CTA クリック時に親から AccountSettingsDialog を開くためのハンドラ */
  onOpenPasswordSection?: () => void
}

/**
 * Issue#81 Phase 5e - OAuth のみユーザー向けパスワード設定推奨ダイアログ。
 *
 * ログイン中のみ GET /api/v1/users/me/password-recommendation で表示要否を取得。
 * - shouldRecommend=true のときのみダイアログを開く
 * - 「パスワードを設定する」: 親の onOpenPasswordSection で AccountSettingsDialog を開く
 * - 「閉じる」 / オーバーレイクリック: POST /api/v1/users/me/password-recommendation/dismiss で 7 日間抑止
 */
export default function PasswordRecommendationBanner({ onOpenPasswordSection }: PasswordRecommendationBannerProps) {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const [shouldRecommend, setShouldRecommend] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setShouldRecommend(false)
      return
    }

    let cancelled = false
    const fetchRecommendation = async () => {
      try {
        const data = await fetchJson<{ shouldRecommend: boolean; provider: string | null }>(
          `${API_V1_URL}/users/me/password-recommendation`,
          { requireAuth: true }
        )
        if (!cancelled) {
          setShouldRecommend(data.shouldRecommend)
          setProvider(data.provider)
        }
      } catch {
        // フェイルセーフ: 取得失敗時はダイアログを出さない
        if (!cancelled) setShouldRecommend(false)
      }
    }

    fetchRecommendation()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const handleDismiss = async () => {
    setShouldRecommend(false)
    try {
      await fetchJson(
        `${API_V1_URL}/users/me/password-recommendation/dismiss`,
        { method: 'POST', requireAuth: true }
      )
    } catch {
      // dismiss 失敗時でも UI は閉じる（次回判定は API に任せる）
    }
  }

  const handleCta = () => {
    setShouldRecommend(false)
    onOpenPasswordSection?.()
  }

  const providerDisplay = provider === 'GOOGLE' ? 'Google' : provider === 'LINE' ? 'LINE' : ''

  return (
    <Dialog open={shouldRecommend} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>{t('auth.oauth.passwordRecommend.title')}</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          {t('auth.oauth.passwordRecommend.description', { provider: providerDisplay })}
        </DialogDescription>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleDismiss}>
            {t('auth.oauth.passwordRecommend.dismiss')}
          </Button>
          {onOpenPasswordSection && (
            <Button type="button" onClick={handleCta}>
              {t('auth.oauth.passwordRecommend.cta')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
