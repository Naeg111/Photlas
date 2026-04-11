import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { API_V1_URL } from '../config/api'

/**
 * EmailVerificationPage コンポーネント
 *
 * メール認証リンクからアクセスされるページ。
 * URLのtokenパラメータを使って認証APIを呼び出し、結果を表示後トップページへリダイレクトする。
 */
export default function EmailVerificationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')

    if (!token) {
      setStatus('error')
      setErrorMessage(t('pages.invalidToken'))
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(
          `${API_V1_URL}/auth/verify-email?token=${encodeURIComponent(token)}`
        )

        if (response.ok) {
          setStatus('success')
          setTimeout(() => navigate('/'), 3000)
        } else {
          const data = await response.json()
          setStatus('error')
          setErrorMessage(data.message || t('auth.errorOccurred'))
        }
      } catch {
        setStatus('error')
        setErrorMessage(t('auth.errorOccurred'))
      }
    }

    verifyEmail()
  }, [searchParams, navigate, t])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
              {t('pages.emailVerifiedMessage')}
            </p>
            <p className="text-sm text-gray-500">
              {t('pages.redirecting')}
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 text-primary hover:underline"
            >
              {t('pages.goToHome')}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-500 text-5xl mb-4">&#10007;</div>
            <h2 className="text-xl font-bold mb-2">{t('pages.verificationError')}</h2>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 text-primary hover:underline"
            >
              {t('common.home')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
