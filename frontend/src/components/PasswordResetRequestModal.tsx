import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { API_V1_URL } from '../config/api'

interface PasswordResetRequestModalProps {
  open: boolean
  onClose: () => void
  onShowLogin?: () => void
}

/**
 * パスワードリセットリクエストモーダルコンポーネント
 * Issue#6: パスワードリセット機能
 */
export default function PasswordResetRequestModal({ open, onClose, onShowLogin }: Readonly<PasswordResetRequestModalProps>) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

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

    if (!email) {
      setError('メールアドレスは必須です')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('正しいメールアドレス形式で入力してください')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_V1_URL}/auth/password-reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (response.ok) {
        setIsSuccess(true)
      } else {
        const data = await response.json()
        setError(data.message || 'エラーが発生しました')
      }
    } catch {
      setError('ネットワークエラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>パスワードリセット</DialogTitle>
            <DialogDescription className="sr-only">パスワードリセットリクエスト</DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        {isSuccess ? (
          <div className="text-green-600 mt-4">
            パスワード再設定用のメールを送信しました。受信トレイをご確認ください。
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-4">
            <p className="mb-4 text-gray-700">登録メールアドレスを入力してください。</p>

            {error && (
              <div className="mb-4 text-red-600 text-sm">{error}</div>
            )}

            <div className="mb-4">
              <Label htmlFor="reset-email">メールアドレス</Label>
              <Input
                id="reset-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="mt-2"
              />
            </div>

            <p className="mb-4 text-gray-700">入力したら送信ボタンを押してください。</p>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? '送信中...' : '送信'}
            </Button>

            {onShowLogin && (
              <Button
                type="button"
                variant="ghost"
                className="w-full mt-2"
                onClick={() => {
                  onClose()
                  onShowLogin()
                }}
              >
                ログインに戻る
              </Button>
            )}
          </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
