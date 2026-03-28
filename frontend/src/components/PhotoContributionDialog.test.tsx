import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PhotoContributionDialog } from './PhotoContributionDialog'
import type { ExifData } from '../utils/extractExif'

/**
 * PhotoContributionDialog コンポーネントのテスト
 * Issue#27: パネル・ダイアログ群の移行
 *
 * 写真投稿ダイアログ - design-assetsベースでS3 Presigned URL連携を統合
 */

// motion/react のモック
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// react-map-gl のモック（InlineMapPickerの依存）
vi.mock('react-map-gl', () => ({
  default: ({ children }: any) => <div data-testid="mapbox-map">{children}</div>,
  Map: ({ children }: any) => <div data-testid="mapbox-map">{children}</div>,
  Marker: ({ children }: any) => <div>{children}</div>,
}))

// @mapbox/search-js-core のモック
vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(() => ({
    suggest: vi.fn().mockResolvedValue({ suggestions: [] }),
    retrieve: vi.fn().mockResolvedValue({ features: [] }),
  })),
  SessionToken: vi.fn(),
}))

// extractExif のモック
const mockExtractExif = vi.fn()
vi.mock('../utils/extractExif', () => ({
  extractExif: (...args: unknown[]) => mockExtractExif(...args),
}))

// react-easy-crop のモック（Issue#49）
vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete, zoom }: { onCropComplete: (croppedArea: unknown, croppedAreaPixels: unknown) => void; zoom: number }) => {
    return (
      <div data-testid="cropper-component">
        <button
          data-testid="mock-crop-trigger"
          onClick={() =>
            onCropComplete(
              { x: 10, y: 20, width: 60, height: 60 },
              { x: 100, y: 200, width: 600, height: 600 }
            )
          }
        >
          Mock Crop
        </button>
        <span data-testid="crop-zoom">{zoom}</span>
      </div>
    )
  },
}))

// InlineMapPickerのモック（EXIF GPS テスト用にpositionを追跡）
let lastMapPickerPosition: { lat: number; lng: number } | null = null
vi.mock('./InlineMapPicker', () => ({
  InlineMapPicker: ({ position }: { position: { lat: number; lng: number } | null }) => {
    lastMapPickerPosition = position
    return (
      <div data-testid="inline-map-picker">
        {position && (
          <span data-testid="map-position">
            緯度: {position.lat.toFixed(4)}, 経度: {position.lng.toFixed(4)}
          </span>
        )}
      </div>
    )
  },
}))

// URL.createObjectURLのモック
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
const mockRevokeObjectURL = vi.fn()
global.URL.createObjectURL = mockCreateObjectURL
global.URL.revokeObjectURL = mockRevokeObjectURL

