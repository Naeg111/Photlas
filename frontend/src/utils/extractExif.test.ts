import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractExif, ExifData } from './extractExif'

/**
 * EXIF情報自動抽出ユーティリティのテスト
 * Issue#41: EXIF情報の自動抽出（フロントエンド）
 */

// exifrのモック
vi.mock('exifr', () => ({
  default: {
    parse: vi.fn(),
  },
}))

import exifr from 'exifr'

const mockParse = vi.mocked(exifr.parse)

describe('extractExif', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('EXIF情報の抽出', () => {
    it('should extract all EXIF fields from a JPEG file', async () => {
      const takenDate = new Date('2024-12-25T15:30:00Z')
      const mockExifData = {
        DateTimeOriginal: takenDate,
        latitude: 35.6762,
        longitude: 139.6503,
        Make: 'Canon',
        Model: 'Canon EOS R5',
        LensModel: 'RF24-70mm F2.8 L IS USM',
        FocalLengthIn35mmFilm: 50,
        FNumber: 2.8,
        ISO: 400,
        ExposureTime: 0.001,
        ImageWidth: 8192,
        ImageHeight: 5464,
      }
      mockParse.mockResolvedValue(mockExifData)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result).not.toBeNull()
      expect(result!.takenAt).toBe(takenDate.toISOString())
      expect(result!.latitude).toBe(35.6762)
      expect(result!.longitude).toBe(139.6503)
      expect(result!.cameraBody).toBe('Canon EOS R5')
      expect(result!.cameraLens).toBe('RF24-70mm F2.8 L IS USM')
      expect(result!.focalLength35mm).toBe(50)
      expect(result!.fValue).toBe('f/2.8')
      expect(result!.iso).toBe(400)
      expect(result!.shutterSpeed).toBe('1/1000')
      expect(result!.imageWidth).toBe(8192)
      expect(result!.imageHeight).toBe(5464)
    })

    it('should return null when EXIF data is not available (e.g., PNG screenshot)', async () => {
      mockParse.mockResolvedValue(null)

      const file = new File(['test'], 'screenshot.png', { type: 'image/png' })
      const result = await extractExif(file)

      expect(result).toBeNull()
    })

    it('should handle EXIF parse error gracefully', async () => {
      mockParse.mockRejectedValue(new Error('Parse error'))

      const file = new File(['test'], 'corrupted.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result).toBeNull()
    })

    it('should return partial EXIF data when some fields are missing', async () => {
      const mockExifData = {
        Make: 'Sony',
        Model: 'ILCE-7M4',
        FNumber: 4.0,
        ISO: 800,
      }
      mockParse.mockResolvedValue(mockExifData)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result).not.toBeNull()
      expect(result!.cameraBody).toBe('Sony ILCE-7M4')
      expect(result!.fValue).toBe('f/4')
      expect(result!.iso).toBe(800)
      expect(result!.latitude).toBeUndefined()
      expect(result!.longitude).toBeUndefined()
      expect(result!.takenAt).toBeUndefined()
      expect(result!.shutterSpeed).toBeUndefined()
    })
  })

  describe('カメラ機種名の組み立て', () => {
    it('should use Model only when Model already contains Make', async () => {
      mockParse.mockResolvedValue({
        Make: 'Canon',
        Model: 'Canon EOS R5',
      })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result!.cameraBody).toBe('Canon EOS R5')
    })

    it('should combine Make and Model when Model does not contain Make', async () => {
      mockParse.mockResolvedValue({
        Make: 'Sony',
        Model: 'ILCE-7M4',
      })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result!.cameraBody).toBe('Sony ILCE-7M4')
    })

    it('should return Model only when Make is not available', async () => {
      mockParse.mockResolvedValue({
        Model: 'iPhone 15 Pro',
      })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result!.cameraBody).toBe('iPhone 15 Pro')
    })
  })

  describe('シャッタースピードの変換', () => {
    it('should convert ExposureTime to fraction format for fast speeds', async () => {
      mockParse.mockResolvedValue({ ExposureTime: 0.001 })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result!.shutterSpeed).toBe('1/1000')
    })

    it('should convert ExposureTime to fraction format for moderate speeds', async () => {
      mockParse.mockResolvedValue({ ExposureTime: 1 / 250 })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result!.shutterSpeed).toBe('1/250')
    })

    it('should show seconds for long exposures', async () => {
      mockParse.mockResolvedValue({ ExposureTime: 2 })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result!.shutterSpeed).toBe('2"')
    })

    it('should handle 1 second exposure', async () => {
      mockParse.mockResolvedValue({ ExposureTime: 1 })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result!.shutterSpeed).toBe('1"')
    })
  })

  describe('F値の変換', () => {
    it('should format FNumber with f/ prefix', async () => {
      mockParse.mockResolvedValue({ FNumber: 2.8 })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result!.fValue).toBe('f/2.8')
    })

    it('should format integer FNumber without decimal', async () => {
      mockParse.mockResolvedValue({ FNumber: 4 })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await extractExif(file)

      expect(result!.fValue).toBe('f/4')
    })
  })

  describe('HEIC対応', () => {
    it('should extract EXIF from HEIC files', async () => {
      const mockExifData = {
        Make: 'Apple',
        Model: 'iPhone 15 Pro',
        FNumber: 1.78,
        ISO: 50,
        ExposureTime: 1 / 500,
      }
      mockParse.mockResolvedValue(mockExifData)

      const file = new File(['test'], 'photo.heic', { type: 'image/heic' })
      const result = await extractExif(file)

      expect(result).not.toBeNull()
      expect(result!.cameraBody).toBe('Apple iPhone 15 Pro')
      expect(result!.iso).toBe(50)
    })
  })
})
