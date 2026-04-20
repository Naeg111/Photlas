import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import OAuthButtons from './OAuthButtons'

/**
 * Issue#81 Phase 8c - SNS 新規登録ダイアログ。
 *
 * <p>{@code SignUpMethodDialog} で「SNSログインで登録」を選んだ際に開く。
 * 利用規約に同意しないと Google / LINE ボタンは非活性（Q4 仕様）。
 *
 * <p>「キャンセル」は {@code SignUpMethodDialog} に戻るための onBack コールバックで、
 * SignUpDialog の (キャンセル + 登録) 合計幅と同じ {@code w-full} 幅（Q2 仕様）。
 */
interface OAuthSignUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 「キャンセル」クリック: SignUpMethodDialog に戻る */
  onBack: () => void
  /** 「すでにアカウントをお持ちの方はログイン」クリック: LoginDialog へ切り替え */
  onShowLogin: () => void
  /** 利用規約リンククリック: 利用規約ページを開く */
  onShowTerms: () => void
}

export default function OAuthSignUpDialog({
  open,
  onOpenChange,
  onBack,
  onShowLogin,
  onShowTerms,
}: OAuthSignUpDialogProps) {
  const { t } = useTranslation()
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="gap-4">
          <DialogTitle>{t('auth.oauth.snsSignUp.title')}</DialogTitle>
          <DialogDescription>
            {t('auth.oauth.snsSignUp.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* SNS ボタン: 利用規約未同意または OAuth 無効時は disabled */}
          <OAuthButtons
            variant="signUp"
            disabled={!agreedToTerms}
            hideDivider={true}
          />

          {/* 利用規約同意（既存 SignUpDialog と同じフォーマット、Q3） */}
          <div className="flex items-center justify-center space-x-2">
            <Checkbox
              id="sns-signup-terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
            />
            <label htmlFor="sns-signup-terms" className="text-sm">
              <a
                href="#"
                role="link"
                className="text-blue-600 underline hover:text-blue-800"
                onClick={(e) => {
                  e.preventDefault()
                  onShowTerms()
                }}
              >
                {t('auth.termsOfService')}
              </a>
              {t('auth.agreeToTerms')}
            </label>
          </div>

          {/* ログインリンク */}
          <div className="text-center text-sm text-gray-600">
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={onShowLogin}
            >
              {t('auth.oauth.snsSignUp.hasAccount')}
            </Button>
          </div>

          {/* 戻る（Q2 / Phase 8r-2: w-full = SignUpDialog の戻る+登録 合計幅） */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onBack}
          >
            {t('common.back')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
