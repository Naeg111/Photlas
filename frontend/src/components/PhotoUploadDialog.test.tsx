import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import PhotoUploadDialog from './PhotoUploadDialog'
import heic2any from 'heic2any'

/**
 * Issue#7: 写真投稿フォーム (UI) - PhotoUploadDialogコンポーネント テスト
 * Issue#9: 写真アップロード処理 (API + Frontend) - 追加テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件 (Issue#7):
 * - 投稿用ダイアログコンポーネント
 * - タイトル入力欄、写真プレビューエリア、位置設定用地図、カテゴリ選択、投稿ボタン
 * - 初期状態: 全て空/未選択、投稿ボタンはdisabled
 * - 写真プレビュー: ファイル選択→プレビュー表示（横幅90%、高さは横幅の2/3）
 * - カテゴリ選択: 2列グリッド表示
 * - リアルタイムフィードバック: 文字数カウンター（2〜20文字）
 * - 投稿ボタンの活性化: 全ての必須項目が有効な場合のみ
 * - バリデーション: 必須項目のエラーを箇条書きで表示
 *
 * アップロード処理要件 (Issue#9):
 * - HEIC形式の写真選択時、JPEG形式に自動変換
 * - 変換処理中のローディング表示
 * - 投稿時に署名付きURL取得APIを呼び出し
 * - 署名付きURLを使用してS3に直接アップロード
 * - アップロード失敗時のエラー表示
 */

// ========================================
// テストデータ定数
// ========================================

const TEST_DATA = {
  // ユーザー情報
  USER: {
    id: 'user123',
  },

  // タイトル
  TITLE: {
    VALID: 'テスト投稿',
    SHORT: 'あ',  // 1文字（2文字未満）
    LONG: 'あいうえおかきくけこさしすせそたちつてとな',  // 21文字（20文字超過）
    LONG_VALID: '東京タワーの夜景写真です',  // 12文字
  },

  // カテゴリ
  CATEGORIES: ['風景', '建築', 'ストリート', 'ポートレート', '乗り物'],

  // 位置情報
  LOCATION: {
    TOKYO: { lat: 35.6762, lng: 139.6503 },
  },

  // ファイル
  FILE: {
    JPEG: { name: 'test.jpg', type: 'image/jpeg', content: 'test' },
    PNG: { name: 'test.png', type: 'image/png', content: 'test' },
    HEIC: { name: 'test.heic', type: 'image/heic', content: 'heic-data' },
    LARGE: { name: 'test.jpg', type: 'image/jpeg', content: 'test-image-data' },
  },

  // プレビューURL
  PREVIEW_URL: {
    JPEG: 'data:image/jpeg;base64,test',
    CONVERTED: 'data:image/jpeg;base64,converted',
  },

  // エラーメッセージ
  ERROR_MESSAGES: {
    TITLE_REQUIRED: 'タイトルを入力してください',
    TITLE_LENGTH: 'タイトルは2文字以上20文字以内で入力してください',
    PHOTO_REQUIRED: '写真を選択してください',
    LOCATION_REQUIRED: '撮影位置を設定してください',
    CATEGORY_REQUIRED: 'カテゴリを選択してください',
    HEIC_CONVERSION_ERROR: '画像の変換に失敗しました',
    UPLOAD_ERROR: '時間をおいて再度お試しください',
  },

  // API レスポンス
  API_RESPONSE: {
    UPLOAD_URL: {
      uploadUrl: 'https://s3.amazonaws.com/test-bucket/uploads/user123/photo123.jpg?signature=abc',
      objectKey: 'uploads/user123/photo123.jpg',
    },
    SUCCESS: { ok: true },
    ERROR: { ok: false },
  },
} as const

// ========================================
// ヘルパー関数
// ========================================

/**
 * モックファイルを作成
 */
const createMockFile = (name: string, type: string, content: string): File => {
  return new File([content], name, { type })
}

/**
 * FileReaderのモックを作成
 */
const createMockFileReader = (result: string) => {
  return {
    readAsDataURL: vi.fn(function(this: any) {
      if (this.onload) {
        this.onload({ target: { result } })
      }
    }),
    onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
    result
  }
}

/**
 * FileReaderのモックを設定
 */
const setupFileReaderMock = (result: string) => {
  const mockFileReader = createMockFileReader(result)
  vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockFileReader as any)
  return mockFileReader
}

/**
 * PhotoUploadDialogをレンダリング
 */
