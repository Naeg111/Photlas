import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { API_V1_URL } from '../config/api'
import { ApiError } from '../utils/apiClient'
import { fetchJson } from '../utils/fetchJson'
import { getRateLimitInlineMessage } from '../utils/notifyIfRateLimited'
import { isInAppBrowser } from '../utils/isInAppBrowser'

/**
 * Issue#110: メール認証完了マーカーの localStorage キー。
 * 認証成功時にこのキーへタイムスタンプを書き込むことで、
 * 同一ブラウザの別タブにある App.tsx が `storage` イベントで検知し、
 * ログインダイアログを自動で開く。
 */
export const EMAIL_JUST_VERIFIED_KEY = 'email_just_verified'

/**
 * EmailVerificationPage コンポーネント
 *
 * メール認証リンクからアクセスされるページ。
 * URL の token パラメータを使って認証 API を呼び出し、結果を表示する。
 *
 * Issue#110 の対応により以下の動作になる:
 * - 認証成功時に localStorage へマーカーを書き込み、別タブのログインダイアログを誘発する
 * - 自動遷移は行わない。ユーザーが自分で元のページに戻るか「Photlasを開く」リンクを使う
 * - アプリ内ブラウザでは「Photlasを開く」「ホーム」リンクを非表示にする（メインブラウザでの利用を促す）
 */
export default function EmailVerificationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const inAppBrowser = isInAppBrowser()

  useEffect(() => {
    const token = searchParams.get('token')

    if (!token) {
      setStatus('error')
      setErrorMessage(t('pages.invalidToken'))
      return
    }

    const verifyEmail = async () => {
      try {
        await fetchJson(
          `${API_V1_URL}/auth/verify-email?token=${encodeURIComponent(token)}`
        )
        setStatus('success')
        // Issue#110: 別タブに認証完了を通知するためのマーカー
        localStorage.setItem(EMAIL_JUST_VERIFIED_KEY, String(Date.now()))
      } catch (err) {
        setStatus('error')
        if (err instanceof ApiError) {
          if (err.isRateLimited) {
            setErrorMessage(getRateLimitInlineMessage(err, t))
          } else {
            setErrorMessage(err.responseMessage || t('auth.errorOccurred'))
          }
        } else {
          setErrorMessage(t('auth.errorOccurred'))
        }
      }
    }

    verifyEmail()
  }, [searchParams, t])

  const handleOpenPhotlas = () => {
    // Issue#110: ログインダイアログを自動表示するため state を渡して遷移する
    navigate('/', { state: { openLogin: true } })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-gray-600">{t('pages.emailVerifying')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-500 text-5xl mb-4">&#10003;</div>
            <h2 className="text-xl font-bold mb-2">{t('pages.emailVerified')}</h2>
            <p className="text-gray-600 mb-4">
              {inAppBrowser
                ? t('pages.emailVerifiedMessageInApp')
                : t('pages.emailVerifiedMessage')}
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
            <h2 className="text-xl font-bold mb-2">{t('pages.verificationError')}</h2>
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
