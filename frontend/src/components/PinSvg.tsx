/**
 * PinSvg コンポーネント
 * Issue#53: Mapbox移行に伴うリファクタリングで共通化
 *
 * 地図上のピンSVGを描画する共通コンポーネント
 * MapView（クラスタ・個別・撮影地点）とPhotoDetailDialog（ミニマップ）で使用
 */

interface PinSvgProps {
  filterId: string
  fill: string
  stroke: string
  strokeWidth?: number
  strokeLinejoin?: 'round' | 'miter' | 'bevel'
  shapeRendering?: string
  children?: React.ReactNode
}

const PIN_PATH = 'M16 0C7.16 0 0 7.16 0 16c0 8 16 22 16 22s16-14 16-22C32 7.16 24.84 0 16 0z'

export function PinSvg({
  filterId,
  fill,
  stroke,
  strokeWidth = 1,
  strokeLinejoin,
  shapeRendering,
  children,
}: PinSvgProps) {
  return (
    <svg viewBox="-2 -2 36 42" width="100%" height="100%" shapeRendering={shapeRendering}>
      <defs>
        <filter id={filterId}>
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.4" />
        </filter>
      </defs>
      <path
        d={PIN_PATH}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin={strokeLinejoin}
        filter={`url(#${filterId})`}
      />
      {children}
    </svg>
  )
}