const renderPhotoUploadDialog = (props?: {
  open?: boolean
  onClose?: () => void
  onSubmit?: (data: any) => void
}) => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
  }

  const finalProps = { ...defaultProps, ...props }

  return {
    ...render(<PhotoUploadDialog {...finalProps} />),
    props: finalProps,
  }
}

/**
 * 写真をアップロード
 */
const uploadPhoto = async (fileData: { name: string; type: string; content: string }, previewUrl: string) => {
  const file = createMockFile(fileData.name, fileData.type, fileData.content)
  const mockFileReader = setupFileReaderMock(previewUrl)

  const fileInput = screen.getByTestId('photo-file-input')

  Object.defineProperty(fileInput, 'files', {
    value: [file],
    writable: false,
    configurable: true,
  })

  fireEvent.change(fileInput)

  if (mockFileReader.onload) {
    mockFileReader.onload.call(mockFileReader as any, {} as ProgressEvent<FileReader>)
  }

  return file
}

/**
 * フォームに入力（写真アップロード、タイトル入力、カテゴリ選択、位置設定）
 */
const fillPhotoUploadForm = async (options?: {
  title?: string
  fileData?: { name: string; type: string; content: string }
  previewUrl?: string
  category?: string
  skipPhoto?: boolean
  skipCategory?: boolean
  skipLocation?: boolean
}) => {
  const {
    title = TEST_DATA.TITLE.VALID,
    fileData = TEST_DATA.FILE.JPEG,
    previewUrl = TEST_DATA.PREVIEW_URL.JPEG,
    category = TEST_DATA.CATEGORIES[0],
    skipPhoto = false,
    skipCategory = false,
    skipLocation = false,
  } = options || {}

  // タイトル入力
  const titleInput = screen.getByLabelText('タイトル')
  fireEvent.change(titleInput, { target: { value: title } })

  // 写真アップロード
  let file: File | null = null
  if (!skipPhoto) {
    file = await uploadPhoto(fileData, previewUrl)
  }

  // カテゴリ選択
  if (!skipCategory) {
    const categoryCheckbox = screen.getByLabelText(category)
    fireEvent.click(categoryCheckbox)
  }

  // 位置設定
  if (!skipLocation) {
    const locationButton = screen.getByRole('button', { name: /位置を設定/ })
    fireEvent.click(locationButton)
  }

  return { file }
}

/**
 * 成功時のアップロードモックを設定
 */
const setupSuccessfulUpload = () => {
  const mockFetch = vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => TEST_DATA.API_RESPONSE.UPLOAD_URL
    })
    .mockResolvedValueOnce({
      ok: true
    })

  globalThis.fetch = mockFetch as any

  return mockFetch
}

/**
 * 失敗時のアップロードモックを設定（署名付きURL取得失敗）
 */
const setupFailedUploadUrlFetch = () => {
  const mockFetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    status: 500
  })

  globalThis.fetch = mockFetch as any

  return mockFetch
}

/**
 * 失敗時のアップロードモックを設定（S3アップロード失敗）
 */
const setupFailedS3Upload = () => {
  const mockFetch = vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => TEST_DATA.API_RESPONSE.UPLOAD_URL
    })
    .mockResolvedValueOnce({
      ok: false,
      status: 403
    })

  globalThis.fetch = mockFetch as any

  return mockFetch
}

/**
 * HEIC変換モックを設定
 */
const setupHeicConversionMock = (shouldSucceed: boolean = true, delay: number = 0) => {
  if (shouldSucceed) {
    if (delay > 0) {
      vi.mocked(heic2any).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(new Blob(['jpeg-data'], { type: 'image/jpeg' }))
          }, delay)
        })
      })
    } else {
      vi.mocked(heic2any).mockResolvedValue(new Blob(['jpeg-data'], { type: 'image/jpeg' }))
    }
  } else {
    vi.mocked(heic2any).mockRejectedValue(new Error('Conversion failed'))
  }
}

