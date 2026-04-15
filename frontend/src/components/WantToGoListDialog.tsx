import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * WantToGoListDialog コンポーネント
 *
 * 行きたい場所リストを表示するダイアログ
 * 現在は準備中のプレースホルダー表示
 */

interface WantToGoListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WantToGoListDialog({ open, onOpenChange }: Readonly<WantToGoListDialogProps>) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>{t('wantToGo.title')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('wantToGo.description')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        <div className="flex flex-col items-center justify-center py-12 text-center mt-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Coming Soon</h3>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
