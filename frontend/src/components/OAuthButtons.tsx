import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { API_BASE_URL } from '../config/api'
import i18n from '../i18n'
import { GoogleIcon } from './icons/GoogleIcon'
import { LineIcon } from './icons/LineIcon'

/**
 * Issue#81 Phase 5b - Google / LINE サインインボタン。
 *
 * <p>Phase 8a (Q4) 以降の仕様:
 * - {@code enabled=false}（OAuth 環境無効）でもボタンは表示し、{@code disabled} 状態にする。
 * - {@code disabled=true} でも両ボタンを非活性にし、クリック時の遷移を抑止する。
 * - {@code hideDivider=true} で「または」区切り線を描画しない（LoginDialog 等、
 *   外側で {@code <hr>} 等を使う場合用）。
 *
 * <p>最終的な非活性判定: {@code disabled || !(enabled ?? isOAuthEnabled())}。
 */
type Variant = 'signIn' | 'signUp'

interface OAuthButtonsProps {
  variant?: Variant
  /** テスト・上書き用。省略時は {@code import.meta.env.VITE_OAUTH_ENABLED} を参照 */
  enabled?: boolean
  /** クリック不可にするが表示は維持（利用規約未チェック等）。 */
  disabled?: boolean
  /** true で「または」区切り線を描画しない。LoginDialog は外側で {@code <hr>} を使う。 */
  hideDivider?: boolean
}

export default function OAuthButtons({
  variant = 'signIn',
  enabled,
  disabled = false,
  hideDivider = false,
}: OAuthButtonsProps) {
  const { t } = useTranslation()
  const oauthEnabled = enabled ?? isOAuthEnabled()
  const effectiveDisabled = disabled || !oauthEnabled

  const handleClick = (provider: 'google' | 'line') => {
    if (effectiveDisabled) return
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
      {!hideDivider && (
        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-500">{t('auth.oauth.dividerOr')}</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full h-11 gap-3"
        onClick={() => handleClick('google')}
        disabled={effectiveDisabled}
        aria-label={googleLabel}
      >
        <GoogleIcon className="size-5 shrink-0" />
        {googleLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full h-11 gap-3 bg-[#06C755] hover:bg-[#05b34b] text-white border-transparent disabled:bg-gray-200 disabled:text-gray-500"
        onClick={() => handleClick('line')}
        disabled={effectiveDisabled}
        aria-label={lineLabel}
      >
        <LineIcon className="size-5 shrink-0" />
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
