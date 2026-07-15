import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Smartphone } from 'lucide-react'

/**
 * スマートフォンを横向きにしたときに、縦向きへ戻すよう促すオーバーレイ。
 *
 * Web ブラウザからは端末の向きを固定できない（screen.orientation.lock() は全画面表示中のみ有効で、
 * iOS Safari は非対応）。そのため「回転を禁止する」のではなく、
 * 横向きになったら画面全体を覆って操作を止める方式で実現している。
 *
 * タブレット以上は対象外で、従来どおり横向きでも利用できる。
 */

/**
 * スマートフォンの横向きとみなす条件。
 * iPhone は横向き時の高さが最大 440px 程度、iPad mini は 744px あるため、600px で切り分ける。
 */
export const COMPACT_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 600px)'

export function RotateToPortraitOverlay() {
  const { t } = useTranslation()
  const [isCompactLandscape, setIsCompactLandscape] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia(COMPACT_LANDSCAPE_QUERY)
    const handleOrientationChange = (e: MediaQueryListEvent) => setIsCompactLandscape(e.matches)

    setIsCompactLandscape(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleOrientationChange)
    return () => mediaQuery.removeEventListener('change', handleOrientationChange)
  }, [])

  if (!isCompactLandscape) return null

  return (
    <div
      data-testid="rotate-to-portrait-overlay"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-black px-8 text-center text-white"
    >
      <Smartphone className="w-10 h-10" aria-hidden="true" />
      <p className="text-lg font-semibold">{t('orientation.rotateTitle')}</p>
      <p className="text-sm text-gray-300">{t('orientation.rotateDescription')}</p>
    </div>
  )
}
