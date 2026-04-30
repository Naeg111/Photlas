import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { TermsContentJa } from './TermsContentJa'
import { TermsContentEn } from './TermsContentEn'
import { TermsContentKo } from './TermsContentKo'
import { TermsContentZhCN } from './TermsContentZhCN'
import { TermsContentZhTW } from './TermsContentZhTW'

/**
 * TermsOfServicePage コンポーネント
 * Issue#51: 利用規約の文面改訂
 * Issue#101: 5 言語対応 + ハードコード日本語の i18n 化
 *
 * 利用規約を表示するダイアログ。
 * 言語設定に応じて 5 言語 (ja / en / ko / zh-CN / zh-TW) を切り替える。
 * 未対応言語は en にフォールバックする。
 */

interface TermsOfServicePageProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function selectTermsContent(language: string | undefined) {
  switch (language) {
    case 'ja': return <TermsContentJa />
    case 'ko': return <TermsContentKo />
    case 'zh-CN': return <TermsContentZhCN />
    case 'zh-TW': return <TermsContentZhTW />
    default: return <TermsContentEn />
  }
}

export function TermsOfServicePage({
  open,
  onOpenChange,
}: Readonly<TermsOfServicePageProps>) {
  const { t, i18n } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            {/* Issue#101: i18n 化（auth.termsOfService） */}
            <DialogTitle>{t('auth.termsOfService')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('auth.termsOfService')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          <ScrollArea className="h-full pr-4 select-text">
            {selectTermsContent(i18n.language)}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
