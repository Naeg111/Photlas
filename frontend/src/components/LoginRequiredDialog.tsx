import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { LogIn, UserPlus } from 'lucide-react'

/**
 * LoginRequiredDialog コンポーネント
 * Issue#27: パネル・ダイアログ群の移行
 *
 * 未ログイン時に投稿ボタンを押したときに表示されるダイアログ
 */

interface LoginRequiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onShowLogin: () => void
  onShowSignUp: () => void
}

export function LoginRequiredDialog({
  open,
  onOpenChange,
  onShowLogin,
  onShowSignUp,
}: Readonly<LoginRequiredDialogProps>) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[398px] max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 shrink-0">
          <DialogHeader>
            <DialogTitle>{t('auth.loginRequired')}</DialogTitle>
            <DialogDescription className="sr-only">{t('auth.loginRequiredDescription')}</DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
        <p className="text-sm text-muted-foreground w-fit mx-auto mt-1.5">
          {t('auth.loginRequiredMessage')}
        </p>
        <div className="space-y-3 mt-4">
          <Button
            className="w-full gap-2"
            onClick={() => {
              onOpenChange(false)
              onShowLogin()
            }}
          >
            <LogIn className="w-4 h-4" />
            {t('common.login')}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              onOpenChange(false)
              onShowSignUp()
            }}
          >
            <UserPlus className="w-4 h-4" />
            {t('auth.createAccount')}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
