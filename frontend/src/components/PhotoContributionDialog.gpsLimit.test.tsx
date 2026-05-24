import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PhotoContributionDialog } from './PhotoContributionDialog'
import type { ExifData } from '../utils/extractExif'

/**
 * Issue#146: アップロード時の GPS 1km 制限
 *
 * - EXIF に GPS がある写真は、ピンが GPS 地点から 1km を超えると投稿ボタンが非活性＋エラー表示
 * - 1km 以内なら投稿可能、その際 locationFromExif=true で送信される
 * - GPS が無い写真は従来どおり自由配置（locationFromExif=false、距離制限なし）
 */

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

vi.mock('motion/react', () => ({
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

vi.mock('react-map-gl', () => ({
  default: ({ children }: any) => <div data-testid="mapbox-map">{children}</div>,
  Map: ({ children }: any) => <div data-testid="mapbox-map">{children}</div>,
  Marker: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(() => ({
    suggest: vi.fn().mockResolvedValue({ suggestions: [] }),
    retrieve: vi.fn().mockResolvedValue({ features: [] }),
  })),
  SessionToken: vi.fn(),
}))

const mockExtractExif = vi.fn()
vi.mock('../utils/extractExif', () => ({
  extractExif: (...args: unknown[]) => mockExtractExif(...args),
}))

vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: { onCropComplete: (a: unknown, p: unknown) => void }) => (
    <div data-testid="cropper-component">
      <button
        data-testid="mock-crop-trigger"
        onClick={() => onCropComplete({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 600, height: 600 })}
      >
        Mock Crop
      </button>
    </div>
  ),
}))

vi.mock('../utils/tagsApi', () => ({
  fetchTags: vi.fn().mockResolvedValue({ tags: [] }),
}))

vi.mock('../utils/photoAnalyzeApi', () => ({
  analyzePhoto: vi.fn().mockResolvedValue({
    analyzeToken: null,
    categories: [],
    weather: null,
    suggestedTags: [],
    parentFallbacks: [],
    exifRulesFired: [],
  }),
}))

vi.mock('../utils/cropImageToBlob', () => ({
  cropImageToBlob: vi.fn(),
  cropImageToBlobForUpload: vi.fn(),
  resizeImageToBlobForAnalyze: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
}))

// InlineMapPicker のモック（onPositionChange を捕捉してピン移動を再現）
const mapPicker = vi.hoisted(() => ({
  onPositionChange: null as null | ((p: { lat: number; lng: number }) => void),
  position: null as null | { lat: number; lng: number },
}))
vi.mock('./InlineMapPicker', () => ({
  InlineMapPicker: ({ position, onPositionChange }: {
    position: { lat: number; lng: number } | null
    onPositionChange?: (p: { lat: number; lng: number }) => void
  }) => {
    mapPicker.position = position
    mapPicker.onPositionChange = onPositionChange ?? null
    return <div data-testid="inline-map-picker" />
  },
}))

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// GPS 原点（EXIF GPS）と各距離のピン座標
const GPS = { lat: 34.6937, lng: 135.5023 }
const METERS_PER_DEGREE = (6371000 * Math.PI) / 180
const WITHIN_1KM = { lat: GPS.lat + 500 / METERS_PER_DEGREE, lng: GPS.lng } // 約500m
const BEYOND_1KM = { lat: GPS.lat + 2000 / METERS_PER_DEGREE, lng: GPS.lng } // 約2000m

const gpsExif: ExifData = {
  takenAt: '2024-12-25T15:30:00.000Z',
  latitude: GPS.lat,
  longitude: GPS.lng,
}
const noGpsExif: ExifData = {
  takenAt: '2024-12-25T15:30:00.000Z',
  cameraBody: 'Canon EOS R5',
}

const defaultProps = { open: true, onOpenChange: vi.fn(), onSubmit: vi.fn() }

async function selectFileAndRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(input, file)

  await waitFor(() => {
    expect(screen.getByTestId('inline-map-picker')).toBeInTheDocument()
  })

  const categoryDiv = screen.getByText('自然風景').closest('div[class*="cursor-pointer"]')
  if (categoryDiv) await user.click(categoryDiv)
  const deviceTypeDiv = screen.getByText('一眼レフ').closest('div[class*="cursor-pointer"]')
  if (deviceTypeDiv) await user.click(deviceTypeDiv)
}

const submitButton = () => screen.getByRole('button', { name: '投稿する' })

describe('PhotoContributionDialog GPS 1km 制限 (Issue#146)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractExif.mockResolvedValue(null)
    mapPicker.onPositionChange = null
    mapPicker.position = null
  })

  it('GPS写真でピンをGPSから1km超に動かすとエラー表示＋投稿ボタン非活性', async () => {
    mockExtractExif.mockResolvedValue(gpsExif)
    const user = userEvent.setup()
    render(<PhotoContributionDialog {...defaultProps} />)
    await selectFileAndRequiredFields(user)

    // ピンを GPS から約2km 離す
    act(() => mapPicker.onPositionChange?.(BEYOND_1KM))

    await waitFor(() => {
      expect(screen.getByTestId('gps-too-far-error')).toBeInTheDocument()
    })
    expect(submitButton()).toBeDisabled()
  })

  it('GPS写真でも1km以内なら投稿ボタンが活性', async () => {
    mockExtractExif.mockResolvedValue(gpsExif)
    const user = userEvent.setup()
    render(<PhotoContributionDialog {...defaultProps} />)
    await selectFileAndRequiredFields(user)

    act(() => mapPicker.onPositionChange?.(WITHIN_1KM))

    await waitFor(() => {
      expect(submitButton()).not.toBeDisabled()
    })
    expect(screen.queryByTestId('gps-too-far-error')).not.toBeInTheDocument()
  })

  it('GPS写真は locationFromExif=true で送信される', async () => {
    mockExtractExif.mockResolvedValue(gpsExif)
    const mockSubmit = vi.fn(() => Promise.resolve())
    const user = userEvent.setup()
    render(<PhotoContributionDialog {...defaultProps} onSubmit={mockSubmit} />)
    await selectFileAndRequiredFields(user)

    await waitFor(() => expect(submitButton()).not.toBeDisabled())
    await user.click(submitButton())

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ locationFromExif: true })
      )
    })
  })

  it('GPSなし写真は locationFromExif=false で送信され距離制限がかからない', async () => {
    mockExtractExif.mockResolvedValue(noGpsExif)
    const mockSubmit = vi.fn(() => Promise.resolve())
    const user = userEvent.setup()
    render(<PhotoContributionDialog {...defaultProps} onSubmit={mockSubmit} />)
    await selectFileAndRequiredFields(user)

    await waitFor(() => expect(submitButton()).not.toBeDisabled())
    expect(screen.queryByTestId('gps-too-far-error')).not.toBeInTheDocument()
    await user.click(submitButton())

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ locationFromExif: false })
      )
    })
  })

  it('GPS写真では微調整の注記が表示される', async () => {
    mockExtractExif.mockResolvedValue(gpsExif)
    const user = userEvent.setup()
    render(<PhotoContributionDialog {...defaultProps} />)
    await selectFileAndRequiredFields(user)

    expect(screen.getByText(/微調整/)).toBeInTheDocument()
  })
})
