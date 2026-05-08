import React from 'react'

/**
 * 画像のダウンロード保護を適用する画像コンポーネント。
 * 右クリック保存・長押し保存・ドラッグ保存を防止する。
 *
 * Issue#126: loading 属性のデフォルトを "lazy" にする。fold above の画像
 * （PhotoDetailDialog のメイン写真、プロフィール画像、ロゴ等）は呼び出し側で
 * loading="eager" を明示指定して上書きする。
 */
export function ProtectedImage(props: Readonly<React.ImgHTMLAttributes<HTMLImageElement>>) {
  const { className, style, loading, ...rest } = props

  const handleContextMenu = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault()
  }

  const handleDragStart = (e: React.DragEvent<HTMLImageElement>) => {
    e.preventDefault()
  }

  return (
    <img
      {...rest}
      loading={loading ?? 'lazy'}
      className={`touch-callout-none user-drag-none select-none ${className ?? ''}`}
      style={{ ...style, userSelect: 'none' }}
      draggable={false}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
    />
  )
}
