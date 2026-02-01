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

// @react-google-maps/api のモック
vi.mock('@react-google-maps/api', () => ({
  useLoadScript: () => ({
    isLoaded: true,
    loadError: null,
  }),
  GoogleMap: ({ children, onLoad, center }: any) => {
    // onLoadコールバックを呼び出してマップインスタンスをシミュレート
    if (onLoad) {
      // centerプロパティを追跡して、getCenterがそれを返すようにする
      let currentCenter = center || { lat: 35.6762, lng: 139.6503 }
      const mockMap = {
        getCenter: () => ({
          lat: () => currentCenter.lat,
          lng: () => currentCenter.lng,
        }),
        panTo: vi.fn((newCenter: { lat: number; lng: number }) => {
          currentCenter = newCenter
        }),
        addListener: (_event: string, callback: () => void) => {
          // idle イベントを即座に発火
          setTimeout(callback, 0)
          return { remove: vi.fn() }
        },
      }
      setTimeout(() => onLoad(mockMap), 0)
    }
    return <div data-testid="google-map-mock">{children}</div>
  },
  Autocomplete: ({ children }: any) => <div data-testid="autocomplete-mock">{children}</div>,
}))

// extractExif のモック
const mockExtractExif = vi.fn()
vi.mock('../utils/extractExif', () => ({
  extractExif: (...args: unknown[]) => mockExtractExif(...args),
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

    it('renders title input field', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByText('タイトル')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/夕暮れの東京タワー/)).toBeInTheDocument()
    })

    it('renders location selection area', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByText('撮影場所 *')).toBeInTheDocument()
    })

    it('renders category selection area', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByText(/カテゴリ \*/)).toBeInTheDocument()
    })

    it('renders all 12 category options', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      const categories = ['風景', '街並み', '植物', '動物', '自動車', 'バイク', '鉄道', '飛行機', '食べ物', 'ポートレート', '星空', 'その他']
      categories.forEach(category => {
        expect(screen.getByText(category)).toBeInTheDocument()
      })
    })

    it('renders cancel button', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
    })

    it('renders submit button', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
    })

    it('renders title character count', () => {
      render(<PhotoContributionDialog {...defaultProps} />)

      expect(screen.getByText(/\/20文字/)).toBeInTheDocument()
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
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument()
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

      const categoryButton = screen.getByText('風景').closest('div[class*="cursor-pointer"]') ||
                            screen.getByLabelText('風景')

      if (categoryButton) {
        await user.click(categoryButton)
      }

      // カテゴリが選択されていることを確認（チェックボックスの状態）
      const checkbox = screen.getByRole('checkbox', { name: /風景/ })
      expect(checkbox).toBeChecked()
    })

    it('allows selecting multiple categories', async () => {
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      // 複数のカテゴリを選択（親divをクリック）
      const landscapeDiv = screen.getByText('風景').closest('div[class*="cursor-pointer"]')
      const cityDiv = screen.getByText('街並み').closest('div[class*="cursor-pointer"]')

      if (landscapeDiv) await user.click(landscapeDiv)
      if (cityDiv) await user.click(cityDiv)

      // チェックボックスの状態を確認
      await waitFor(() => {
        const landscapeCheckbox = screen.getByRole('checkbox', { name: /風景/ })
        const cityCheckbox = screen.getByRole('checkbox', { name: /街並み/ })
        expect(landscapeCheckbox).toBeChecked()
        expect(cityCheckbox).toBeChecked()
      })
    })
  })

  describe('Title Input - タイトル入力', () => {
    it('updates title when user types', async () => {
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const titleInput = screen.getByPlaceholderText(/夕暮れの東京タワー/)
      await user.type(titleInput, 'テスト写真')

      expect(titleInput).toHaveValue('テスト写真')
    })

    it('updates character count when title is entered', async () => {
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const titleInput = screen.getByPlaceholderText(/夕暮れの東京タワー/)
      await user.type(titleInput, 'テスト')

      expect(screen.getByText('3/20文字')).toBeInTheDocument()
    })

    it('limits title to 20 characters', async () => {
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const titleInput = screen.getByPlaceholderText(/夕暮れの東京タワー/) as HTMLInputElement
      expect(titleInput).toHaveAttribute('maxLength', '20')
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

      // タイトルを入力
      const titleInput = screen.getByPlaceholderText(/夕暮れの東京タワー/)
      await user.type(titleInput, 'テスト写真')

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

      const titleInput = screen.getByPlaceholderText(/夕暮れの東京タワー/)
      await user.type(titleInput, 'テスト写真')

      // カテゴリを選択（親divをクリック）
      const categoryDiv = screen.getByText('風景').closest('div[class*="cursor-pointer"]')
      if (categoryDiv) await user.click(categoryDiv)

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
      shootingDirection: 90.0,
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
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument()
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
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

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
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

      // 投稿
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
      })
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      // デフォルト位置（新宿）が使用されることを確認
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            position: { lat: 35.6762, lng: 139.6503 },
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
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

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
            shootingDirection: 90.0,
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
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

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
            shootingDirection: undefined,
          })
        )
      })
    })
  })

  describe('Shooting Direction - 撮影方向 (Issue#42)', () => {
    it('should render shooting direction section with 8-direction buttons', async () => {
      mockExtractExif.mockResolvedValue(null)
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      // 写真を選択して撮影方向セクションを表示
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByText('撮影方向')).toBeInTheDocument()
      })

      // 8方位ボタンが表示されることを確認
      const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西']
      directions.forEach(direction => {
        expect(screen.getByRole('button', { name: direction })).toBeInTheDocument()
      })
    })

    it('should select a direction when 8-direction button is clicked', async () => {
      mockExtractExif.mockResolvedValue(null)
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '東' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '東' }))

      // 東ボタンが選択状態になることを確認
      await waitFor(() => {
        const eastButton = screen.getByRole('button', { name: '東' })
        expect(eastButton.className).toMatch(/border-primary|bg-primary/)
      })
    })

    it('should map 8-direction buttons to correct angles', async () => {
      mockExtractExif.mockResolvedValue(null)
      const mockSubmit = vi.fn(() => Promise.resolve())
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} onSubmit={mockSubmit} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // 天気を選択
      await waitFor(() => {
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

      // 南東（135°）を選択
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '南東' })).toBeInTheDocument()
      })
      await user.click(screen.getByRole('button', { name: '南東' }))

      // 投稿
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
      })
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            shootingDirection: 135,
          })
        )
      })
    })

    it('should have a reset button to clear shooting direction', async () => {
      mockExtractExif.mockResolvedValue(null)
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '東' })).toBeInTheDocument()
      })

      // 方向を選択
      await user.click(screen.getByRole('button', { name: '東' }))

      // リセットボタンをクリック
      const resetButton = screen.getByRole('button', { name: /リセット/ })
      await user.click(resetButton)

      // 選択が解除されることを確認
      await waitFor(() => {
        const eastButton = screen.getByRole('button', { name: '東' })
        expect(eastButton.className).not.toMatch(/border-primary|bg-primary/)
      })
    })

    it('should auto-fill shooting direction from EXIF data', async () => {
      const exifWithDirection: ExifData = {
        cameraBody: 'Canon EOS R5',
        shootingDirection: 225.5,
      }
      mockExtractExif.mockResolvedValue(exifWithDirection)
      const mockSubmit = vi.fn(() => Promise.resolve())
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} onSubmit={mockSubmit} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // 天気を選択
      await waitFor(() => {
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

      // 投稿
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
      })
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      // EXIFの撮影方向が送信されることを確認
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            shootingDirection: 225.5,
          })
        )
      })
    })

    it('should allow overriding EXIF direction with manual selection', async () => {
      const exifWithDirection: ExifData = {
        cameraBody: 'Canon EOS R5',
        shootingDirection: 225.5,
      }
      mockExtractExif.mockResolvedValue(exifWithDirection)
      const mockSubmit = vi.fn(() => Promise.resolve())
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} onSubmit={mockSubmit} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // 天気を選択
      await waitFor(() => {
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

      // 手動で北（0°）を選択して上書き
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '北' })).toBeInTheDocument()
      })
      await user.click(screen.getByRole('button', { name: '北' }))

      // 投稿
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
      })
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      // 手動選択（北=0°）が送信されることを確認
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            shootingDirection: 0,
          })
        )
      })
    })

    it('should submit without shooting direction when not set', async () => {
      mockExtractExif.mockResolvedValue(null)
      const mockSubmit = vi.fn(() => Promise.resolve())
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} onSubmit={mockSubmit} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // 天気を選択
      await waitFor(() => {
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument()
      })
      const weatherDiv = screen.getByText('晴れ').closest('div[class*="cursor-pointer"]')
      if (weatherDiv) await user.click(weatherDiv)

      // 撮影方向は未設定のまま投稿
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
      })
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            shootingDirection: undefined,
          })
        )
      })
    })
  })
})
