import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/** Issue#130: 100ms 未満のロード完了時はスピナーを描画せずちらつきを防ぐ */
const FALLBACK_DELAY_MS = 100

/**
 * Issue#130: Suspense フォールバック用の軽量スピナー。
 * lazy 化したルート・ダイアログのロード中に短時間だけ表示する。
 * 100ms 未満で解決した場合は描画せず、ちらつきを防ぐ。
 */
export function RouteFallback(): React.ReactElement | null {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), FALLBACK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[50vh] items-center justify-center"
    >
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  )
}
