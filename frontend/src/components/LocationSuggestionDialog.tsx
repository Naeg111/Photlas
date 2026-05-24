import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { InlineMapPicker } from './InlineMapPicker'
import { geoDistance } from '../utils/geoDistance'

/**
 * Issue#65: 位置情報修正の指摘ダイアログ
 * Issue#76: 固定ピン方式に変更
 * Issue#146: 距離バリデーション（30m 下限・GPS 写真は 1km 上限）を追加
 */

// Issue#146: 指摘の距離制限（バックエンドの安全網と同じ閾値）
const MIN_SUGGESTION_DISTANCE_METERS = 30
const MAX_SUGGESTION_DISTANCE_METERS = 1000

interface LocationSuggestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  photoId: number
  currentLatitude: number
  currentLongitude: number
  /** Issue#146: 写真が GPS 由来かどうか。true の場合は上限 1km を適用する */
  locationFromExif?: boolean
  onSubmit?: (latitude: number, longitude: number) => void | Promise<void>
}

export function LocationSuggestionDialog({
  open,
  onOpenChange,
  currentLatitude,
  currentLongitude,
  locationFromExif = false,
  onSubmit,
}: Readonly<LocationSuggestionDialogProps>) {
  const { t } = useTranslation()
  const [suggestedLat, setSuggestedLat] = useState<number | null>(null)
  const [suggestedLng, setSuggestedLng] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePositionChange = useCallback((position: { lat: number; lng: number }) => {
    setSuggestedLat(position.lat)
    setSuggestedLng(position.lng)
  }, [])

  // Issue#146: 「元の撮影場所」から指摘地点までの距離で送信可否を判定する
  const distance = (suggestedLat !== null && suggestedLng !== null)
    ? geoDistance(currentLatitude, currentLongitude, suggestedLat, suggestedLng)
    : null
  const tooClose = distance !== null && distance < MIN_SUGGESTION_DISTANCE_METERS
  const tooFar = locationFromExif && distance !== null && distance > MAX_SUGGESTION_DISTANCE_METERS
  const distanceError = tooClose
    ? t('location.suggestionTooClose')
    : tooFar
      ? t('location.suggestionTooFar')
      : null

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
            <DialogTitle>{t('location.suggestionTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('location.suggestionDescription')}</DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        <p className="text-sm text-muted-foreground mt-4 mb-4">
          {t('location.suggestionInstruction')}
        </p>
        <div className="w-full h-[333px] rounded-lg overflow-hidden">
          <InlineMapPicker
            position={{ lat: currentLatitude, lng: currentLongitude }}
            onPositionChange={handlePositionChange}
            pinColor="#3B82F6"
            markers={[
              { lat: currentLatitude, lng: currentLongitude, color: '#EF4444' },
            ]}
            showLocationButton={false}
          />
        </div>

        {distanceError && (
          <p className="text-sm text-red-600 mt-2" data-testid="suggestion-distance-error">
            {distanceError}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={suggestedLat === null || isSubmitting || tooClose || tooFar}
          >
            {t('common.submit')}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
