/**
 * Issue#55: Symbol Layer移行 - ピン画像生成ユーティリティ
 *
 * Canvas APIを使用して、Mapbox GL JSのSymbol Layerで使用する
 * ティアドロップ形状のピン画像を動的に生成する。
 * 生成した画像は map.addImage() で登録して使用する。
 */

/** ピンの色をHEXカラーにマッピング */
export const PIN_COLOR_MAP: Record<string, string> = {
  Green: '#00d68f',
  Yellow: '#ffbe0b',
  Orange: '#ff6b35',
  Red: '#ff006e',
}

/** ピンの基準サイズ (px) */
export const BASE_PIN_SIZE = 32
/** ピンの高さ比率 */
export const PIN_HEIGHT_RATIO = 1.2
/** シャドウ用の余白 (px) */
const SHADOW_PADDING = 4
/** 999件超の表示上限 */
const PIN_COUNT_DISPLAY_LIMIT = 999
/** 高DPI対応のピクセル比率（Retina対応） */
export const PIN_PIXEL_RATIO = 2

/**
 * 投稿件数からピン色のHEXカラーを決定
 * Issue#12のピン色ルールに準拠
 */
export function determinePinColor(count: number): string {
  if (count >= 30) return PIN_COLOR_MAP.Red
  if (count >= 10) return PIN_COLOR_MAP.Orange
  if (count >= 5) return PIN_COLOR_MAP.Yellow
  return PIN_COLOR_MAP.Green
}

/**
 * ピン画像のキャッシュキーを生成
 */
export function getPinImageId(color: string, count: number): string {
  return `pin-${color}-${count}`
}

/**
 * Canvas上にティアドロップ形状のパスを描画する
 * PinSvgコンポーネントのPIN_PATHと同等の形状
 * SVG: M16 0C7.16 0 0 7.16 0 16c0 8 16 22 16 22s16-14 16-22C32 7.16 24.84 0 16 0z
 */
function drawTeardropPath(ctx: CanvasRenderingContext2D, scale: number, offsetX: number, offsetY: number): void {
  const s = scale
  ctx.beginPath()

  // SVGパス「M16 0 C7.16 0, 0 7.16, 0 16」を再現
  ctx.moveTo(offsetX + 16 * s, offsetY + 0)
  ctx.bezierCurveTo(
    offsetX + 7.16 * s, offsetY + 0,
    offsetX + 0, offsetY + 7.16 * s,
    offsetX + 0, offsetY + 16 * s
  )

  // 「c0 8 16 22 16 22」→ 「C0 24, 16 38, 16 38」
  ctx.bezierCurveTo(
    offsetX + 0, offsetY + 24 * s,
    offsetX + 16 * s, offsetY + 38 * s,
    offsetX + 16 * s, offsetY + 38 * s
  )

  // 「s16-14 16-22」→ 「S32 24, 32 16」(smooth curve)
  // smooth curveをbezierCurveToに変換
  ctx.bezierCurveTo(
    offsetX + 16 * s, offsetY + 38 * s,
    offsetX + 32 * s, offsetY + 24 * s,
    offsetX + 32 * s, offsetY + 16 * s
  )

  // 「C32 7.16 24.84 0 16 0z」
  ctx.bezierCurveTo(
    offsetX + 32 * s, offsetY + 7.16 * s,
    offsetX + 24.84 * s, offsetY + 0,
    offsetX + 16 * s, offsetY + 0
  )

  ctx.closePath()
}

/**
 * Canvas APIを使用してピン画像を生成する
 *
 * @param color - ピンの塗りつぶし色 (HEXカラー)
 * @param count - ピン内に表示する件数
 * @param scale - スケール倍率 (1.0 = 通常, 1.4 = zoom >= 16)
 * @returns 生成された画像データ (width, height, data)
 */
export function generatePinImage(
  color: string,
  count: number,
  scale: number
): { width: number; height: number; data: Uint8ClampedArray } {
  const pinWidth = Math.round(BASE_PIN_SIZE * scale)
  const pinHeight = Math.round(BASE_PIN_SIZE * PIN_HEIGHT_RATIO * scale)
  const logicalWidth = pinWidth + SHADOW_PADDING
  const logicalHeight = pinHeight + SHADOW_PADDING
  // 高DPI対応: Canvas物理ピクセルをPIN_PIXEL_RATIO倍で描画
  const canvasWidth = logicalWidth * PIN_PIXEL_RATIO
  const canvasHeight = logicalHeight * PIN_PIXEL_RATIO

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { width: canvasWidth, height: canvasHeight, data: new Uint8ClampedArray(canvasWidth * canvasHeight * 4) }
  }

  // PIN_PIXEL_RATIO倍の座標系にスケールアップして描画
  ctx.scale(PIN_PIXEL_RATIO, PIN_PIXEL_RATIO)

  const pathScale = pinWidth / 32 // PinSvgのviewBox基準(32)に対するスケール

  // 1. シャドウ描画
  ctx.save()
  ctx.translate(0.4 * pathScale, 1.2 * pathScale) // PinSvgのshadowオフセットに合わせる
  drawTeardropPath(ctx, pathScale, SHADOW_PADDING / 2, SHADOW_PADDING / 2)
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.fill()
  ctx.restore()

  // 2. ピン本体描画
  drawTeardropPath(ctx, pathScale, SHADOW_PADDING / 2, SHADOW_PADDING / 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 1 * pathScale
  ctx.stroke()

  // 3. 件数テキスト描画
  const centerX = SHADOW_PADDING / 2 + 16 * pathScale
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (count > PIN_COUNT_DISPLAY_LIMIT) {
    // 999+表示：2段テキスト
    const fontSize = Math.round(14 * pathScale)
    const smallFontSize = Math.round(10 * pathScale)

    // ストローク（黒縁取り）
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 3 * pathScale
    ctx.lineJoin = 'round'
    const textY1 = SHADOW_PADDING / 2 + 14 * pathScale
    ctx.strokeText('999', centerX, textY1)
    ctx.fillStyle = '#ffffff'
    ctx.fillText('999', centerX, textY1)

    ctx.font = `bold ${smallFontSize}px sans-serif`
    ctx.lineWidth = 2 * pathScale
    const textY2 = SHADOW_PADDING / 2 + 25 * pathScale
    ctx.strokeText('+', centerX, textY2)
    ctx.fillStyle = '#ffffff'
    ctx.fillText('+', centerX, textY2)
  } else {
    // 通常テキスト
    const fontSize = Math.round(14 * pathScale)
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 3 * pathScale
    ctx.lineJoin = 'round'
    const textY = SHADOW_PADDING / 2 + 16 * pathScale
    ctx.strokeText(count.toString(), centerX, textY)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(count.toString(), centerX, textY)
  }

  return ctx.getImageData(0, 0, canvasWidth, canvasHeight)
}
