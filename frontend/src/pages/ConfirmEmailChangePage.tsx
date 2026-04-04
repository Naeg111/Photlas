import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { API_V1_URL } from '../config/api'

/**
 * Issue#86: メールアドレス変更確認ページ
 *
 * 確認リンクからアクセスされるページ。
 * URLのtokenパラメータを使って確認APIを呼び出し、
 * 成功時にJWTとユーザー情報を更新してトップページへリダイレクトする。
 */
export default function ConfirmEmailChangePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { updateUser, login, user } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')

    if (!token) {
      setStatus('error')
      setErrorMessage('確認トークンが見つかりません')
      return
    }

    const confirmEmailChange = async () => {
      try {
        const response = await fetch(
          `${API_V1_URL}/auth/confirm-email-change?token=${encodeURIComponent(token)}`
        )

        if (response.ok) {
          const data = await response.json()

          // JWT・ユーザー情報を更新
          if (data.token && data.email && user) {
            login(
              { ...user, email: data.email },
              data.token,
              !!localStorage.getItem('auth_token')
            )
          }

          setStatus('success')
          setTimeout(() => navigate('/'), 3000)
        } else if (response.status === 409) {
          setStatus('error')
          setErrorMessage('このメールアドレスはすでに他のアカウントで使用されています')
        } else {
          const data = await response.json().catch(() => null)
          setStatus('error')
          setErrorMessage(data?.message || '確認に失敗しました')
        }
      } catch {
        setStatus('error')
        setErrorMessage('確認に失敗しました。しばらく経ってからお試しください。')
      }
    }

    confirmEmailChange()
  }, [searchParams, navigate, user, login, updateUser])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-gray-600">メールアドレスの変更を確認しています...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-500 text-5xl mb-4">&#10003;</div>
            <h2 className="text-xl font-bold mb-2">変更完了</h2>
            <p className="text-gray-600 mb-4">
              メールアドレスの変更が完了しました。
            </p>
            <p className="text-sm text-gray-500">
              3秒後にトップページへ移動します...
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 text-primary hover:underline"
            >
              今すぐトップページへ
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-500 text-5xl mb-4">&#10007;</div>
            <h2 className="text-xl font-bold mb-2">確認エラー</h2>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 text-primary hover:underline"
            >
              トップページへ
            </button>
          </>
        )}
      </div>
    </div>
  )
}
