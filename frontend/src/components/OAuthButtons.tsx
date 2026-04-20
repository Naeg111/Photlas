import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { API_BASE_URL } from '../config/api'
import i18n from '../i18n'

/**
 * Issue#81 Phase 5b - Google / LINE サインインボタン。
 *
 * VITE_OAUTH_ENABLED !== 'true' の場合は何もレンダリングしない（ローカル開発で OAuth OFF）。
 * クリック時は `/api/v1/auth/oauth2/authorization/<provider>?lang=<current_lang>` に遷移し、
 * Spring Security OAuth2 の認可フローを開始する。
 */
type Variant = 'signIn' | 'signUp'

interface OAuthButtonsProps {
  variant?: Variant
  /** テスト・上書き用。省略時は import.meta.env.VITE_OAUTH_ENABLED を参照 */
  enabled?: boolean
}

export default function OAuthButtons({ variant = 'signIn', enabled }: OAuthButtonsProps) {
  const { t } = useTranslation()
  const oauthEnabled = enabled ?? isOAuthEnabled()

  if (!oauthEnabled) {
    return null
  }

  const handleClick = (provider: 'google' | 'line') => {
    const lang = i18n.language || 'ja'
    const base = API_BASE_URL || ''
    window.location.href = `${base}/api/v1/auth/oauth2/authorization/${provider}?lang=${encodeURIComponent(lang)}`
  }

  const googleLabel = variant === 'signUp'
    ? t('auth.oauth.signUpWithGoogle')
    : t('auth.oauth.signInWithGoogle')
  const lineLabel = variant === 'signUp'
    ? t('auth.oauth.signUpWithLine')
    : t('auth.oauth.signInWithLine')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-500">{t('auth.oauth.dividerOr')}</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => handleClick('google')}
        aria-label={googleLabel}
      >
        {googleLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full bg-[#06C755] hover:bg-[#05b34b] text-white border-transparent"
        onClick={() => handleClick('line')}
        aria-label={lineLabel}
      >
        {lineLabel}
      </Button>
    </div>
  )
}

function isOAuthEnabled(): boolean {
  // Vite の型定義に合わせて import.meta.env を any 扱いにはしないが、
  // テストでは enabled prop で上書きすることを想定
  const value = (import.meta.env as Record<string, unknown>).VITE_OAUTH_ENABLED
  return value === 'true' || value === true
}
