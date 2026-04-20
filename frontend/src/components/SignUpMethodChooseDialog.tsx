import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'

/**
 * Issue#81 Phase 8b - 新規登録方法の選択ダイアログ。
 *
 * <p>「新規登録」ボタン押下時、OAuth が有効（{@code VITE_OAUTH_ENABLED === 'true'}）の場合に最初に開く。
 * ユーザーが SNS ログイン / メールアドレスのどちらで登録するかを選ばせる。
 *
 * <p>OAuth 無効時は呼び出し側（App.tsx）がこのダイアログをスキップして直接 {@code SignUpDialog} を開く。
 */
interface SignUpMethodChooseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 「SNSログインで登録」クリック時。親で本ダイアログを閉じ SignUpSnsLoginDialog を開く。 */
  onChooseSns: () => void
  /** 「メールアドレスで登録」クリック時。親で本ダイアログを閉じ SignUpDialog を開く。 */
  onChooseEmail: () => void
}

export default function SignUpMethodChooseDialog({
  open,
  onOpenChange,
  onChooseSns,
  onChooseEmail,
}: SignUpMethodChooseDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('auth.oauth.chooseMethod.title')}</DialogTitle>
          <DialogDescription>
            {t('auth.oauth.chooseMethod.description')}
          </DialogDescription>
        </DialogHeader>
        {/* Q1: 両方同じスタイル（優先なし） */}
        <div className="flex flex-col gap-3 mt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onChooseSns}
          >
            {t('auth.oauth.chooseMethod.sns')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onChooseEmail}
          >
            {t('auth.oauth.chooseMethod.email')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
