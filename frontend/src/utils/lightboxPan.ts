/**
 * ライトボックス（オリジナル画像の全画面表示）のパン（ドラッグ移動）量を計算する。
 *
 * 画像は画面中央を原点として表示され、拡大率に応じて中央を軸に拡大縮小される。
 * パン量に上限を設けないと、拡大して端までドラッグした後に縮小したとき、
 * 移動量だけが残って画像が画面の端に貼り付いてしまう。
 */

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/**
 * 1 軸ぶんのパン量を、画像が画面外にはみ出しすぎない範囲に丸める。
 *
 * 拡大後の画像が画面に収まる（scaledLength <= viewportLength）ときは上限 0、
 * つまりパン量は必ず 0 になり、画像は画面中央に戻る。
 *
 * @param value 丸める前のパン量（px）
 * @param scaledLength 拡大後の画像の長さ（px）
 * @param viewportLength 画面の長さ（px）
 * @return 丸めた後のパン量（px）
 */
function clampAxis(value: number, scaledLength: number, viewportLength: number): number {
  const limit = Math.max(0, (scaledLength - viewportLength) / 2)
  const clamped = Math.min(limit, Math.max(-limit, value))
  // Math.max(-0, ...) は -0 を返すことがあるため、素直な 0 に揃える
  return clamped === 0 ? 0 : clamped
}

/**
 * パン量を画像・画面サイズに応じて丸める。
 *
 * @param pan 丸める前のパン量
 * @param scale 現在の拡大率
 * @param content 拡大前の画像の表示サイズ
 * @param viewport 画面サイズ
 * @return 丸めた後のパン量（等倍以下では必ず画面中央 = {x: 0, y: 0}）
 */
export function clampLightboxPan(pan: Point, scale: number, content: Size, viewport: Size): Point {
  return {
    x: clampAxis(pan.x, content.width * scale, viewport.width),
    y: clampAxis(pan.y, content.height * scale, viewport.height),
  }
}
