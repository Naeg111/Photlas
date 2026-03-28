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
}: Readonly<PrivacyPolicyPageProps>) {
  const [isEnglish, setIsEnglish] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>プライバシーポリシー</DialogTitle>
            <DialogDescription className="sr-only">
              Photlasのプライバシーポリシー
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Fixed language toggle */}
        <div className="px-6 pb-2 shrink-0">
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className={isEnglish ? 'text-gray-400' : 'text-gray-700 font-medium'}>日本語</span>
            <Switch
              checked={isEnglish}
              onCheckedChange={setIsEnglish}
              aria-label="言語切替"
            />
            <span className={isEnglish ? 'text-gray-700 font-medium' : 'text-gray-400'}>英語</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          <ScrollArea className="h-full pr-4 select-text">
            {isEnglish ? <PrivacyContentEn /> : <PrivacyContentJa />}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
