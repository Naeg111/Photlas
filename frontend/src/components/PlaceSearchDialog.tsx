/**
 * Issue#69: 場所検索ダイアログ（スタブ）
 */

interface PlaceSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPlaceSelect: (lng: number, lat: number, zoom: number) => void
}

export function PlaceSearchDialog({ open }: PlaceSearchDialogProps) {
  if (!open) return null
  return <div>TODO</div>
}
