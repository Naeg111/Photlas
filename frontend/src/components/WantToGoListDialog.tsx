import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { MapPin } from 'lucide-react'

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

export function WantToGoListDialog({ open, onOpenChange }: WantToGoListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>行きたい場所リスト</DialogTitle>
          <DialogDescription className="sr-only">
            行きたい場所として保存した撮影スポットのリスト
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">準備中</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            行きたい場所リスト機能は現在開発中です。
            <br />
            もうしばらくお待ちください。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
