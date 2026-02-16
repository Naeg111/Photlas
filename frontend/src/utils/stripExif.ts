/**
 * EXIF情報削除ユーティリティ
 * Canvas APIを使用して画像を再エンコードし、EXIF情報を除去する
 */

/**
 * 画像ファイルからEXIF情報を削除する
 * Canvas APIで画像を再描画し、メタデータなしの画像Blobを返す
 *
 * @param file 元の画像ファイル
 * @returns EXIF情報を削除した画像Blob
 */
export async function stripExif(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)

  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context の取得に失敗しました')
  }

  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const outputType = getOutputMimeType(file.type)
  const quality = outputType === 'image/jpeg' ? 0.95 : undefined

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('画像の再エンコードに失敗しました'))
        }
      },
      outputType,
      quality,
    )
  })
}

/**
 * 入力ファイルのMIMEタイプから出力MIMEタイプを決定する
 * HEIC等のブラウザで出力不可能な形式はJPEGに変換する
 */
function getOutputMimeType(inputType: string): string {
  if (inputType === 'image/png') {
    return 'image/png'
  }
  return 'image/jpeg'
}
