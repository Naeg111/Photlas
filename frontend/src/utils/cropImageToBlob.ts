/**
 * Issue#119: トリミング領域を実画像 Blob に変換するユーティリティ。
 *
 * react-easy-crop は座標（{@link Area}）のみ返すため、Canvas API で実画像化する。
 *
 * 用途別の使い分け:
 * - 投稿（S3 保存）: ネイティブ解像度 + 高品質（quality=0.92）。50MB 超なら長辺 4000px にダウンスケール
 * - AI 解析（analyze API）: 常に長辺 2000px、quality=0.85（バックエンドが 1280px に再縮小するため十分）
 */

import type { Area } from 'react-easy-crop'

const OUTPUT_TYPE = 'image/jpeg'
const DEFAULT_OUTPUT_QUALITY = 0.92
const ANALYZE_MAX_DIMENSION_PX = 2000
const ANALYZE_OUTPUT_QUALITY = 0.85
const UPLOAD_FILE_SIZE_GUARD_BYTES = 50 * 1024 * 1024
const UPLOAD_GUARD_MAX_DIMENSION_PX = 4000

interface CropOptions {
  /** 長辺の最大ピクセル数。指定すると aspect 比を保ったままダウンスケールする */
  maxDimension?: number
  /** JPEG 品質（0〜1）。既定 0.92 */
  quality?: number
}

export async function cropImageToBlob(
  imageSrc: string,
  area: Area,
  options: CropOptions = {},
): Promise<Blob> {
  const image = await loadImage(imageSrc)
  return drawCroppedToBlob(image, area, options.maxDimension, options.quality ?? DEFAULT_OUTPUT_QUALITY)
}

/**
 * AI 解析（analyze API）専用。常に長辺 2000px・quality=0.85 で書き出す。
 * Rekognition 側で更に 1280px へ縮小されるため、ここでの縮小は精度に影響しない。
 */
export async function cropImageToBlobForAnalyze(imageSrc: string, area: Area): Promise<Blob> {
  return cropImageToBlob(imageSrc, area, {
    maxDimension: ANALYZE_MAX_DIMENSION_PX,
    quality: ANALYZE_OUTPUT_QUALITY,
  })
}

/**
 * 投稿（S3 保存）用。ネイティブ解像度・品質 0.92 で書き出すが、50MB 超になった場合のみ
 * 長辺 4000px にダウンスケールする保険を入れている（multipart 上限超過の防止）。
 */
export async function cropImageToBlobForUpload(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const native = await drawCroppedToBlob(image, area, undefined, DEFAULT_OUTPUT_QUALITY)
  if (native.size <= UPLOAD_FILE_SIZE_GUARD_BYTES) {
    return native
  }
  return drawCroppedToBlob(image, area, UPLOAD_GUARD_MAX_DIMENSION_PX, DEFAULT_OUTPUT_QUALITY)
}

async function drawCroppedToBlob(
  image: HTMLImageElement,
  area: Area,
  maxDimension: number | undefined,
  quality: number,
): Promise<Blob> {
  const { canvasWidth, canvasHeight } = computeOutputSize(area.width, area.height, maxDimension)

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context の取得に失敗しました')
  }

  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvasWidth, canvasHeight)

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
      quality,
    )
  })
}

function computeOutputSize(srcWidth: number, srcHeight: number, maxDimension: number | undefined) {
  if (!maxDimension) {
    return { canvasWidth: srcWidth, canvasHeight: srcHeight }
  }
  const longest = Math.max(srcWidth, srcHeight)
  if (longest <= maxDimension) {
    return { canvasWidth: srcWidth, canvasHeight: srcHeight }
  }
  const scale = maxDimension / longest
  return {
    canvasWidth: Math.round(srcWidth * scale),
    canvasHeight: Math.round(srcHeight * scale),
  }
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
