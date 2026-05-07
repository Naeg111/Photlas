/**
 * Issue#115: 方角インジケーター（扇形）コンポーネント
 *
 * 現在位置マーカーの背面に表示する半透明の扇形。
 * heading（実世界の方角、0=北、時計回り）と mapBearing（マップの回転、0=北上）から
 * 画面上での回転角を算出して SVG path に rotate を適用する。
 *
 * 仕様:
 * - 開き角: 90 度
 * - 半径: 青い点（半径8px）の6倍 = 48px
 * - グラデーション: 中心 #4285F4 80% → 中間 60% → 外周 0%
 */

const SECTOR_RADIUS = 48
const SECTOR_EDGE = SECTOR_RADIUS * Math.SQRT1_2 // 90度の左右端の (x, y) オフセット
const SVG_VIEWBOX_HALF = 50 // SECTOR_RADIUS=48 を収めるための余白
const SVG_SIZE = SVG_VIEWBOX_HALF * 2

interface HeadingIndicatorProps {
  /** 実世界での方角（度数、0=北、時計回り）。null の場合は何も描画しない */
  heading: number | null
  /** マップの bearing（0=北が画面上、時計回り）。マップ回転時の補正に使う */
  mapBearing: number
}

/** heading - mapBearing を 0〜360 に正規化した画面回転角を返す */
export function computeRotationAngle(heading: number, mapBearing: number): number {
  return ((heading - mapBearing) % 360 + 360) % 360
}

export function HeadingIndicator({ heading, mapBearing }: Readonly<HeadingIndicatorProps>) {
  if (heading === null) return null

  const rotation = computeRotationAngle(heading, mapBearing)
  const pathD = `M 0 0 L ${-SECTOR_EDGE} ${-SECTOR_EDGE} A ${SECTOR_RADIUS} ${SECTOR_RADIUS} 0 0 1 ${SECTOR_EDGE} ${-SECTOR_EDGE} Z`

  return (
    <svg
      data-testid="heading-indicator"
      width={SVG_SIZE}
      height={SVG_SIZE}
      viewBox={`${-SVG_VIEWBOX_HALF} ${-SVG_VIEWBOX_HALF} ${SVG_SIZE} ${SVG_SIZE}`}
      className="absolute top-1/2 left-1/2 pointer-events-none"
      style={{ transform: 'translate(-50%, -50%)', transition: 'opacity 0.2s ease-out' }}
    >
      <defs>
        <radialGradient id="headingGradient">
          <stop offset="0%" stopColor="#4285F4" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#4285F4" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#4285F4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d={pathD}
        fill="url(#headingGradient)"
        transform={`rotate(${rotation})`}
        style={{ transition: 'transform 0.2s ease-out' }}
      />
    </svg>
  )
}
