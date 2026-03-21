import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { Switch } from './ui/switch'
import { PrivacyContentJa } from './PrivacyContentJa'
import { PrivacyContentEn } from './PrivacyContentEn'

/**
 * PrivacyPolicyPage コンポーネント
 * Issue#52: プライバシーポリシーの文面改訂
 *
 * プライバシーポリシーを表示するダイアログ（日本語/英語切替対応）
 */

interface PrivacyPolicyPageProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PrivacyPolicyPage({
  open,
  onOpenChange,
}: PrivacyPolicyPageProps) {
  const [isEnglish, setIsEnglish] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>プライバシーポリシー</DialogTitle>
          <DialogDescription className="sr-only">
            Photlasのプライバシーポリシー
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

        <ScrollArea className="h-[70vh] pr-4">
          {isEnglish ? <PrivacyContentEn /> : <PrivacyContentJa />}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
