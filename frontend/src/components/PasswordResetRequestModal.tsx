import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { API_V1_URL } from '../config/api'
import { toast } from 'sonner'
import { ApiError } from '../utils/apiClient'
import { fetchJson } from '../utils/fetchJson'
import { getRateLimitInlineMessage } from '../utils/notifyIfRateLimited'
import { useRateLimitCooldown } from '../hooks/useRateLimitCooldown'

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
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [rateLimitError, setRateLimitError] = useState<ApiError | null>(null)
  const cooldown = useRateLimitCooldown(rateLimitError)

  useEffect(() => {
    if (open) {
      setEmail('')
      setError('')
      setIsSuccess(false)
      setIsSubmitting(false)
      setRateLimitError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error(t('auth.invalidEmailFormat'))
      return
    }

    setIsSubmitting(true)

    try {
      await fetchJson(`${API_V1_URL}/auth/password-reset-request`, {
        method: 'POST',
        body: { email },
      })
      setIsSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isRateLimited) {
          setRateLimitError(err)
          setError(getRateLimitInlineMessage(err, t))
        } else {
          setError(err.responseMessage || t('auth.errorOccurred'))
        }
      } else {
        setError(t('errors.unexpected'))
      }
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
            <DialogTitle>{t('auth.passwordResetTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('auth.passwordResetDescription')}</DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        {isSuccess ? (
          <div className="text-green-600 mt-4">
            {t('auth.passwordResetSent')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-4">
            <p className="mb-4 text-black">{t('auth.passwordResetInstruction')}</p>

            {error && (
              <div className="mb-4 text-red-600 text-sm">{error}</div>
            )}

            <div className="mb-4">
              <Label htmlFor="reset-email">{t('auth.email')}</Label>
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

            <p className="mb-4 text-black">入力したら送信ボタンを押してください。</p>

            <Button
              type="submit"
              disabled={!email || isSubmitting || cooldown.isOnCooldown}
              className="w-full h-11"
              aria-live="polite"
            >
              {cooldown.isOnCooldown
                ? t('common.submitWithCooldown', { seconds: cooldown.remainingSeconds })
                : isSubmitting
                  ? t('pages.submitting')
                  : t('common.submit')}
            </Button>

            {onShowLogin && (
              <Button
                type="button"
                variant="ghost"
                className="w-full h-11 mt-2"
                onClick={() => {
                  onClose()
                  onShowLogin()
                }}
              >
                {t('pages.goToLogin')}
              </Button>
            )}
          </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
