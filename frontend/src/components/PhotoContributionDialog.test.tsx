import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PhotoContributionDialog } from './PhotoContributionDialog'

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

      expect(screen.getByText('タイトル *')).toBeInTheDocument()
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

      // 複数のカテゴリを選択
      const landscapeCheckbox = screen.getByRole('checkbox', { name: /風景/ })
      const cityCheckbox = screen.getByRole('checkbox', { name: /街並み/ })

      await user.click(landscapeCheckbox)
      await user.click(cityCheckbox)

      expect(landscapeCheckbox).toBeChecked()
      expect(cityCheckbox).toBeChecked()
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

    it('submit button is disabled when title is empty', async () => {
      const user = userEvent.setup()
      render(<PhotoContributionDialog {...defaultProps} />)

      // 写真を選択
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // カテゴリを選択
      const checkbox = screen.getByRole('checkbox', { name: /風景/ })
      await user.click(checkbox)

      // タイトルが空の状態
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
      render(<PhotoContributionDialog {...defaultProps} />)

      // 全ての必須項目を入力
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      const titleInput = screen.getByPlaceholderText(/夕暮れの東京タワー/)
      await user.type(titleInput, 'テスト写真')

      const checkbox = screen.getByRole('checkbox', { name: /風景/ })
      await user.click(checkbox)

      // 位置情報が設定されていることを確認
      await waitFor(() => {
        expect(screen.getByText(/位置が設定されました/)).toBeInTheDocument()
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
})
