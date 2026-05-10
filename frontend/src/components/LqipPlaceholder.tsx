/**
 * Issue#125: LQIP（低品質プレースホルダー）の表示コンポーネント。
 *
 * 本物のサムネイルが読み込まれるまで、20×20 px 程度の WebP を data URL 形式で
 * ぼかし表示するためのコンポーネント。本物のサムネイルが上に重なるとそのまま隠れる。
 *
 * 利用箇所:
 * - PhotoDetailDialog（メイン写真）: 既定スタイル（object-cover + scale-110）でフィット
 * - ProfileDialog の写真グリッド: crop 変換 (objectPosition/transform) を style で指定
 *
 * src が null/undefined/空文字 の場合は描画しない（フォールバック挙動）。
 * モデレーション制限中の写真は API 側で lqip = null になるため、漏れ防止される。
 */
import React from 'react'

const LQIP_DEFAULT_CLASS =
  'absolute inset-0 w-full h-full object-cover scale-110 blur-md'

const LQIP_BASE_CLASS_WHEN_STYLED =
  'absolute inset-0 w-full h-full blur-md'

interface Props {
  src: string | null | undefined
  /**
   * 呼び出し側で crop 変換等を反映したい場合に渡す。
   * 指定された場合、object-cover / scale-110 のデフォルトは外れる
   * （style 内の objectFit / transform で制御する想定）。
   */
  style?: React.CSSProperties
}

export function LqipPlaceholder({ src, style }: Props) {
  if (!src) return null
  const className = style ? LQIP_BASE_CLASS_WHEN_STYLED : LQIP_DEFAULT_CLASS
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={className}
      style={style}
    />
  )
}
