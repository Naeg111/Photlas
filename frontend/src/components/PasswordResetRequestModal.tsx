import { useState, useEffect } from 'react'
import { API_V1_URL } from '../config/api'

interface PasswordResetRequestModalProps {
  open: boolean
  onClose: () => void
}

/**
 * パスワードリセットリクエストモーダルコンポーネント
 * Issue#6: パスワードリセット機能
 */
export default function PasswordResetRequestModal({ open, onClose }: PasswordResetRequestModalProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // モーダルが開かれたときにフォームをリセット
  useEffect(() => {
    if (open) {
      setEmail('')
      setError('')
      setIsSuccess(false)
      setIsSubmitting(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // バリデーション
    if (!email) {
      setError('メールアドレスは必須です')
      return
    }

    // メールアドレス形式の検証
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('正しいメールアドレス形式で入力してください')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_V1_URL}/auth/password-reset-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      if (response.ok) {
        setIsSuccess(true)
      } else {
        const data = await response.json()
        setError(data.message || 'エラーが発生しました')
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          aria-label="閉じる"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-4">パスワードリセット</h2>

        {isSuccess ? (
          // 成功メッセージ表示
          <div className="text-green-600 mb-4">
            パスワード再設定用のメールを送信しました。受信トレイをご確認ください。
          </div>
        ) : (
          // フォーム表示
          <form onSubmit={handleSubmit} noValidate>
            <p className="mb-4 text-gray-700">登録メールアドレスを入力してください。</p>

            {error && (
              <div className="mb-4 text-red-600 text-sm">{error}</div>
            )}

            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </div>

            <p className="mb-4 text-gray-700">入力したら送信ボタンを押してください。</p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '送信中...' : '送信'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
