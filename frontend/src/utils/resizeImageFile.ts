/**
 * 投稿用に File を長辺指定でリサイズするユーティリティ。
 *
 * クロップは行わず、画像全体を Canvas に描き直して JPEG として書き出す。
 * 投稿（POST /api/v1/photos）の multipart 上限超過を防ぐ保険として、
 * 50MB を超える元ファイルだけを長辺 4000px に縮小する目的で利用する。
 */

const OUTPUT_TYPE = 'image/jpeg'
const OUTPUT_QUALITY = 0.92

export async function resizeImageFile(file: File, maxDimension: number): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const longest = Math.max(image.naturalWidth, image.naturalHeight)
    if (longest <= maxDimension) {
      return file
    }
    const scale = maxDimension / longest
    const width = Math.round(image.naturalWidth * scale)
    const height = Math.round(image.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context の取得に失敗しました')
    }
    ctx.drawImage(image, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('画像の Blob 化に失敗しました'))),
        OUTPUT_TYPE,
        OUTPUT_QUALITY,
      )
    })

    return new File([blob], replaceExtension(file.name, '.jpg'), {
      type: OUTPUT_TYPE,
      lastModified: file.lastModified,
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    image.src = src
  })
}

function replaceExtension(name: string, ext: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return name + ext
  return name.slice(0, dot) + ext
}
