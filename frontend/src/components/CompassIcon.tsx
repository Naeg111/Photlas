/**
 * Issue#64: ノースヘディングボタン用の方位磁針アイコン
 * N極（黒）が上、S極（赤）が下のカーナビ風デザイン
 */
export function CompassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* N極（黒） */}
      <polygon points="12,2 15,12 12,10 9,12" fill="currentColor" />
      {/* S極（赤） */}
      <polygon points="12,22 9,12 12,14 15,12" fill="#EF4444" />
    </svg>
  )
}
