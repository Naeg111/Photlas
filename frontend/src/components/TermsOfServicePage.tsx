import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { TermsContentJa } from './TermsContentJa'
import { TermsContentEn } from './TermsContentEn'

/**
 * TermsOfServicePage コンポーネント
 * Issue#51: 利用規約の文面改訂
 *
 * 利用規約を表示するダイアログ（言語設定に応じて日本語/英語を自動切替）
 */

interface TermsOfServicePageProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TermsOfServicePage({
  open,
  onOpenChange,
}: Readonly<TermsOfServicePageProps>) {
  const { i18n } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>利用規約</DialogTitle>
            <DialogDescription className="sr-only">
              Photlasの利用規約
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          <ScrollArea className="h-full pr-4 select-text">
            {i18n.language === 'ja' ? <TermsContentJa /> : <TermsContentEn />}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
