/**
 * Issue#118: 登録壁オーバーレイ。
 *
 * 写真詳細を10件閲覧した未ログインユーザーに対して、画面全体を覆う形で表示する。
 * shadcn/ui の Dialog ではなく独自実装にしている理由:
 *   - Esc キー / 背景クリックで閉じられないようにするため（Dialog のデフォルトを無効化するより素直）
 *   - z-index を 70 に固定して通常 Dialog（50）/ Cookie バナー（60）の上に乗せるため
 *   - 「閉じるボタン無し」を強制する
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { trackRegistrationWallEvent } from '../utils/registrationWallAnalytics'

interface RegistrationWallOverlayProps {
  isOpen: boolean
  onClickSignUp: () => void
  onClickLogin: () => void
  onClickAbout: () => void
}

export function RegistrationWallOverlay({
  isOpen,
  onClickSignUp,
  onClickLogin,
  onClickAbout,
}: Readonly<RegistrationWallOverlayProps>) {
  const { t } = useTranslation()
  const signUpButtonRef = useRef<HTMLButtonElement>(null)

  // 開いた瞬間に「表示イベント送信」と「自動フォーカス」を一括処理
  useEffect(() => {
    if (!isOpen) return
    trackRegistrationWallEvent('registration_wall_shown')
    signUpButtonRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  const handleSignUpClick = () => {
    trackRegistrationWallEvent('registration_wall_signup_click')
    onClickSignUp()
  }

  const handleLoginClick = () => {
    trackRegistrationWallEvent('registration_wall_login_click')
    onClickLogin()
  }

  const handleAboutClick = () => {
    trackRegistrationWallEvent('registration_wall_about_click')
    onClickAbout()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="registration-wall-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
        <h2 id="registration-wall-title" className="mb-4 text-xl font-bold leading-snug">
          {t('registrationWall.title')}
        </h2>
        <p className="mb-2 text-sm">{t('registrationWall.thanks')}</p>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          {t('registrationWall.description')}
        </p>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <button
            ref={signUpButtonRef}
            type="button"
            onClick={handleSignUpClick}
            className="min-h-[44px] flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('registrationWall.signupButton')}
          </button>
          <button
            type="button"
            onClick={handleLoginClick}
            className="min-h-[44px] flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('registrationWall.loginButton')}
          </button>
        </div>
        <div className="text-center">
          <button
            type="button"
            onClick={handleAboutClick}
            className="text-sm text-muted-foreground underline hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('registrationWall.aboutLink')}
          </button>
        </div>
      </div>
    </div>
  )
}
