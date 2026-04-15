import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { validatePassword } from '../utils/validation'
import { API_V1_URL } from '../config/api'

/** ページ共通のレイアウトクラス */
const PAGE_LAYOUT_CLASS = 'min-h-screen flex items-center justify-center bg-gray-50'

/** カードコンテナの共通クラス */
const CARD_CLASS = 'max-w-md w-full mx-4 bg-white rounded-lg shadow-md p-8'

/**
 * パスワードリセット完了ページ
 *
 * Issue#56: メール内のリセットリンクからアクセスされるページ。
 * 新しいパスワードを入力してリセットを完了する。
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const token = searchParams.get('token')

  useDocumentTitle('パスワードの再設定 - Photlas')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isShowingNewPassword, setIsShowingNewPassword] = useState(false)
  const [isShowingConfirmPassword, setIsShowingConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validation = validatePassword(newPassword)
    if (!validation.isValid) {
      setError(validation.errorMessage!)
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_V1_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      })

      if (response.ok) {
        setIsSuccess(true)
      } else {
        const data = await response.json()
        setError(data.message || t('auth.errorOccurred'))
      }
    } catch {
      setError(t('auth.errorOccurred'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLoginClick = () => {
    navigate('/', { state: { openLogin: true } })
  }

  if (!token) {
    return (
      <div className={PAGE_LAYOUT_CLASS}>
        <div className={`${CARD_CLASS} text-center`}>
          <div className="text-red-500 text-5xl mb-4">&#10007;</div>
          <h2 className="text-xl font-bold mb-2">{t('pages.invalidLink')}</h2>
          <p className="text-gray-600 mb-4">
            {t('pages.invalidLinkMessage')}
          </p>
          <button
            onClick={() => navigate('/')}
            className="text-primary hover:underline"
          >
            {t('common.home')}
          </button>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className={PAGE_LAYOUT_CLASS}>
        <div className={`${CARD_CLASS} text-center`}>
          <div className="text-green-500 text-5xl mb-4">&#10003;</div>
          <h2 className="text-xl font-bold mb-2">{t('pages.passwordResetComplete')}</h2>
          <p className="text-gray-600 mb-4">
            {t('pages.passwordResetCompleteMessage')}
          </p>
          <button
            onClick={handleLoginClick}
            className="mt-2 px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            {t('pages.goToLogin')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={PAGE_LAYOUT_CLASS}>
      <div className={CARD_CLASS}>
        <h2 className="text-xl font-bold mb-6 text-center">{t('pages.resetPassword')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              {t('pages.newPassword')}
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={isShowingNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                placeholder={t('pages.newPasswordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setIsShowingNewPassword(!isShowingNewPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                aria-label={isShowingNewPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {isShowingNewPassword ? t('auth.hide') : t('auth.show')}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              {t('pages.newPasswordConfirm')}
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={isShowingConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                placeholder={t('pages.newPasswordConfirmPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setIsShowingConfirmPassword(!isShowingConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                aria-label={isShowingConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {isShowingConfirmPassword ? t('auth.hide') : t('auth.show')}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('pages.submitting') : t('pages.resetPasswordButton')}
          </button>
        </form>
      </div>
    </div>
  )
}
