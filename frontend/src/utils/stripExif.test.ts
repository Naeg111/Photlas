import { describe, it, expect, vi, beforeEach } from 'vitest'
import { stripExif } from './stripExif'

describe('stripExif', () => {
  const mockClose = vi.fn()
  const mockDrawImage = vi.fn()
  let mockToBlobCallback: ((blob: Blob | null) => void) | null = null

  const mockContext = {
    drawImage: mockDrawImage,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockToBlobCallback = null

    // createImageBitmapのモック
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() =>
        Promise.resolve({ width: 100, height: 100, close: mockClose })
      )
    )

    // document.createElementのモック（canvas要素用）
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockContext),
          toBlob: vi.fn(
            (callback: (blob: Blob | null) => void, type?: string, quality?: number) => {
              mockToBlobCallback = callback
              // デフォルトでは成功するBlobを返す
              const mimeType = type || 'image/jpeg'
              callback(new Blob(['image-data'], { type: mimeType }))
            }
          ),
        } as unknown as HTMLCanvasElement
      }
      return originalCreateElement(tagName)
    })
  })

  it('JPEGファイルに対してBlobを返す', async () => {
    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

    const result = await stripExif(file)

    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('image/jpeg')
  })

  it('PNGファイルに対してPNG形式のBlobを返す', async () => {
    const file = new File(['test'], 'photo.png', { type: 'image/png' })

    const result = await stripExif(file)

    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('image/png')
  })

  it('HEICファイルをJPEGに変換する', async () => {
    const file = new File(['test'], 'photo.heic', { type: 'image/heic' })

    const result = await stripExif(file)

    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('image/jpeg')
  })

  it('Canvasのサイズがビットマップのサイズと一致する', async () => {
    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
    const canvas = { width: 0, height: 0 } as { width: number; height: number }

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          get width() { return canvas.width },
          set width(v: number) { canvas.width = v },
          get height() { return canvas.height },
          set height(v: number) { canvas.height = v },
          getContext: vi.fn(() => mockContext),
          toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
            callback(new Blob(['data'], { type: 'image/jpeg' }))
          }),
        } as unknown as HTMLCanvasElement
      }
      return document.createElement.call(document, tagName)
    })

    await stripExif(file)

    expect(canvas.width).toBe(100)
    expect(canvas.height).toBe(100)
  })

  it('描画後にbitmap.close()が呼ばれる', async () => {
    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

    await stripExif(file)

    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('Canvasコンテキストがnullの場合にエラーをスローする', async () => {
    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => null),
          toBlob: vi.fn(),
        } as unknown as HTMLCanvasElement
      }
      return document.createElement.call(document, tagName)
    })

    await expect(stripExif(file)).rejects.toThrow(
      'Canvas 2D context の取得に失敗しました'
    )
  })

  it('toBlobがnullを返した場合にエラーをスローする', async () => {
    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockContext),
          toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
            callback(null)
          }),
        } as unknown as HTMLCanvasElement
      }
      return document.createElement.call(document, tagName)
    })

    await expect(stripExif(file)).rejects.toThrow(
      '画像の再エンコードに失敗しました'
    )
  })

  it('JPEG出力時にquality 0.95が使用される', async () => {
    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
    let capturedQuality: number | undefined

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockContext),
          toBlob: vi.fn(
            (
              callback: (blob: Blob | null) => void,
              _type?: string,
              quality?: number
            ) => {
              capturedQuality = quality
              callback(new Blob(['data'], { type: 'image/jpeg' }))
            }
          ),
        } as unknown as HTMLCanvasElement
      }
      return document.createElement.call(document, tagName)
    })

    await stripExif(file)

    expect(capturedQuality).toBe(0.95)
  })
})
