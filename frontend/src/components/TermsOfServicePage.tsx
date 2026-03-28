import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { Switch } from './ui/switch'
import { TermsContentJa } from './TermsContentJa'
import { TermsContentEn } from './TermsContentEn'

/**
 * TermsOfServicePage コンポーネント
 * Issue#51: 利用規約の文面改訂
 *
 * 利用規約を表示するダイアログ（日本語/英語切替対応）
 */

interface TermsOfServicePageProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TermsOfServicePage({
  open,
  onOpenChange,
}: Readonly<TermsOfServicePageProps>) {
  const [isEnglish, setIsEnglish] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>利用規約</DialogTitle>
          <DialogDescription className="sr-only">
            Photlasの利用規約
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end gap-2 text-sm">
          <span className={isEnglish ? 'text-gray-400' : 'text-gray-700 font-medium'}>日本語</span>
          <Switch
            checked={isEnglish}
            onCheckedChange={setIsEnglish}
            aria-label="言語切替"
          />
          <span className={isEnglish ? 'text-gray-700 font-medium' : 'text-gray-400'}>英語</span>
        </div>

        <ScrollArea className="h-[70vh] pr-4 select-text">
          {isEnglish ? <TermsContentEn /> : <TermsContentJa />}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
