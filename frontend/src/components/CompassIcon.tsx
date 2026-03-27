/**
 * Issue#64: ノースヘディングボタン用の方位磁針アイコン
 * N極（赤）が上、S極（青）が下のカーナビ風デザイン
 */
export function CompassIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* N極（赤） */}
      <polygon points="12,0 18,12 12,10 6,12" fill="#EF4444" />
      {/* S極（青） */}
      <polygon points="12,24 6,12 12,14 18,12" fill="#3B82F6" />
    </svg>
  )
}
