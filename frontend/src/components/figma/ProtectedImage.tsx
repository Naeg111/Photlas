import React from 'react'

/**
 * 画像のダウンロード保護を適用する画像コンポーネント。
 * 右クリック保存・長押し保存・ドラッグ保存を防止する。
 */
export function ProtectedImage(props: Readonly<React.ImgHTMLAttributes<HTMLImageElement>>) {
  const { className, style, ...rest } = props

  const handleContextMenu = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault()
  }

  const handleDragStart = (e: React.DragEvent<HTMLImageElement>) => {
    e.preventDefault()
  }

  return (
    <img
      {...rest}
      className={`touch-callout-none user-drag-none select-none ${className ?? ''}`}
      style={{ ...style, userSelect: 'none' }}
      draggable={false}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
    />
  )
}
