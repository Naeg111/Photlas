/**
 * EXIF情報自動抽出ユーティリティ
 * Issue#41: EXIF情報の自動抽出（フロントエンド）
 *
 * exifrライブラリを使用して、画像ファイルからEXIF情報を抽出する。
 * JPEG/HEIC形式に対応。PNG等EXIF非対応の形式ではnullを返す。
 */

import exifr from 'exifr'

/**
 * 抽出されたEXIF情報の型定義
 */
export interface ExifData {
  takenAt?: string
  latitude?: number
  longitude?: number
  cameraBody?: string
  cameraLens?: string
  focalLength35mm?: number
  fValue?: string
  iso?: number
  shutterSpeed?: string
  imageWidth?: number
  imageHeight?: number
  isSmartphone?: boolean
}

/**
 * Issue#46: スマートフォンメーカーの判定リスト
 * camera_body文字列に含まれるかで判定する（大文字小文字を区別しない）
 */
const SMARTPHONE_MAKERS = [
  'apple', 'iphone', 'samsung', 'google', 'pixel',
  'huawei', 'xiaomi', 'oppo', 'oneplus', 'sony xperia',
]

/**
 * カメラ機種名からスマートフォンかどうかを判定する
 */
function isSmartphoneCamera(cameraBody?: string): boolean {
  if (!cameraBody) return false
  const lower = cameraBody.toLowerCase()
  return SMARTPHONE_MAKERS.some((maker) => lower.includes(maker))
}

/**
 * カメラ機種名を組み立てる
 * ModelにMakeが含まれている場合はModelのみ使用する
 */
function buildCameraBody(make?: string, model?: string): string | undefined {
  if (!make && !model) return undefined
  if (!make) return model
  if (!model) return make
  if (model.includes(make)) return model
  return `${make} ${model}`
}

/**
 * シャッタースピードを分数表記に変換する
 * 1秒未満: "1/XXX" 形式、1秒以上: 'X"' 形式
 */
function formatShutterSpeed(exposureTime?: number): string | undefined {
  if (exposureTime == null) return undefined
  if (exposureTime >= 1) {
    return `${exposureTime}"`
  }
  const denominator = Math.round(1 / exposureTime)
  return `1/${denominator}`
}

/**
 * F値を "f/X.X" 形式に変換する
 */
function formatFValue(fNumber?: number): string | undefined {
  if (fNumber == null) return undefined
  return `f/${fNumber}`
}

/**
 * 画像ファイルからEXIF情報を抽出する
 * @param file 画像ファイル
 * @returns EXIF情報（取得できない場合はnull）
 */
export async function extractExif(file: File): Promise<ExifData | null> {
  try {
    const raw = await exifr.parse(file, {
      pick: [
        'DateTimeOriginal',
        'GPSLatitude', 'GPSLongitude', 'latitude', 'longitude',
        'Make', 'Model', 'LensModel',
        'FocalLengthIn35mmFilm', 'FNumber', 'ISO',
        'ExposureTime', 'ImageWidth', 'ImageHeight',
      ],
    })

    if (!raw) return null

    const result: ExifData = {}
    let hasAnyField = false

    // 撮影日時
    if (raw.DateTimeOriginal) {
      const date = raw.DateTimeOriginal instanceof Date
        ? raw.DateTimeOriginal
        : new Date(raw.DateTimeOriginal)
      result.takenAt = date.toISOString()
      hasAnyField = true
    }

    // GPS座標
    if (raw.latitude != null) {
      result.latitude = raw.latitude
      hasAnyField = true
    }
    if (raw.longitude != null) {
      result.longitude = raw.longitude
      hasAnyField = true
    }

    // カメラ機種名
    const cameraBody = buildCameraBody(raw.Make, raw.Model)
    if (cameraBody) {
      result.cameraBody = cameraBody
      result.isSmartphone = isSmartphoneCamera(cameraBody)
      hasAnyField = true
    }

    // レンズ名
    if (raw.LensModel) {
      result.cameraLens = raw.LensModel
      hasAnyField = true
    }

    // 焦点距離
    if (raw.FocalLengthIn35mmFilm != null) {
      result.focalLength35mm = raw.FocalLengthIn35mmFilm
      hasAnyField = true
    }

    // F値
    const fValue = formatFValue(raw.FNumber)
    if (fValue) {
      result.fValue = fValue
      hasAnyField = true
    }

    // ISO
    if (raw.ISO != null) {
      result.iso = raw.ISO
      hasAnyField = true
    }

    // シャッタースピード
    const shutterSpeed = formatShutterSpeed(raw.ExposureTime)
    if (shutterSpeed) {
      result.shutterSpeed = shutterSpeed
      hasAnyField = true
    }

    // 画像サイズ
    if (raw.ImageWidth != null) {
      result.imageWidth = raw.ImageWidth
      hasAnyField = true
    }
    if (raw.ImageHeight != null) {
      result.imageHeight = raw.ImageHeight
      hasAnyField = true
    }

    return hasAnyField ? result : null
  } catch {
    return null
  }
}
