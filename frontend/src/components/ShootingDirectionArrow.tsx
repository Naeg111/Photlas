/**
 * 撮影方向を示す矢印コンポーネント
 * ミニマップ、プレビューモード、投稿ダイアログのマップピッカーで使用
 */

interface ShootingDirectionArrowProps {
  /** 撮影方向（度数、0=北、時計回り） */
  direction: number
  /** 矢印の長さ（px）。デフォルト: 95px（約2.5cm） */
  size?: number
}

export function ShootingDirectionArrow({ direction, size = 95 }: ShootingDirectionArrowProps) {
  const arrowHeadSize = 10
  const strokeWidth = 2.5
  const halfWidth = strokeWidth / 2 + arrowHeadSize

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        pointerEvents: 'none',
      }}
    >
      <svg
        width={halfWidth * 2}
        height={size}
        viewBox={`0 0 ${halfWidth * 2} ${size}`}
        style={{
          position: 'absolute',
          left: -halfWidth,
          top: -size,
          transformOrigin: `${halfWidth}px ${size}px`,
          transform: `rotate(${direction}deg)`,
        }}
      >
        {/* 矢印の軸 */}
        <line
          x1={halfWidth}
          y1={size}
          x2={halfWidth}
          y2={arrowHeadSize}
          stroke="#000000"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* 矢印の先端 */}
        <polygon
          points={`${halfWidth},0 ${halfWidth - arrowHeadSize},${arrowHeadSize + 4} ${halfWidth + arrowHeadSize},${arrowHeadSize + 4}`}
          fill="#000000"
        />
      </svg>
    </div>
  )
}
