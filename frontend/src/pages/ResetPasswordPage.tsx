import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { validatePassword } from '../utils/validation'
import { API_V1_URL } from '../config/api'

/**
 * パスワードリセット完了ページ
 *
 * Issue#56: メール内のリセットリンクからアクセスされるページ。
 * 新しいパスワードを入力してリセットを完了する。
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
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
      setError('パスワードが一致しません')
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
        setError(data.message || 'パスワードの再設定に失敗しました')
      }
    } catch {
      setError('通信エラーが発生しました。しばらく経ってからお試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLoginClick = () => {
    navigate('/', { state: { openLogin: true } })
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">&#10007;</div>
          <h2 className="text-xl font-bold mb-2">無効なリンクです</h2>
          <p className="text-gray-600 mb-4">
            パスワードリセットのリンクが無効です。再度リセットをリクエストしてください。
          </p>
          <button
            onClick={() => navigate('/')}
            className="text-primary hover:underline"
          >
            トップページへ
          </button>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-green-500 text-5xl mb-4">&#10003;</div>
          <h2 className="text-xl font-bold mb-2">パスワードを再設定しました</h2>
          <p className="text-gray-600 mb-4">
            新しいパスワードでログインしてください。
          </p>
          <button
            onClick={handleLoginClick}
            className="mt-2 px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            ログインへ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-md p-8">
        <h2 className="text-xl font-bold mb-6 text-center">パスワードの再設定</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              新しいパスワード
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={isShowingNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                placeholder="8〜20文字（大文字・小文字・数字を含む）"
              />
              <button
                type="button"
                onClick={() => setIsShowingNewPassword(!isShowingNewPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                aria-label={isShowingNewPassword ? 'パスワードを非表示' : 'パスワードを表示'}
              >
                {isShowingNewPassword ? '非表示' : '表示'}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              新しいパスワード（確認）
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={isShowingConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                placeholder="もう一度入力してください"
              />
              <button
                type="button"
                onClick={() => setIsShowingConfirmPassword(!isShowingConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                aria-label={isShowingConfirmPassword ? 'パスワードを非表示' : 'パスワードを表示'}
              >
                {isShowingConfirmPassword ? '非表示' : '表示'}
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
            {isSubmitting ? '送信中...' : 'パスワードを再設定'}
          </button>
        </form>
      </div>
    </div>
  )
}
