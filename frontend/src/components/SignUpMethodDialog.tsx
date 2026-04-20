import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'

/**
 * Issue#81 Phase 8b / Phase 8r-1 - 新規登録方法の選択ダイアログ。
 *
 * <p>「新規登録」ボタン押下時、OAuth 有効 / 無効に関わらず常に最初に開く（Q1 改訂）。
 * ユーザーが SNS / メールアドレスのどちらで登録するかを選ばせる。
 *
 * <p>Q7 仕様: 「SNSで登録」ボタンは OAuth 有効 / 無効に関わらず常に活性。
 * OAuth 無効時でも OAuthSignUpDialog に遷移でき、遷移先で SNS ボタンが disabled になる。
 */
interface SignUpMethodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 「SNSで登録」クリック時。親で本ダイアログを閉じ OAuthSignUpDialog を開く。 */
  onChooseSns: () => void
  /** 「メールアドレスで登録」クリック時。親で本ダイアログを閉じ SignUpDialog を開く。 */
  onChooseEmail: () => void
}

export default function SignUpMethodDialog({
  open,
  onOpenChange,
  onChooseSns,
  onChooseEmail,
}: SignUpMethodDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      >
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader className="gap-4">
            <DialogTitle>{t('auth.oauth.chooseMethod.title')}</DialogTitle>
            <DialogDescription>
              {t('auth.oauth.chooseMethod.description')}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="px-6 pb-6">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
