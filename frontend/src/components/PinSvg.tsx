/**
 * PinSvg コンポーネント
 * Issue#53: Mapbox移行に伴うリファクタリングで共通化
 *
 * 地図上のピンSVGを描画する共通コンポーネント
 * MapView（クラスタ・個別・撮影地点）とPhotoDetailDialog（ミニマップ）で使用
 *
 * ドロップシャドウはSVGフィルター（feDropShadow）やCSS filter: drop-shadow()を
 * 使用せず、半透明のSVGパス（オフセット複製）で表現する。
 * SVGフィルターはラスタライズされた中間バッファを生成し、CSS filterは
 * コンポジットレイヤーを生成するため、Mapboxの will-change: transform と
 * 組み合わさるとズーム時にビットマップ拡縮によるぼやけが発生する。
 * 純粋なSVGパスであればベクターのまま描画されるため常にシャープになる。
 */

interface PinSvgProps {
  fill: string
  stroke: string
  strokeWidth?: number
  strokeLinejoin?: 'round' | 'miter' | 'bevel'
  shapeRendering?: string
  children?: React.ReactNode
}

const PIN_PATH = 'M16 0C7.16 0 0 7.16 0 16c0 8 16 22 16 22s16-14 16-22C32 7.16 24.84 0 16 0z'

export function PinSvg({
  fill,
  stroke,
  strokeWidth = 1,
  strokeLinejoin,
  shapeRendering = 'geometricPrecision',
  children,
}: Readonly<PinSvgProps>) {
  return (
    <svg viewBox="-2 -2 36 42" width="100%" height="100%" shapeRendering={shapeRendering}>
      <path
        d={PIN_PATH}
        fill="rgba(0,0,0,0.2)"
        stroke="none"
        transform="translate(0.4, 1.2)"
      />
      <path
        d={PIN_PATH}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin={strokeLinejoin}
      />
      {children}
    </svg>
  )
}
