/**
 * Issue#119: トリミング領域を実画像 Blob に変換するユーティリティ。
 *
 * react-easy-crop は座標（{@link Area}）のみ返すため、Canvas API で実画像化する。
 * トリミング領域のネイティブ解像度をそのまま保持し、JPEG として出力する
 * （バックエンドが Rekognition 送信前に長辺 1280px へ縮小するため、フロント側は無加工）。
 */

import type { Area } from 'react-easy-crop'

const OUTPUT_TYPE = 'image/jpeg'
const OUTPUT_QUALITY = 0.92

/**
 * 画像 URL（DataURL or ObjectURL）とトリミング座標から、トリミング後の画像 Blob を生成する。
 *
 * @param imageSrc トリミング元画像の URL
 * @param area     react-easy-crop の {@code croppedAreaPixels}
 * @returns        トリミング後の JPEG Blob
 */
export async function cropImageToBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc)

  const canvas = document.createElement('canvas')
  canvas.width = area.width
  canvas.height = area.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context の取得に失敗しました')
  }

  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('画像の Blob 化に失敗しました'))
        }
      },
      OUTPUT_TYPE,
      OUTPUT_QUALITY
    )
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    image.src = src
  })
}