describe('PhotoContributionDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractExif.mockResolvedValue(null)
  })

  describe('UI Elements - UI要素', () => {
    it('renders dialog when open prop is true', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not render dialog when open prop is false', () => {
      render(<PhotoContributionDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders dialog title', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByRole('heading', { name: '写真を投稿' })).toBeInTheDocument()
    })

    it('renders photo selection area', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByText('写真 *')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '写真を選択' })).toBeInTheDocument()
    })

    it('renders file format information', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByText(/JPEG、PNG、HEIC/)).toBeInTheDocument()
      expect(screen.getByText(/50MB/)).toBeInTheDocument()
    })

    it('Issue#74 - タイトル入力フィールドが表示されない', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.queryByText('タイトル')).not.toBeInTheDocument()
      expect(screen.queryByPlaceholderText(/夕暮れの東京タワー/)).not.toBeInTheDocument()
    })

    it('renders location selection area', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByText('撮影場所 *')).toBeInTheDocument()
    })

    it('renders category selection area', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByText(/カテゴリ \*/)).toBeInTheDocument()
    })

    it('renders all 14 genre options', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      // Issue#63: 14ジャンルに変更（「その他」はカテゴリと機材種別で重複のため除外）
      const categories = ['自然風景', '街並み', '建造物', '夜景', 'グルメ', '植物', '動物', '野鳥', '自動車', 'バイク', '鉄道', '飛行機', '星空']
      categories.forEach(category => {
        expect(screen.getByText(category)).toBeInTheDocument()
      })
      // 「その他」はカテゴリと機材種別の両方に存在するため、getAllByTextで確認
      expect(screen.getAllByText('その他').length).toBeGreaterThanOrEqual(1)
    })

    it('renders cancel button', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
    })

    it('renders submit button', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
    })

  })

  describe('Photo Selection - 写真選択', () => {
    it('displays preview when file is selected', async () => {
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement

      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByTestId('photo-crop-area')).toBeInTheDocument()
      })
    })

    it('shows remove button when photo is selected', async () => {
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement

      await user.upload(input, file)

      await waitFor(() => {
        // 削除ボタン（Xアイコン）が表示される
        const removeButton = screen.getByRole('button', { name: /削除|remove/i }) ||
                            document.querySelector('button[class*="destructive"]')
        expect(removeButton).toBeInTheDocument()
      })
    })
  })

  describe('Category Selection - カテゴリ選択', () => {
    it('allows selecting a category', async () => {
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const categoryButton = screen.getByText('自然風景').closest('div[class*="cursor-pointer"]') ||
                            screen.getByLabelText('風景')

      if (categoryButton) {
        await user.click(categoryButton)
      }

      // カテゴリが選択されていることを確認（チェックボックスの状態）
      const checkbox = screen.getByRole('checkbox', { name: /自然風景/ })
      expect(checkbox).toBeChecked()
    })

    it('allows selecting multiple categories', async () => {
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      // 複数のカテゴリを選択（親divをクリック）
      const landscapeDiv = screen.getByText('自然風景').closest('div[class*="cursor-pointer"]')
      const cityDiv = screen.getByText('街並み').closest('div[class*="cursor-pointer"]')

      if (landscapeDiv) await user.click(landscapeDiv)
      if (cityDiv) await user.click(cityDiv)

      // チェックボックスの状態を確認
      await waitFor(() => {
        const landscapeCheckbox = screen.getByRole('checkbox', { name: /自然風景/ })
        const cityCheckbox = screen.getByRole('checkbox', { name: /街並み/ })
        expect(landscapeCheckbox).toBeChecked()
        expect(cityCheckbox).toBeChecked()
      })
    })
  })

  describe('Submit Button State - 投稿ボタンの状態', () => {
    it('submit button is disabled when no photo is selected', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('submit button is disabled when no category is selected', async () => {
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      // 写真を選択
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // カテゴリ未選択の状態
      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Cancel Button - キャンセルボタン', () => {
    it('calls onOpenChange(false) when cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'キャンセル' }))

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Upload Status - アップロード状態', () => {
    it('shows uploading message during upload', async () => {
      const user = userEvent.setup()
      // onSubmitを遅延させてアップロード中の状態を確認できるようにする
      const slowSubmit = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 1000)))
      render(<PhotoContributionDialog {...defaultProps} onSubmit={slowSubmit} />)

      // 全ての必須項目を入力
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // カテゴリを選択（親divをクリック）
      const categoryDiv = screen.getByText('自然風景').closest('div[class*="cursor-pointer"]')
      if (categoryDiv) await user.click(categoryDiv)

      // 機材種別を選択
      const deviceTypeDiv = screen.getByText('ミラーレス').closest('div[class*="cursor-pointer"]')
      if (deviceTypeDiv) await user.click(deviceTypeDiv)

      // 天気を選択
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

      // InlineMapPickerが表示されていることを確認
      await waitFor(() => {
        expect(screen.getByTestId('inline-map-picker')).toBeInTheDocument()
      })

      // 投稿ボタンが有効になることを確認
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '投稿する' })
        expect(submitButton).not.toBeDisabled()
      })

      // 投稿ボタンをクリック
      const submitButton = screen.getByRole('button', { name: '投稿する' })
      await user.click(submitButton)

      // アップロード中のメッセージを確認
      await waitFor(() => {
        expect(screen.getByText('送信しています')).toBeInTheDocument()
      })
    })
  })

  describe('EXIF Auto-Extraction - EXIF自動抽出 (Issue#41)', () => {
    const fullExifData: ExifData = {
      takenAt: '2024-12-25T15:30:00.000Z',
      latitude: 34.6937,
      longitude: 135.5023,
      cameraBody: 'Canon EOS R5',
      cameraLens: 'RF24-70mm F2.8 L IS USM',
      focalLength35mm: 50,
      fValue: 'f/2.8',
      iso: 400,
      shutterSpeed: '1/1000',
      imageWidth: 8192,
      imageHeight: 5464,
    }

    it('should display EXIF info section when EXIF data is extracted', async () => {
      mockExtractExif.mockResolvedValue(fullExifData)
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByText('Canon EOS R5')).toBeInTheDocument()
        expect(screen.getByText('RF24-70mm F2.8 L IS USM')).toBeInTheDocument()
        expect(screen.getByText('f/2.8')).toBeInTheDocument()
        expect(screen.getByText('1/1000')).toBeInTheDocument()
        expect(screen.getByText('ISO 400')).toBeInTheDocument()
        expect(screen.getByText('50mm')).toBeInTheDocument()
        expect(screen.getByText('8192 x 5464')).toBeInTheDocument()
      })
    })

    it('should not display EXIF info section when no EXIF data available', async () => {
      mockExtractExif.mockResolvedValue(null)
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const file = new File(['test'], 'screenshot.png', { type: 'image/png' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByTestId('photo-crop-area')).toBeInTheDocument()
      })

      // EXIF表示エリアが存在しないことを確認
      expect(screen.queryByText('カメラ情報')).not.toBeInTheDocument()
    })

    it('should only display available EXIF fields', async () => {
      const partialExif: ExifData = {
        cameraBody: 'Sony ILCE-7M4',
        fValue: 'f/4',
        iso: 800,
      }
      mockExtractExif.mockResolvedValue(partialExif)
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByText('Sony ILCE-7M4')).toBeInTheDocument()
        expect(screen.getByText('f/4')).toBeInTheDocument()
        expect(screen.getByText('ISO 800')).toBeInTheDocument()
      })

      // 未取得のフィールドは非表示
      expect(screen.queryByText(/1\//)).not.toBeInTheDocument() // shutterSpeed
      expect(screen.queryByText(/mm$/)).not.toBeInTheDocument() // focalLength
    })

    it('should pass EXIF GPS data to onSubmit as position', async () => {
      mockExtractExif.mockResolvedValue(fullExifData)
      const mockSubmit = vi.fn(() => Promise.resolve())
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} onSubmit={mockSubmit} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // 天気を選択
      await waitFor(() => {
        expect(screen.getByTestId('photo-crop-area')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

      // カテゴリを選択
      const categoryDiv = screen.getByText('自然風景').closest('div[class*="cursor-pointer"]')
      if (categoryDiv) await user.click(categoryDiv)

      // 機材種別を選択
      const deviceTypeDiv = screen.getByText('一眼レフ').closest('div[class*="cursor-pointer"]')
      if (deviceTypeDiv) await user.click(deviceTypeDiv)

      // 投稿
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
      })
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      // GPS座標がEXIFから取得された値でsubmitされることを確認
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            position: { lat: 34.6937, lng: 135.5023 },
          })
        )
      })
    })

    it('should use default position when EXIF has no GPS data', async () => {
      const noGpsExif: ExifData = {
        cameraBody: 'Canon EOS R5',
        fValue: 'f/2.8',
      }
      mockExtractExif.mockResolvedValue(noGpsExif)
      const mockSubmit = vi.fn(() => Promise.resolve())
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} onSubmit={mockSubmit} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // 天気を選択
      await waitFor(() => {
        expect(screen.getByTestId('photo-crop-area')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

      // カテゴリを選択
      const categoryDiv = screen.getByText('自然風景').closest('div[class*="cursor-pointer"]')
      if (categoryDiv) await user.click(categoryDiv)

      // 機材種別を選択
      const deviceTypeDiv = screen.getByText('一眼レフ').closest('div[class*="cursor-pointer"]')
      if (deviceTypeDiv) await user.click(deviceTypeDiv)

      // 投稿
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
      })
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      // デフォルト位置（東京駅）が使用されることを確認
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            position: { lat: 35.6812, lng: 139.7671 },
          })
        )
      })
    })

    it('should pass EXIF data to onSubmit callback', async () => {
      mockExtractExif.mockResolvedValue(fullExifData)
      const mockSubmit = vi.fn(() => Promise.resolve())
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} onSubmit={mockSubmit} />)

      // 写真を選択
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // 天気を選択
      await waitFor(() => {
        expect(screen.getByTestId('photo-crop-area')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

      // カテゴリを選択
      const categoryDiv = screen.getByText('自然風景').closest('div[class*="cursor-pointer"]')
      if (categoryDiv) await user.click(categoryDiv)

      // 機材種別を選択
      const deviceTypeDiv = screen.getByText('一眼レフ').closest('div[class*="cursor-pointer"]')
      if (deviceTypeDiv) await user.click(deviceTypeDiv)

      // 投稿ボタンが有効になるのを待ってクリック
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
      })
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            exif: expect.objectContaining({
              cameraBody: 'Canon EOS R5',
              cameraLens: 'RF24-70mm F2.8 L IS USM',
              focalLength35mm: 50,
              fValue: 'f/2.8',
              iso: 400,
              shutterSpeed: '1/1000',
              imageWidth: 8192,
              imageHeight: 5464,
            }),
            takenAt: '2024-12-25T15:30:00.000Z',
          })
        )
      })
    })

    it('should submit without EXIF data when not available', async () => {
      mockExtractExif.mockResolvedValue(null)
      const mockSubmit = vi.fn(() => Promise.resolve())
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} onSubmit={mockSubmit} />)

      // 写真を選択
      const file = new File(['test'], 'screenshot.png', { type: 'image/png' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // 天気を選択
      await waitFor(() => {
        expect(screen.getByTestId('photo-crop-area')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

      // カテゴリを選択
      const categoryDiv = screen.getByText('自然風景').closest('div[class*="cursor-pointer"]')
      if (categoryDiv) await user.click(categoryDiv)

      // 機材種別を選択
      const deviceTypeDiv = screen.getByText('コンパクトデジカメ').closest('div[class*="cursor-pointer"]')
      if (deviceTypeDiv) await user.click(deviceTypeDiv)

      // 投稿ボタンが有効になるのを待ってクリック
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
      })
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            exif: undefined,
            takenAt: undefined,
          })
        )
      })
    })
  })

  // ===== Issue#49: 写真クロップ機能テスト =====
  describe('Issue#49: 写真クロップ機能', () => {
    it('写真選択後にクロップUIが表示される', async () => {
      mockExtractExif.mockResolvedValue(null)
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByTestId('photo-crop-area')).toBeInTheDocument()
      })
    })

    it('クロップデータがonSubmitに渡される', async () => {
      mockExtractExif.mockResolvedValue(null)
      const mockSubmit = vi.fn(() => Promise.resolve())
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} onSubmit={mockSubmit} />)

      // 写真を選択
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByTestId('photo-crop-area')).toBeInTheDocument()
      })

      // クロップを実行（モックのトリガーをクリック）
      await user.click(screen.getByTestId('mock-crop-trigger'))

      // 天気を選択
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

      // カテゴリを選択
      const categoryDiv = screen.getByText('自然風景').closest('div[class*="cursor-pointer"]')
      if (categoryDiv) await user.click(categoryDiv)

      // 機材種別を選択
      const deviceTypeDiv = screen.getByText('ミラーレス').closest('div[class*="cursor-pointer"]')
      if (deviceTypeDiv) await user.click(deviceTypeDiv)

      // 投稿
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
      })
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            cropCenterX: expect.any(Number),
            cropCenterY: expect.any(Number),
            cropZoom: expect.any(Number),
          })
        )
      })
    })
  })

  // ============================================================
  // 必須ラベル変更
  // ============================================================

  describe('必須ラベル表示', () => {
    it('「* は入力必須項目です」が表示されない', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.queryByText('* は入力必須項目です')).not.toBeInTheDocument()
    })

    it('必須項目に「（必須）」ラベルが表示される', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByText('写真（必須）')).toBeInTheDocument()
      expect(screen.getByText('撮影場所（必須）')).toBeInTheDocument()
    })
  })
})
