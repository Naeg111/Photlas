import { useCallback, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { InlineMapPicker } from './InlineMapPicker'

/**
 * Issue#65: 位置情報修正の指摘ダイアログ
 * Issue#76: 固定ピン方式に変更
 */

interface LocationSuggestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  photoId: number
  currentLatitude: number
  currentLongitude: number
  onSubmit?: (latitude: number, longitude: number) => void | Promise<void>
}

export function LocationSuggestionDialog({
  open,
  onOpenChange,
  currentLatitude,
  currentLongitude,
  onSubmit,
}: Readonly<LocationSuggestionDialogProps>) {
  const [suggestedLat, setSuggestedLat] = useState<number | null>(null)
  const [suggestedLng, setSuggestedLng] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePositionChange = useCallback((position: { lat: number; lng: number }) => {
    setSuggestedLat(position.lat)
    setSuggestedLng(position.lng)
  }, [])

  const handleSubmit = async () => {
    if (suggestedLat !== null && suggestedLng !== null && onSubmit) {
      setIsSubmitting(true)
      try {
        await onSubmit(suggestedLat, suggestedLng)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>撮影場所の指摘</DialogTitle>
            <DialogDescription className="sr-only">撮影場所の修正を指摘する</DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        <p className="text-sm text-muted-foreground mt-4 mb-4">
          マップを動かして、正しいと思われる撮影場所を青いピンに合わせてください。
        </p>
        <div className="w-full h-[333px] rounded-lg overflow-hidden">
          <InlineMapPicker
            position={{ lat: currentLatitude, lng: currentLongitude }}
            onPositionChange={handlePositionChange}
            pinColor="#3B82F6"
            markers={[
              { lat: currentLatitude, lng: currentLongitude, color: '#EF4444' },
            ]}
            showCoordinates={false}
            showLocationButton={false}
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={suggestedLat === null || isSubmitting}
          >
            送信
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
