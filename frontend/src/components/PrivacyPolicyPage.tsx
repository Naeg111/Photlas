import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { PrivacyContentJa } from './PrivacyContentJa'
import { PrivacyContentEn } from './PrivacyContentEn'
import { PrivacyContentKo } from './PrivacyContentKo'
import { PrivacyContentZhCN } from './PrivacyContentZhCN'
import { PrivacyContentZhTW } from './PrivacyContentZhTW'

/**
 * PrivacyPolicyPage コンポーネント
 * Issue#52: プライバシーポリシーの文面改訂
 * Issue#101: 5 言語対応 + ハードコード日本語の i18n 化
 *
 * プライバシーポリシーを表示するダイアログ。
 * 言語設定に応じて 5 言語 (ja / en / ko / zh-CN / zh-TW) を切り替える。
 * 未対応言語は en にフォールバックする。
 */

interface PrivacyPolicyPageProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function selectPrivacyContent(language: string | undefined) {
  switch (language) {
    case 'ja': return <PrivacyContentJa />
    case 'ko': return <PrivacyContentKo />
    case 'zh-CN': return <PrivacyContentZhCN />
    case 'zh-TW': return <PrivacyContentZhTW />
    default: return <PrivacyContentEn />
  }
}

export function PrivacyPolicyPage({
  open,
  onOpenChange,
}: Readonly<PrivacyPolicyPageProps>) {
  const { t, i18n } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            {/* Issue#101: i18n 化（auth.privacyPolicy: ja=プライバシーポリシー / en=Privacy Policy / ko=개인정보처리방침 / zh-CN=隐私政策 / zh-TW=隱私政策） */}
            <DialogTitle>{t('auth.privacyPolicy')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('auth.privacyPolicy')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          <ScrollArea className="h-full pr-4 select-text">
            {selectPrivacyContent(i18n.language)}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
