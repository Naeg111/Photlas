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
}: LoginRequiredDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ログインが必要です</DialogTitle>
          <DialogDescription>
            この機能を利用するには、ログインまたはアカウント作成が必要です。
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  )
}
