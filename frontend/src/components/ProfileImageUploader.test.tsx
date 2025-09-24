import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ProfileImageUploader from './ProfileImageUploader'

/**
 * ProfileImageUploader コンポーネントのテスト
 * Issue#2: ユーザー登録機能 (UI) - プロフィール画像アップローダー
 * 
 * TDD Red段階: 実装前のテストケース定義
 */
describe('ProfileImageUploader', () => {
  const mockOnImageSelect = vi.fn()

  beforeEach(() => {
    mockOnImageSelect.mockClear()
  })

  afterEach(() => {
    // 確実なDOMクリーンアップ
    cleanup()
    document.body.innerHTML = ''
    
    // FileReader モックをリセット
    globalThis.FileReader = FileReader
  })

  describe('Initial State', () => {
    it('renders image selection button', () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      expect(screen.getByRole('button', { name: '画像を選択' })).toBeInTheDocument()
    })

    it('does not show image preview initially', () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      expect(screen.queryByAltText('プロフィール画像プレビュー')).not.toBeInTheDocument()
    })

    it('includes hidden file input', () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      const fileInput = screen.getByTestId('image-file-input')
      expect(fileInput).toHaveAttribute('type', 'file')
      expect(fileInput).toHaveAttribute('accept', 'image/*')
      expect(fileInput).toHaveClass('hidden')
    })
  })

  describe('File Selection', () => {
    it('opens file dialog when button is clicked', () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      const button = screen.getByRole('button', { name: '画像を選択' })
      const fileInput = screen.getByTestId('image-file-input')
      
      const clickSpy = vi.spyOn(fileInput, 'click')
      fireEvent.click(button)
      
      expect(clickSpy).toHaveBeenCalled()
    })

    it('handles valid image file selection', async () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      const fileInput = screen.getByTestId('image-file-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
        configurable: true,
      })
      
      fireEvent.change(fileInput)
      
      await waitFor(() => {
        expect(mockOnImageSelect).toHaveBeenCalledWith(file)
      })
    })

    it('rejects non-image files', async () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      const fileInput = screen.getByTestId('image-file-input')
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
        configurable: true,
      })
      
      fireEvent.change(fileInput)
      
      await waitFor(() => {
        expect(screen.getByText('画像ファイルを選択してください')).toBeInTheDocument()
      })
      
      expect(mockOnImageSelect).not.toHaveBeenCalled()
    })

    it('rejects files larger than 5MB', async () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      const fileInput = screen.getByTestId('image-file-input')
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
      
      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false,
        configurable: true,
      })
      
      fireEvent.change(fileInput)
      
      await waitFor(() => {
        expect(screen.getByText('ファイルサイズは5MB以下にしてください')).toBeInTheDocument()
      })
      
      expect(mockOnImageSelect).not.toHaveBeenCalled()
    })
  })

  describe('Image Preview', () => {
    it('shows circular image preview after file selection', async () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      const fileInput = screen.getByTestId('image-file-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      // FileReaderのモック
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        result: 'data:image/jpeg;base64,test',
        onload: null as any
      }
      
      globalThis.FileReader = vi.fn(() => mockFileReader) as any
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
        configurable: true,
      })
      
      fireEvent.change(fileInput)

      // FileReader onloadを手動で呼び出し
      if (mockFileReader.onload) {
        act(() => {
          mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } } as any)
        })
      }
      
      await waitFor(() => {
        const preview = screen.getByAltText('プロフィール画像プレビュー')
        expect(preview).toBeInTheDocument()
        expect(preview).toHaveClass('rounded-full') // 円形
        expect(preview).toHaveAttribute('src', 'data:image/jpeg;base64,test')
      })
    })

    it('shows preview next to selection button', async () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      const fileInput = screen.getByTestId('image-file-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        result: 'data:image/jpeg;base64,test',
        onload: null as any
      }
      
      globalThis.FileReader = vi.fn(() => mockFileReader) as any
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
        configurable: true,
      })
      
      fireEvent.change(fileInput)

      if (mockFileReader.onload) {
        act(() => {
          mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } } as any)
        })
      }
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '画像を選択' })).toBeInTheDocument()
        expect(screen.getByAltText('プロフィール画像プレビュー')).toBeInTheDocument()
      })
    })

    it('allows changing selected image', async () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      const fileInput = screen.getByTestId('image-file-input')
      
      // 最初のファイル選択
      const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', {
        value: [file1],
        writable: false,
        configurable: true,
      })
      fireEvent.change(fileInput)
      
      // 2番目のファイル選択
      const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', {
        value: [file2],
        writable: false,
        configurable: true,
      })
      fireEvent.change(fileInput)
      
      await waitFor(() => {
        expect(mockOnImageSelect).toHaveBeenCalledTimes(2)
        expect(mockOnImageSelect).toHaveBeenNthCalledWith(1, file1)
        expect(mockOnImageSelect).toHaveBeenNthCalledWith(2, file2)
      })
    })
  })

  describe('Error Handling', () => {
    it('clears previous errors when new valid file is selected', async () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      const fileInput = screen.getByTestId('image-file-input')
      
      // 最初に無効なファイルを選択
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false,
        configurable: true,
      })
      fireEvent.change(fileInput)
      
      await waitFor(() => {
        expect(screen.getByText('画像ファイルを選択してください')).toBeInTheDocument()
      })
      
      // 次に有効なファイルを選択
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        writable: false,
        configurable: true,
      })
      fireEvent.change(fileInput)
      
      await waitFor(() => {
        expect(screen.queryByText('画像ファイルを選択してください')).not.toBeInTheDocument()
      })
    })

    it('displays error messages with red text', async () => {
      render(<ProfileImageUploader onImageSelect={mockOnImageSelect} />)
      
      const fileInput = screen.getByTestId('image-file-input')
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' })
      
      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false,
        configurable: true,
      })
      fireEvent.change(fileInput)
      
      await waitFor(() => {
        const errorMessage = screen.getByText('画像ファイルを選択してください')
        expect(errorMessage).toHaveClass('text-red-500')
      })
    })
  })
})
