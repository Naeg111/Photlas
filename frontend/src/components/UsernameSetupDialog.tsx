import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { API_V1_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../utils/apiClient'
import { fetchJson } from '../utils/fetchJson'
import { validateUsername } from '../utils/validation/username'
import { localizeFieldError } from '../utils/validation/localizeFieldError'

interface UsernameSetupDialogProps {
  open: boolean
  initialUsername?: string
  onClose: () => void
  onUpdated?: (newUsername: string) => void
}

/**
 * Issue#81 Phase 5c - 仮ユーザー名の確定ダイアログ。
 *
 * OAuth 新規登録時は user_<7桁英数字> の仮ユーザー名が割り当てられ、
 * 初回ログイン後にこのダイアログで確定させる。
 *
 * - 「あとで設定する」で閉じる（usernameTemporary=true のまま）
 * - 「確定する」で PUT /api/v1/users/me/username 呼び出し、成功時に
 *   AuthContext を更新して onUpdated を呼ぶ
 * - 「ログアウト」でセッション破棄して閉じる（ユーザー名設定を放棄するケース）
 */
export default function UsernameSetupDialog({
  open,
  initialUsername = '',
  onClose,
  onUpdated,
}: UsernameSetupDialogProps) {
  const { t } = useTranslation()
  const { updateUser, logout } = useAuth()
  const [username, setUsername] = useState(initialUsername)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSave = async () => {
    if (!username.trim()) return
    // Issue#98: 軽量バリデーション
    const errorKey = validateUsername(username.trim())
    if (errorKey) {
      setErrorMessage(t(`errors.${errorKey}`))
      return
    }

    setErrorMessage('')
    setIsLoading(true)
    try {
      const response = await fetchJson<{ username: string }>(
        `${API_V1_URL}/users/me/username`,
        {
          method: 'PUT',
          body: { username: username.trim() },
          requireAuth: true,
        }
      )
      updateUser({ username: response.username })
      onUpdated?.(response.username)
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        // Issue#98: 400 Bad Request の field-level エラー（i18n キー）を優先表示
        const usernameErr = err.getFieldErrorMessage('username')
        if (usernameErr) {
          setErrorMessage(localizeFieldError(usernameErr, t))
        } else {
          setErrorMessage(err.responseMessage || t('auth.errorOccurred'))
        }
      } else {
        setErrorMessage(t('auth.errorOccurred'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('auth.oauth.usernameSetup.title')}</DialogTitle>
          <DialogDescription>
            {t('auth.oauth.usernameSetup.description1')}
            <br />
            {t('auth.oauth.usernameSetup.description2')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="oauth-username-input">
            {t('auth.oauth.usernameSetup.usernameLabel')}
          </Label>
          <p className="text-xs text-gray-500">{t('auth.displayNameFormatHint')}</p>
          <Input
            id="oauth-username-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            aria-describedby={errorMessage ? 'oauth-username-error' : undefined}
          />
          {errorMessage && (
            <p id="oauth-username-error" role="alert" className="text-sm text-red-600">
              {errorMessage}
            </p>
          )}
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              logout()
              onClose()
            }}
          >
            {t('auth.oauth.usernameSetup.logout')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {t('auth.oauth.usernameSetup.keepTemporary')}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading || !username.trim()}
            >
              {t('auth.oauth.usernameSetup.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
