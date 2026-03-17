/**
 * Issue#65: 位置情報修正の指摘ダイアログ（スタブ）
 */

interface LocationSuggestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  photoId: number
  currentLatitude: number
  currentLongitude: number
}

export function LocationSuggestionDialog(_props: LocationSuggestionDialogProps) {
  // TODO: Green段階で実装
  return null
}
