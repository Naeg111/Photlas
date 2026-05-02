import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { API_V1_URL } from '../config/api'
import { isInAppBrowser } from '../utils/isInAppBrowser'

/**
 * Issue#110: メールアドレス変更完了マーカーの localStorage キー。
 * 認証成功時にこのキーへタイムスタンプを書き込むことで、
 * 同一ブラウザの別タブにある App.tsx が `storage` イベントで検知し、
 * 古いセッションを破棄してログインダイアログを開く。
 */
export const EMAIL_JUST_CHANGED_KEY = 'email_just_changed'

/**
 * Issue#86: メールアドレス変更確認ページ
 *
 * 確認リンクからアクセスされるページ。
 * URL の token パラメータを使って確認 API を呼び出す。
 *
 * Issue#110 の対応により以下の動作になる:
 * - 認証成功時に logout() を呼んで古いセッションを破棄する（再ログインを強制）
 * - localStorage へマーカーを書き込み、別タブにも再ログインを促す
 * - 自動遷移は行わない。ユーザーが「Photlasを開く」リンクで自分から遷移する
 * - アプリ内ブラウザでは「Photlasを開く」「ホーム」リンクを非表示にする
 */
export default function ConfirmEmailChangePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { logout } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const inAppBrowser = isInAppBrowser()

  useEffect(() => {
    const token = searchParams.get('token')

    if (!token) {
      setStatus('error')
      setErrorMessage(t('pages.confirmTokenNotFound'))
      return
    }

    const confirmEmailChange = async () => {
      try {
        const response = await fetch(
          `${API_V1_URL}/auth/confirm-email-change?token=${encodeURIComponent(token)}`
        )

        if (response.ok) {
          // Issue#110: 自動ログイン更新は行わず、再ログインを強制する
          //   - 古いセッション（旧メアドの JWT）を破棄
          //   - 別タブにマーカーで通知（同一ブラウザの別タブのみ反映）
          logout()
          localStorage.setItem(EMAIL_JUST_CHANGED_KEY, String(Date.now()))
          setStatus('success')
        } else if (response.status === 409) {
          setStatus('error')
          setErrorMessage(t('pages.emailAlreadyUsedByOther'))
        } else {
          const data = await response.json().catch(() => null)
          setStatus('error')
          setErrorMessage(data?.message || t('auth.errorOccurred'))
        }
      } catch {
        setStatus('error')
        setErrorMessage(t('auth.errorOccurred'))
      }
    }

    confirmEmailChange()
  }, [searchParams, logout, t])

  const handleOpenPhotlas = () => {
    navigate('/', { state: { openLogin: true } })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-gray-600">{t('pages.emailChangeVerifying')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-500 text-5xl mb-4">&#10003;</div>
            <h2 className="text-xl font-bold mb-2">{t('pages.emailChangeComplete')}</h2>
            <p className="text-gray-600 mb-4">
              {inAppBrowser
                ? t('pages.emailChangeCompleteMessageInApp')
                : t('pages.emailChangeCompleteMessage')}
            </p>
            {!inAppBrowser && (
              <button
                onClick={handleOpenPhotlas}
                className="mt-4 text-primary hover:underline"
              >
                {t('pages.openPhotlas')}
              </button>
            )}
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-500 text-5xl mb-4">&#10007;</div>
            <h2 className="text-xl font-bold mb-2">{t('pages.confirmError')}</h2>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            {!inAppBrowser && (
              <button
                onClick={() => navigate('/')}
                className="mt-4 text-primary hover:underline"
              >
                {t('common.home')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
