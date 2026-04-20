import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, X } from 'lucide-react'
import { API_V1_URL } from '../config/api'
import { fetchJson } from '../utils/fetchJson'
import { useAuth } from '../contexts/AuthContext'

interface PasswordRecommendationBannerProps {
  /** CTA クリック時に親から AccountSettingsDialog を開くためのハンドラ */
  onOpenPasswordSection?: () => void
}

/**
 * Issue#81 Phase 5e - OAuth のみユーザー向けパスワード設定推奨バナー（Round 12 / Q8）。
 *
 * ログイン中のみ GET /api/v1/users/me/password-recommendation で表示要否を取得。
 * - shouldRecommend=true のときのみレンダリング
 * - 「パスワードを設定する」: 親の onOpenPasswordSection で AccountSettingsDialog を開く
 * - 「×」: POST /api/v1/users/me/password-recommendation/dismiss で 7 日間抑止して非表示
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
        // フェイルセーフ: 取得失敗時はバナーを出さない
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

  if (!shouldRecommend) return null

  const providerDisplay = provider === 'GOOGLE' ? 'Google' : provider === 'LINE' ? 'LINE' : ''

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3"
    >
      <div className="max-w-6xl mx-auto flex items-start gap-3">
        <ShieldCheck className="flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <p className="font-semibold text-sm">
            {t('auth.oauth.passwordRecommend.title')}
          </p>
          <p className="text-sm">
            {t('auth.oauth.passwordRecommend.description', { provider: providerDisplay })}
          </p>
          {onOpenPasswordSection && (
            <button
              type="button"
              onClick={onOpenPasswordSection}
              className="mt-1 text-sm underline hover:no-underline font-medium"
            >
              {t('auth.oauth.passwordRecommend.cta')}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('auth.oauth.passwordRecommend.dismiss')}
          className="flex-shrink-0 p-1 hover:bg-amber-100 rounded"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