// ========================================
// テストスイート
// ========================================

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
      renderPhotoUploadDialog()

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('写真を投稿')).toBeInTheDocument()
    })

    it('does not render dialog when open prop is false', () => {
      renderPhotoUploadDialog({ open: false })

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders title input field', () => {
      renderPhotoUploadDialog()

      expect(screen.getByLabelText('タイトル')).toBeInTheDocument()
      expect(screen.getByLabelText('タイトル')).toHaveAttribute('type', 'text')
    })

    it('renders photo preview area', () => {
      renderPhotoUploadDialog()

      expect(screen.getByTestId('photo-preview-area')).toBeInTheDocument()
    })

    it('renders location selection area', () => {
      renderPhotoUploadDialog()

      expect(screen.getByTestId('location-selection-area')).toBeInTheDocument()
    })

    it('renders category selection checkboxes', () => {
      renderPhotoUploadDialog()

      expect(screen.getByTestId('category-selection')).toBeInTheDocument()

      // 5つのカテゴリが存在することを確認
      TEST_DATA.CATEGORIES.forEach(category => {
        expect(screen.getByLabelText(category)).toBeInTheDocument()
        expect(screen.getByLabelText(category)).toHaveAttribute('type', 'checkbox')
      })
    })

    it('displays category checkboxes in 2-column grid layout', () => {
      renderPhotoUploadDialog()

      const categoryContainer = screen.getByTestId('category-selection')
      expect(categoryContainer).toHaveClass('grid')
      expect(categoryContainer).toHaveClass('grid-cols-2')
    })

    it('renders submit button', () => {
      renderPhotoUploadDialog()

      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
    })

    it('renders UI elements in correct order (top to bottom)', () => {
      renderPhotoUploadDialog()

      const dialog = screen.getByRole('dialog')
      const elements = dialog.querySelectorAll('[data-testid], input[type="text"], button')

      // タイトル入力欄が最初に来ることを確認
      expect(elements[0]).toHaveAttribute('type', 'text')
    })
  })

  describe('Initial State - 初期状態', () => {
    it('has empty title input initially', () => {
      renderPhotoUploadDialog()

      expect(screen.getByLabelText('タイトル')).toHaveValue('')
    })

    it('shows photo selection placeholder initially', () => {
      renderPhotoUploadDialog()

      expect(screen.getByRole('button', { name: '写真を選択' })).toBeInTheDocument()
      expect(screen.queryByAltText('写真プレビュー')).not.toBeInTheDocument()
    })

    it('shows default map view (Japan) initially', () => {
      renderPhotoUploadDialog()

      // 位置設定が未設定であることを確認
      expect(screen.getByText(/地図で撮影場所を選んでください/)).toBeInTheDocument()
    })

    it('has all categories unchecked initially', () => {
      renderPhotoUploadDialog()

      TEST_DATA.CATEGORIES.forEach(category => {
        expect(screen.getByLabelText(category)).not.toBeChecked()
      })
    })

    it('has submit button disabled initially', () => {
      renderPhotoUploadDialog()

      expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled()
    })
  })

  describe('Title Input - タイトル入力とリアルタイムフィードバック', () => {
    it('updates title value when user types', () => {
      renderPhotoUploadDialog()

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.VALID } })

      expect(titleInput).toHaveValue(TEST_DATA.TITLE.VALID)
    })

    it('displays character count in real-time', () => {
      renderPhotoUploadDialog()

      const titleInput = screen.getByLabelText('タイトル')

      // 初期状態は 0 / 20
      expect(screen.getByText('0 / 20')).toBeInTheDocument()

      // 5文字入力
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.VALID } })
      expect(screen.getByText('5 / 20')).toBeInTheDocument()

      // 12文字入力
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.LONG_VALID } })
      expect(screen.getByText('12 / 20')).toBeInTheDocument()
    })

    it('shows character count in warning color when under 2 characters', () => {
      renderPhotoUploadDialog()

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.SHORT } })

      const charCounter = screen.getByText('1 / 20')
      expect(charCounter).toHaveClass('text-red-500')
    })

    it('shows character count in warning color when over 20 characters', () => {
      renderPhotoUploadDialog()

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.LONG } })

      const charCounter = screen.getByText('21 / 20')
      expect(charCounter).toHaveClass('text-red-500')
    })

    it('shows character count in normal color when within valid range (2-20)', () => {
      renderPhotoUploadDialog()

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.VALID } })

      const charCounter = screen.getByText('5 / 20')
      expect(charCounter).not.toHaveClass('text-red-500')
    })
  })

  describe('Photo Preview - 写真選択とプレビュー', () => {
    it('opens file dialog when photo selection button is clicked', () => {
      renderPhotoUploadDialog()

      const selectButton = screen.getByRole('button', { name: '写真を選択' })
      const fileInput = screen.getByTestId('photo-file-input')

      const clickSpy = vi.spyOn(fileInput, 'click')
      fireEvent.click(selectButton)

      expect(clickSpy).toHaveBeenCalled()
    })

    it('accepts JPEG, PNG, and HEIC files', () => {
      renderPhotoUploadDialog()

      const fileInput = screen.getByTestId('photo-file-input')
      expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/heic')
    })

    it('displays photo preview after selecting valid image file', async () => {
      renderPhotoUploadDialog()

      await uploadPhoto(TEST_DATA.FILE.JPEG, TEST_DATA.PREVIEW_URL.JPEG)

      await waitFor(() => {
        const preview = screen.getByAltText('写真プレビュー')
        expect(preview).toBeInTheDocument()
        expect(preview).toHaveAttribute('src', TEST_DATA.PREVIEW_URL.JPEG)
      })
    })

    it('sets preview area width to 90% of dialog width', async () => {
      renderPhotoUploadDialog()

      await uploadPhoto(TEST_DATA.FILE.JPEG, TEST_DATA.PREVIEW_URL.JPEG)

      await waitFor(() => {
        const previewArea = screen.getByTestId('photo-preview-area')
        expect(previewArea).toHaveClass('w-[90%]')
      })
    })

    it('sets preview area height to 2/3 of its width', async () => {
      renderPhotoUploadDialog()

      await uploadPhoto(TEST_DATA.FILE.JPEG, TEST_DATA.PREVIEW_URL.JPEG)

      await waitFor(() => {
        const previewArea = screen.getByTestId('photo-preview-area')
        // aspect-[3/2] means width:height = 3:2, which is height = 2/3 * width
        expect(previewArea).toHaveClass('aspect-[3/2]')
      })
    })

    it('does not upload file until submit button is clicked', async () => {
      const { props } = renderPhotoUploadDialog()

      await uploadPhoto(TEST_DATA.FILE.JPEG, TEST_DATA.PREVIEW_URL.JPEG)

      // onSubmit はまだ呼ばれていないはず
      expect(props.onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Category Selection - カテゴリ選択', () => {
    it('toggles category checkbox when clicked', () => {
      renderPhotoUploadDialog()

      const landscapeCheckbox = screen.getByLabelText(TEST_DATA.CATEGORIES[0])

      expect(landscapeCheckbox).not.toBeChecked()

      fireEvent.click(landscapeCheckbox)
      expect(landscapeCheckbox).toBeChecked()

      fireEvent.click(landscapeCheckbox)
      expect(landscapeCheckbox).not.toBeChecked()
    })

    it('allows multiple category selection', () => {
      renderPhotoUploadDialog()

      const landscapeCheckbox = screen.getByLabelText(TEST_DATA.CATEGORIES[0])
      const architectureCheckbox = screen.getByLabelText(TEST_DATA.CATEGORIES[1])

      fireEvent.click(landscapeCheckbox)
      fireEvent.click(architectureCheckbox)

      expect(landscapeCheckbox).toBeChecked()
      expect(architectureCheckbox).toBeChecked()
    })
  })

  describe('Location Selection - 位置設定', () => {
    it('renders location selection button/area', () => {
      renderPhotoUploadDialog()

      // 位置設定用のボタンまたはエリアが存在することを確認
      // 地図ピッカー自体はIssue#8で実装されるため、ここでは呼び出すボタンのみ
      expect(screen.getByRole('button', { name: /位置を設定/ })).toBeInTheDocument()
    })

    it('shows location not set message initially', () => {
      renderPhotoUploadDialog()

      expect(screen.getByText(/地図で撮影場所を選んでください/)).toBeInTheDocument()
    })
  })

  describe('Submit Button Activation - 投稿ボタンの活性化', () => {
    it('keeps submit button disabled when title is empty', () => {
      renderPhotoUploadDialog()

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('keeps submit button disabled when title is less than 2 characters', () => {
      renderPhotoUploadDialog()

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.SHORT } })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('keeps submit button disabled when title is more than 20 characters', () => {
      renderPhotoUploadDialog()

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.LONG } })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('keeps submit button disabled when photo is not selected', () => {
      renderPhotoUploadDialog()

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.VALID } })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('keeps submit button disabled when location is not set', () => {
      renderPhotoUploadDialog()

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.VALID } })

      // 写真を選択（簡略化のためdisabledチェックのみ）
      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('keeps submit button disabled when no category is selected', () => {
      renderPhotoUploadDialog()

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.VALID } })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      expect(submitButton).toBeDisabled()
    })

    it('enables submit button when all required fields are valid', async () => {
      renderPhotoUploadDialog()

      await fillPhotoUploadForm()

      // すべての条件が満たされたので、投稿ボタンが有効になるはず
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '投稿する' })
        expect(submitButton).not.toBeDisabled()
      })
    })
  })

  describe('Client-side Validation - バリデーションとエラー表示', () => {
    it('prevents form submission when required fields are not filled', () => {
      const { props } = renderPhotoUploadDialog()

      const submitButton = screen.getByRole('button', { name: '投稿する' })

      // ボタンがdisabledなので、クリックしても何も起こらない
      expect(submitButton).toBeDisabled()

      fireEvent.click(submitButton)
      expect(props.onSubmit).not.toHaveBeenCalled()
    })

    it('displays validation errors in red at the top of form when trying to submit with missing fields', async () => {
      // NOTE: このテストはボタンがdisabledでない状態での強制送信を想定
      // 実際のUIではdisabledだが、プログラマティックな送信も考慮
      renderPhotoUploadDialog()

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
      renderPhotoUploadDialog()

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      submitButton.removeAttribute('disabled')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(TEST_DATA.ERROR_MESSAGES.TITLE_REQUIRED)).toBeInTheDocument()
        expect(screen.getByText(TEST_DATA.ERROR_MESSAGES.PHOTO_REQUIRED)).toBeInTheDocument()
        expect(screen.getByText(TEST_DATA.ERROR_MESSAGES.LOCATION_REQUIRED)).toBeInTheDocument()
        expect(screen.getByText(TEST_DATA.ERROR_MESSAGES.CATEGORY_REQUIRED)).toBeInTheDocument()
      })

      // 箇条書き形式（ul/li）で表示されることを確認
      const errorList = screen.getByTestId('validation-errors')
      expect(errorList.tagName).toBe('UL')
    })

    it('shows specific error for title length validation', async () => {
      renderPhotoUploadDialog()

      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.SHORT } })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      submitButton.removeAttribute('disabled')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(TEST_DATA.ERROR_MESSAGES.TITLE_LENGTH)).toBeInTheDocument()
      })
    })

    it('clears validation errors when all fields become valid', async () => {
      renderPhotoUploadDialog()

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      submitButton.removeAttribute('disabled')
      fireEvent.click(submitButton)

      // エラーが表示される
      await waitFor(() => {
        expect(screen.getByTestId('validation-errors')).toBeInTheDocument()
      })

      // タイトルとカテゴリを入力
      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.VALID } })

      const landscapeCheckbox = screen.getByLabelText(TEST_DATA.CATEGORIES[0])
      fireEvent.click(landscapeCheckbox)

      // エラーが消える（または減る）
      await waitFor(() => {
        expect(screen.queryByText(TEST_DATA.ERROR_MESSAGES.TITLE_REQUIRED)).not.toBeInTheDocument()
        expect(screen.queryByText(TEST_DATA.ERROR_MESSAGES.CATEGORY_REQUIRED)).not.toBeInTheDocument()
      })
    })
  })

  describe('Modal Interaction - モーダルのインタラクション', () => {
    it('calls onClose when close button is clicked', () => {
      const { props } = renderPhotoUploadDialog()

      const closeButton = screen.getByLabelText('閉じる')
      fireEvent.click(closeButton)

      expect(props.onClose).toHaveBeenCalled()
    })

    it('resets form state when modal is closed and reopened', () => {
      const { rerender, props } = renderPhotoUploadDialog()

      // フォームに入力
      const titleInput = screen.getByLabelText('タイトル')
      fireEvent.change(titleInput, { target: { value: TEST_DATA.TITLE.VALID } })

      const landscapeCheckbox = screen.getByLabelText(TEST_DATA.CATEGORIES[0])
      fireEvent.click(landscapeCheckbox)

      // モーダルを閉じて再度開く
      rerender(<PhotoUploadDialog open={false} onClose={props.onClose} onSubmit={props.onSubmit} />)
      rerender(<PhotoUploadDialog open={true} onClose={props.onClose} onSubmit={props.onSubmit} />)

      // フォームがリセットされていることを確認
      expect(screen.getByLabelText('タイトル')).toHaveValue('')
      expect(screen.getByLabelText(TEST_DATA.CATEGORIES[0])).not.toBeChecked()
    })

    it('calls onSubmit with form data when submit button is clicked with valid data', async () => {
      setupSuccessfulUpload()

      const { props } = renderPhotoUploadDialog()

      const { file } = await fillPhotoUploadForm()

      // 投稿ボタンがアクティブになるまで待つ
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '投稿する' })
        expect(submitButton).not.toBeDisabled()
      })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      fireEvent.click(submitButton)

      // onSubmitが呼ばれたことを確認（Issue#9でobjectKeyが追加された）
      await waitFor(() => {
        expect(props.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: TEST_DATA.TITLE.VALID,
            photo: file,
            categories: [TEST_DATA.CATEGORIES[0]],
            objectKey: TEST_DATA.API_RESPONSE.UPLOAD_URL.objectKey
          })
        )
      })
    })
  })

  /**
   * Issue#9: 写真アップロード処理 (API + Frontend)
   * TDD Red段階: 実装前のテストケース定義
   */

  describe('HEIC to JPEG Conversion - HEIC→JPEG変換処理', () => {
    it('detects HEIC file format when selected', async () => {
      setupHeicConversionMock(true)

      renderPhotoUploadDialog()

      const mockFileReader = setupFileReaderMock(TEST_DATA.PREVIEW_URL.CONVERTED)

      const fileInput = screen.getByTestId('photo-file-input')
      const heicFile = createMockFile(TEST_DATA.FILE.HEIC.name, TEST_DATA.FILE.HEIC.type, TEST_DATA.FILE.HEIC.content)

      Object.defineProperty(fileInput, 'files', {
        value: [heicFile],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      // HEIC検出フラグまたはローディング状態が設定されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('heic-conversion-status')).toBeInTheDocument()
      })
    })

    it('shows loading indicator during HEIC to JPEG conversion', async () => {
      setupHeicConversionMock(true, 100)

      renderPhotoUploadDialog()

      const fileInput = screen.getByTestId('photo-file-input')
      const heicFile = createMockFile(TEST_DATA.FILE.HEIC.name, TEST_DATA.FILE.HEIC.type, TEST_DATA.FILE.HEIC.content)

      Object.defineProperty(fileInput, 'files', {
        value: [heicFile],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      // ローディング表示があることを確認
      await waitFor(() => {
        expect(screen.getByText(/変換中/)).toBeInTheDocument()
      })
    })

    it('converts HEIC file to JPEG format', async () => {
      setupHeicConversionMock(true)
      setupFileReaderMock(TEST_DATA.PREVIEW_URL.CONVERTED)

      renderPhotoUploadDialog()

      const fileInput = screen.getByTestId('photo-file-input')
      const heicFile = createMockFile(TEST_DATA.FILE.HEIC.name, TEST_DATA.FILE.HEIC.type, TEST_DATA.FILE.HEIC.content)

      Object.defineProperty(fileInput, 'files', {
        value: [heicFile],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      // heic2anyが呼ばれることを確認
      await waitFor(() => {
        expect(heic2any).toHaveBeenCalledWith(
          expect.objectContaining({
            blob: heicFile,
            toType: 'image/jpeg'
          })
        )
      })
    })

    it('hides loading indicator after conversion completes', async () => {
      setupHeicConversionMock(true)
      setupFileReaderMock(TEST_DATA.PREVIEW_URL.CONVERTED)

      renderPhotoUploadDialog()

      const fileInput = screen.getByTestId('photo-file-input')
      const heicFile = createMockFile(TEST_DATA.FILE.HEIC.name, TEST_DATA.FILE.HEIC.type, TEST_DATA.FILE.HEIC.content)

      Object.defineProperty(fileInput, 'files', {
        value: [heicFile],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      // ローディングが最初に表示される
      await waitFor(() => {
        expect(screen.getByText(/変換中/)).toBeInTheDocument()
      })

      // ローディングが消える
      await waitFor(() => {
        expect(screen.queryByText(/変換中/)).not.toBeInTheDocument()
      })
    })

    it('displays error message when HEIC conversion fails', async () => {
      setupHeicConversionMock(false)

      renderPhotoUploadDialog()

      const fileInput = screen.getByTestId('photo-file-input')
      const heicFile = createMockFile(TEST_DATA.FILE.HEIC.name, TEST_DATA.FILE.HEIC.type, TEST_DATA.FILE.HEIC.content)

      Object.defineProperty(fileInput, 'files', {
        value: [heicFile],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      // エラーメッセージが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText(TEST_DATA.ERROR_MESSAGES.HEIC_CONVERSION_ERROR)).toBeInTheDocument()
      })
    })

    it('does not trigger conversion for non-HEIC files', () => {
      setupFileReaderMock(TEST_DATA.PREVIEW_URL.JPEG)

      renderPhotoUploadDialog()

      const fileInput = screen.getByTestId('photo-file-input')
      const jpegFile = createMockFile(TEST_DATA.FILE.JPEG.name, TEST_DATA.FILE.JPEG.type, TEST_DATA.FILE.JPEG.content)

      Object.defineProperty(fileInput, 'files', {
        value: [jpegFile],
        writable: false,
        configurable: true,
      })

      fireEvent.change(fileInput)

      // heic2anyが呼ばれないことを確認
      expect(heic2any).not.toHaveBeenCalled()
    })
  })

  describe('Photo Upload Process - 写真アップロード処理', () => {
    const mockFetch = vi.fn()

    beforeEach(() => {
      globalThis.fetch = mockFetch as any
      vi.clearAllMocks()
    })

    it('requests pre-signed URL from API when submit button is clicked', async () => {
      const mockFetch = setupSuccessfulUpload()

      renderPhotoUploadDialog()

      await fillPhotoUploadForm()

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '投稿する' })
        expect(submitButton).not.toBeDisabled()
      })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      fireEvent.click(submitButton)

      // API呼び出しを確認
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/photos/upload-url',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            }),
            body: expect.stringContaining('image/jpeg')
          })
        )
      })
    })

    it('uploads photo to S3 using pre-signed URL', async () => {
      const mockFetch = setupSuccessfulUpload()

      renderPhotoUploadDialog()

      const { file } = await fillPhotoUploadForm()

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '投稿する' })
        expect(submitButton).not.toBeDisabled()
      })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      fireEvent.click(submitButton)

      // S3へのPUTリクエストを確認
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          TEST_DATA.API_RESPONSE.UPLOAD_URL.uploadUrl,
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              'Content-Type': 'image/jpeg'
            }),
            body: file
          })
        )
      })
    })

    it('shows loading state during upload', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => TEST_DATA.API_RESPONSE.UPLOAD_URL
        })
        .mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({ ok: true })
            }, 100)
          })
        })

      globalThis.fetch = mockFetch as any

      renderPhotoUploadDialog()

      await fillPhotoUploadForm()

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '投稿する' })
        expect(submitButton).not.toBeDisabled()
      })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      fireEvent.click(submitButton)

      // アップロード中の表示を確認
      await waitFor(() => {
        expect(screen.getByText(/アップロード中/)).toBeInTheDocument()
      })
    })

    it('displays error message when pre-signed URL request fails', async () => {
      setupFailedUploadUrlFetch()

      renderPhotoUploadDialog()

      await fillPhotoUploadForm()

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '投稿する' })
        expect(submitButton).not.toBeDisabled()
      })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      fireEvent.click(submitButton)

      // エラーメッセージの確認
      await waitFor(() => {
        expect(screen.getByText(TEST_DATA.ERROR_MESSAGES.UPLOAD_ERROR)).toBeInTheDocument()
      })
    })

    it('displays error message when S3 upload fails', async () => {
      setupFailedS3Upload()

      renderPhotoUploadDialog()

      await fillPhotoUploadForm()

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '投稿する' })
        expect(submitButton).not.toBeDisabled()
      })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      fireEvent.click(submitButton)

      // エラーメッセージの確認
      await waitFor(() => {
        expect(screen.getByText(TEST_DATA.ERROR_MESSAGES.UPLOAD_ERROR)).toBeInTheDocument()
      })
    })

    it('passes object key to onSubmit callback after successful upload', async () => {
      setupSuccessfulUpload()

      const { props } = renderPhotoUploadDialog()

      const { file } = await fillPhotoUploadForm()

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '投稿する' })
        expect(submitButton).not.toBeDisabled()
      })

      const submitButton = screen.getByRole('button', { name: '投稿する' })
      fireEvent.click(submitButton)

      // onSubmitにobjectKeyが渡されることを確認
      await waitFor(() => {
        expect(props.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            objectKey: TEST_DATA.API_RESPONSE.UPLOAD_URL.objectKey
          })
        )
      })
    })
  })
})
