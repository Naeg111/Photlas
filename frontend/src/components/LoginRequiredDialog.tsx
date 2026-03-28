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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[398px] max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>ログインが必要です</DialogTitle>
            <DialogDescription>
              この機能を利用するには、ログインまたはアカウント作成が必要です。
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        <div className="space-y-3 mt-4 pt-2.5">
          <Button
            className="w-full gap-2"
            onClick={() => {
              onOpenChange(false)
              onShowLogin()
            }}
          >
            <LogIn className="w-4 h-4" />
            ログイン
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
            新規アカウント作成
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
