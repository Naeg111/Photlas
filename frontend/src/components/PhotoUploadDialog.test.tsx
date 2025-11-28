import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import PhotoUploadDialog from './PhotoUploadDialog'

/**
 * Issue#7: 写真投稿フォーム (UI) - PhotoUploadDialogコンポーネント テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - 投稿用ダイアログコンポーネント
 * - タイトル入力欄、写真プレビューエリア、位置設定用地図、カテゴリ選択、投稿ボタン
 * - 初期状態: 全て空/未選択、投稿ボタンはdisabled
 * - 写真プレビュー: ファイル選択→プレビュー表示（横幅90%、高さは横幅の2/3）
 * - カテゴリ選択: 2列グリッド表示
 * - リアルタイムフィードバック: 文字数カウンター（2〜20文字）
 * - 投稿ボタンの活性化: 全ての必須項目が有効な場合のみ
 * - バリデーション: 必須項目のエラーを箇条書きで表示
 */

describe('PhotoUploadDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('UI Elements - ダイアログとレイアウト', () => {
    it('renders dialog when open prop is true', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('写真を投稿')).toBeInTheDocument()
    })

    it('does not render dialog when open prop is false', () => {
      render(<PhotoUploadDialog open={false} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders title input field', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      expect(screen.getByLabelText('タイトル')).toBeInTheDocument()
      expect(screen.getByLabelText('タイトル')).toHaveAttribute('type', 'text')
    })

    it('renders photo preview area', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      expect(screen.getByTestId('photo-preview-area')).toBeInTheDocument()
    })

    it('renders location selection area', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      expect(screen.getByTestId('location-selection-area')).toBeInTheDocument()
    })

    it('renders category selection checkboxes', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      expect(screen.getByTestId('category-selection')).toBeInTheDocument()

      // 5つのカテゴリが存在することを確認
      const categories = ['風景', '建築', 'ストリート', 'ポートレート', '乗り物']
      categories.forEach(category => {
        expect(screen.getByLabelText(category)).toBeInTheDocument()
        expect(screen.getByLabelText(category)).toHaveAttribute('type', 'checkbox')
      })
    })

    it('displays category checkboxes in 2-column grid layout', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const categoryContainer = screen.getByTestId('category-selection')
      expect(categoryContainer).toHaveClass('grid')
      expect(categoryContainer).toHaveClass('grid-cols-2')
    })

    it('renders submit button', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
    })

    it('renders UI elements in correct order (top to bottom)', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const dialog = screen.getByRole('dialog')
      const elements = dialog.querySelectorAll('[data-testid], input[type="text"], button')

      // タイトル入力欄が最初に来ることを確認
      expect(elements[0]).toHaveAttribute('type', 'text')
    })
  })

  describe('Initial State - 初期状態', () => {
    it('has empty title input initially', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      expect(screen.getByLabelText('タイトル')).toHaveValue('')
    })

    it('shows photo selection placeholder initially', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      expect(screen.getByRole('button', { name: '写真を選択' })).toBeInTheDocument()
      expect(screen.queryByAltText('写真プレビュー')).not.toBeInTheDocument()
    })

    it('shows default map view (Japan) initially', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      // 位置設定が未設定であることを確認
      expect(screen.getByText(/地図で撮影場所を選んでください/)).toBeInTheDocument()
    })

    it('has all categories unchecked initially', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const categories = ['風景', '建築', 'ストリート', 'ポートレート', '乗り物']
      categories.forEach(category => {
        expect(screen.getByLabelText(category)).not.toBeChecked()
      })
    })

    it('has submit button disabled initially', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled()
    })
  })

  describe('Title Input - タイトル入力とリアルタイムフィードバック', () => {
    it('updates title value when user types', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'テスト投稿' } })

      expect(titleInput).toHaveValue('テスト投稿')
    })

    it('displays character count in real-time', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const titleInput = screen.getByLabelText('タイトル')

      // 初期状態は 0 / 20
      expect(screen.getByText('0 / 20')).toBeInTheDocument()

      // 5文字入力
      fireEvent.change(titleInput, { target: { value: 'テスト投稿' } })
      expect(screen.getByText('5 / 20')).toBeInTheDocument()

      // 15文字入力
      fireEvent.change(titleInput, { target: { value: '東京タワーの夜景写真です' } })
      expect(screen.getByText('12 / 20')).toBeInTheDocument()
    })

    it('shows character count in warning color when under 2 characters', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'あ' } })

      const charCounter = screen.getByText('1 / 20')
      expect(charCounter).toHaveClass('text-red-500')
    })

    it('shows character count in warning color when over 20 characters', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'あいうえおかきくけこさしすせそたちつてとな' } })

      const charCounter = screen.getByText('21 / 20')
      expect(charCounter).toHaveClass('text-red-500')
    })

    it('shows character count in normal color when within valid range (2-20)', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'テスト投稿' } })

      const charCounter = screen.getByText('5 / 20')
      expect(charCounter).not.toHaveClass('text-red-500')
    })
  })

  describe('Photo Preview - 写真選択とプレビュー', () => {
    it('opens file dialog when photo selection button is clicked', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const selectButton = screen.getByRole('button', { name: '写真を選択' })
      const fileInput = screen.getByTestId('photo-file-input')

      const clickSpy = vi.spyOn(fileInput, 'click')
      fireEvent.click(selectButton)

      expect(clickSpy).toHaveBeenCalled()
    })

    it('accepts JPEG, PNG, and HEIC files', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const fileInput = screen.getByTestId('photo-file-input')
      expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/heic')
    })

    it('displays photo preview after selecting valid image file', async () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const fileInput = screen.getByTestId('photo-file-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      // FileReader をモック
      const mockFileReader = {
        readAsDataURL: vi.fn(function(this: any) {
          // readAsDataURL が呼ばれたら即座に onload を実行
          if (this.onload) {
            this.onload({ target: { result: 'data:image/jpeg;base64,test' } })
          }
        }),
        onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/jpeg;base64,test'
      }

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader as any)

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        const preview = screen.getByAltText('写真プレビュー')
        expect(preview).toBeInTheDocument()
        expect(preview).toHaveAttribute('src', 'data:image/jpeg;base64,test')
      })
    })

    it('sets preview area width to 90% of dialog width', async () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const fileInput = screen.getByTestId('photo-file-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/jpeg;base64,test'
      }

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader as any)

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader as any, {} as ProgressEvent<FileReader>)
      }

      await waitFor(() => {
        const previewArea = screen.getByTestId('photo-preview-area')
        expect(previewArea).toHaveClass('w-[90%]')
      })
    })

    it('sets preview area height to 2/3 of its width', async () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const fileInput = screen.getByTestId('photo-file-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/jpeg;base64,test'
      }

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader as any)

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader as any, {} as ProgressEvent<FileReader>)
      }

      await waitFor(() => {
        const previewArea = screen.getByTestId('photo-preview-area')
        // aspect-[3/2] means width:height = 3:2, which is height = 2/3 * width
        expect(previewArea).toHaveClass('aspect-[3/2]')
      })
    })

    it('does not upload file until submit button is clicked', async () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const fileInput = screen.getByTestId('photo-file-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      // onSubmit はまだ呼ばれていないはず
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Category Selection - カテゴリ選択', () => {
    it('toggles category checkbox when clicked', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const landscapeCheckbox = screen.getByLabelText('風景')

      expect(landscapeCheckbox).not.toBeChecked()

      fireEvent.click(landscapeCheckbox)
      expect(landscapeCheckbox).toBeChecked()

      fireEvent.click(landscapeCheckbox)
      expect(landscapeCheckbox).not.toBeChecked()
    })

    it('allows multiple category selection', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const landscapeCheckbox = screen.getByLabelText('風景')
      const architectureCheckbox = screen.getByLabelText('建築')

      fireEvent.click(landscapeCheckbox)
      fireEvent.click(architectureCheckbox)

      expect(landscapeCheckbox).toBeChecked()
      expect(architectureCheckbox).toBeChecked()
    })
  })

  describe('Location Selection - 位置設定', () => {
    it('renders location selection button/area', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      // 位置設定用のボタンまたはエリアが存在することを確認
      // 地図ピッカー自体はIssue#8で実装されるため、ここでは呼び出すボタンのみ
      expect(screen.getByRole('button', { name: /位置を設定/ })).toBeInTheDocument()
    })

    it('shows location not set message initially', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      expect(screen.getByText(/地図で撮影場所を選んでください/)).toBeInTheDocument()
    })
  })

  describe('Submit Button Activation - 投稿ボタンの活性化', () => {
    it('keeps submit button disabled when title is empty', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('keeps submit button disabled when title is less than 2 characters', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'あ' } })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('keeps submit button disabled when title is more than 20 characters', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'あいうえおかきくけこさしすせそたちつてとな' } })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('keeps submit button disabled when photo is not selected', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'テスト投稿' } })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('keeps submit button disabled when location is not set', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'テスト投稿' } })

      // 写真を選択（簡略化のためdisabledチェックのみ）
      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('keeps submit button disabled when no category is selected', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'テスト投稿' } })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('enables submit button when all required fields are valid', async () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      // 1. タイトル入力 (2-20文字)
      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'テスト投稿' } })

      // 2. 写真選択
      const fileInput = screen.getByTestId('photo-file-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/jpeg;base64,test'
      }

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader as any)

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader as any, {} as ProgressEvent<FileReader>)
      }

      // 3. 位置設定（モック - Issue#8で実装予定）
      const locationButton = screen.getByRole('button', { name: /位置を設定/ })
      fireEvent.click(locationButton)
      // 位置が設定されたことをシミュレート（実装では地図ピッカーから設定される）

      // 4. カテゴリ選択（少なくとも1つ）
      const landscapeCheckbox = screen.getByLabelText('風景')
      fireEvent.click(landscapeCheckbox)

      // すべての条件が満たされたので、投稿ボタンが有効になるはず
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '投稿する' })
        expect(submitButton).not.toBeDisabled()
      })
    })
  })

  describe('Client-side Validation - バリデーションとエラー表示', () => {
    it('prevents form submission when required fields are not filled', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const submitButton = screen.getByRole('button', { name: '投稿する' })

      // ボタンがdisabledなので、クリックしても何も起こらない
      expect(submitButton).toBeDisabled()

      fireEvent.click(submitButton)
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('displays validation errors in red at the top of form when trying to submit with missing fields', async () => {
      // NOTE: このテストはボタンがdisabledでない状態での強制送信を想定
      // 実際のUIではdisabledだが、プログラマティックな送信も考慮
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      // 投稿ボタンを強制的に有効化してクリック（テストのため）
      const submitButton = screen.getByRole('button', { name: '投稿する' })

      // disabled属性を一時的に解除してクリック
      submitButton.removeAttribute('disabled')
      fireEvent.click(submitButton)

      await waitFor(() => {
        const errorList = screen.getByTestId('validation-errors')
        expect(errorList).toBeInTheDocument()
        expect(errorList).toHaveClass('text-red-500')
      })
    })

    it('displays all validation errors as bullet points', async () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      submitButton.removeAttribute('disabled')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/タイトルを入力してください/)).toBeInTheDocument()
        expect(screen.getByText(/写真を選択してください/)).toBeInTheDocument()
        expect(screen.getByText(/位置を設定してください/)).toBeInTheDocument()
        expect(screen.getByText(/カテゴリを選択してください/)).toBeInTheDocument()
      })

      // 箇条書き形式（ul/li）で表示されることを確認
      const errorList = screen.getByTestId('validation-errors')
      expect(errorList.tagName).toBe('UL')
    })

    it('shows specific error for title length validation', async () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'あ' } }) // 1文字（2文字未満）

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      submitButton.removeAttribute('disabled')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/タイトルは2文字以上20文字以内で入力してください/)).toBeInTheDocument()
      })
    })

    it('clears validation errors when all fields become valid', async () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      submitButton.removeAttribute('disabled')
      fireEvent.click(submitButton)

      // エラーが表示される
      await waitFor(() => {
        expect(screen.getByTestId('validation-errors')).toBeInTheDocument()
      })

      // すべてのフィールドを入力
      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'テスト投稿' } })

      const landscapeCheckbox = screen.getByLabelText('風景')
      fireEvent.click(landscapeCheckbox)

      // エラーが消える（または減る）
      await waitFor(() => {
        expect(screen.queryByText(/タイトルを入力してください/)).not.toBeInTheDocument()
        expect(screen.queryByText(/カテゴリを選択してください/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Modal Interaction - モーダルのインタラクション', () => {
    it('calls onClose when close button is clicked', () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      const closeButton = screen.getByLabelText('閉じる')
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('resets form state when modal is closed and reopened', () => {
      const { rerender } = render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      // フォームに入力
      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'テスト投稿' } })

      const landscapeCheckbox = screen.getByLabelText('風景')
      fireEvent.click(landscapeCheckbox)

      // モーダルを閉じて再度開く
      rerender(<PhotoUploadDialog open={false} onClose={mockOnClose} onSubmit={mockOnSubmit} />)
      rerender(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      // フォームがリセットされていることを確認
      expect(screen.getByLabelText('タイトル')).toHaveValue('')
      expect(screen.getByLabelText('風景')).not.toBeChecked()
    })

    it('calls onSubmit with form data when submit button is clicked with valid data', async () => {
      render(<PhotoUploadDialog open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />)

      // すべての必須項目を入力
      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: 'テスト投稿' } })

      const fileInput = screen.getByTestId('photo-file-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/jpeg;base64,test'
      }

      vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader as any)

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader as any, {} as ProgressEvent<FileReader>)
      }

      const landscapeCheckbox = screen.getByLabelText('風景')
      fireEvent.click(landscapeCheckbox)

      const locationButton = screen.getByRole('button', { name: /位置を設定/ })
      fireEvent.click(locationButton)

      // 投稿ボタンがアクティブになるまで待つ
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '投稿する' })
        expect(submitButton).not.toBeDisabled()
      })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      fireEvent.click(submitButton)

      // onSubmitが呼ばれたことを確認
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'テスト投稿',
            photo: file,
            categories: ['風景'],
            // location: expect.any(Object) // Issue#8で実装
          })
        )
      })
    })
  })
})
