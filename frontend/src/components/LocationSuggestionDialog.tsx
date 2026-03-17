import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import Map, { Marker } from 'react-map-gl'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'
import { PinSvg } from './PinSvg'

/**
 * Issue#65: 位置情報修正の指摘ダイアログ
 */

interface LocationSuggestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  photoId: number
  currentLatitude: number
  currentLongitude: number
  onSubmit?: (latitude: number, longitude: number) => void
}

export function LocationSuggestionDialog({
  open,
  onOpenChange,
  currentLatitude,
  currentLongitude,
  onSubmit,
}: LocationSuggestionDialogProps) {
  const [suggestedLat, setSuggestedLat] = useState<number | null>(null)
  const [suggestedLng, setSuggestedLng] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleMapClick = (e: { lngLat: { lat: number; lng: number } }) => {
    setSuggestedLat(e.lngLat.lat)
    setSuggestedLng(e.lngLat.lng)
  }

  const handleSubmit = () => {
    if (suggestedLat !== null && suggestedLng !== null && onSubmit) {
      setIsSubmitting(true)
      onSubmit(suggestedLat, suggestedLng)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>撮影場所の指摘</DialogTitle>
        <DialogDescription>
          正しいと思われる撮影場所をマップ上でタップしてください。
        </DialogDescription>

        <div className="w-full h-64 rounded-lg overflow-hidden">
          <Map
            mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
            initialViewState={{
              latitude: currentLatitude,
              longitude: currentLongitude,
              zoom: 14,
            }}
            mapStyle={MAPBOX_STYLE}
            onClick={handleMapClick}
          >
            {/* 現在の撮影地点（赤） */}
            <Marker latitude={currentLatitude} longitude={currentLongitude}>
              <div style={{ width: 32, height: 38 }}><PinSvg fill="#EF4444" stroke="#B91C1C" /></div>
            </Marker>

            {/* 指摘地点（青） */}
            {suggestedLat !== null && suggestedLng !== null && (
              <Marker latitude={suggestedLat} longitude={suggestedLng}>
                <div style={{ width: 32, height: 38 }}><PinSvg fill="#3B82F6" stroke="#1D4ED8" /></div>
              </Marker>
            )}
          </Map>
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
      </DialogContent>
    </Dialog>
  )
}
