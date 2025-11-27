import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SNSLinksInput from './SNSLinksInput'

/**
 * SNSLinksInput コンポーネントのテスト
 * Issue#2: ユーザー登録機能 (UI) - SNSリンク動的入力欄
 * 
 * TDD Red段階: 実装前のテストケース定義
 */
describe('SNSLinksInput', () => {
  const mockOnLinksChange = vi.fn()

  beforeEach(() => {
    mockOnLinksChange.mockClear()
  })

  afterEach(() => {
    // 確実なDOMクリーンアップ
    cleanup()
    document.body.innerHTML = ''
  })


  describe('Initial State', () => {
    it('renders only first SNS link input initially', () => {
      render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      expect(screen.getByLabelText('SNSリンク 1')).toBeInTheDocument()
      expect(screen.queryByLabelText('SNSリンク 2')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('SNSリンク 3')).not.toBeInTheDocument()
    })

    it('first input has proper placeholder', () => {
      render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      expect(firstInput).toHaveAttribute('placeholder', 'https://twitter.com/username など')
    })

    it('renders with provided links prop', () => {
      render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      expect(screen.getByLabelText('SNSリンク 1')).toHaveValue('')
      // SNSLinksInputはcontrolled componentなので、初期化時にonLinksChangeは呼ばれない
    })
  })

  describe('Dynamic Input Addition', () => {
    it('adds second input when first input has text', async () => {
      const { rerender } = render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      // コンポーネントが親に要求する状態更新をシミュレート
      expect(mockOnLinksChange).toHaveBeenCalledWith(['https://twitter.com/user', ''])
      
      // 親コンポーネントの状態更新をシミュレート
      rerender(<SNSLinksInput links={['https://twitter.com/user', '']} onLinksChange={mockOnLinksChange} />)

      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 2')).toBeInTheDocument()
      })
    })

    it('adds third input when second input has text', async () => {
      const { rerender } = render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      // 1つ目に入力
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      // 親コンポーネントの状態更新をシミュレート（2つの入力欄）
      rerender(<SNSLinksInput links={['https://twitter.com/user', '']} onLinksChange={mockOnLinksChange} />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 2')).toBeInTheDocument()
      })
      
      // 2つ目に入力
      const secondInput = screen.getByLabelText('SNSリンク 2')
      fireEvent.change(secondInput, { target: { value: 'https://instagram.com/user' } })
      
      // 親コンポーネントの状態更新をシミュレート（3つの入力欄）
      rerender(<SNSLinksInput links={['https://twitter.com/user', 'https://instagram.com/user', '']} onLinksChange={mockOnLinksChange} />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 3')).toBeInTheDocument()
      })
    })

    it('does not add fourth input (maximum 3)', async () => {
      const { rerender } = render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      // 1つ目に入力
      fireEvent.change(screen.getByLabelText('SNSリンク 1'), { target: { value: 'https://twitter.com/user' } })
      rerender(<SNSLinksInput links={['https://twitter.com/user', '']} onLinksChange={mockOnLinksChange} />)
      
      // 2つ目に入力
      fireEvent.change(screen.getByLabelText('SNSリンク 2'), { target: { value: 'https://instagram.com/user' } })
      rerender(<SNSLinksInput links={['https://twitter.com/user', 'https://instagram.com/user', '']} onLinksChange={mockOnLinksChange} />)
      
      // 3つ目に入力（最大）
      fireEvent.change(screen.getByLabelText('SNSリンク 3'), { target: { value: 'https://linkedin.com/user' } })
      
      // 最大3つなので4つ目は追加されない
      expect(mockOnLinksChange).toHaveBeenLastCalledWith(['https://twitter.com/user', 'https://instagram.com/user', 'https://linkedin.com/user'])
      
      // 4つ目は表示されない
      expect(screen.queryByLabelText('SNSリンク 4')).not.toBeInTheDocument()
    })

    it('removes empty trailing inputs when previous input is cleared', async () => {
      const { rerender } = render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      // 2つの入力欄を表示
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      // 親コンポーネントの状態更新をシミュレート（2つの入力欄）
      rerender(<SNSLinksInput links={['https://twitter.com/user', '']} onLinksChange={mockOnLinksChange} />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 2')).toBeInTheDocument()
      })
      
      // 1つ目をクリア
      const updatedFirstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(updatedFirstInput, { target: { value: '' } })
      
      // 空になったので、後続の入力欄は削除される
      expect(mockOnLinksChange).toHaveBeenLastCalledWith([''])
    })
  })

  describe('Value Management', () => {
    it('calls onLinksChange with current values when input changes', async () => {
      render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      await waitFor(() => {
        expect(mockOnLinksChange).toHaveBeenCalledWith(['https://twitter.com/user', ''])
      })
    })

    it('handles dynamic input behavior correctly', async () => {
      const { rerender } = render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      // 最初の入力欄に値を入力
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      // 親コンポーネントの状態更新をシミュレート（2つの入力欄）
      expect(mockOnLinksChange).toHaveBeenCalledWith(['https://twitter.com/user', ''])
      rerender(<SNSLinksInput links={['https://twitter.com/user', '']} onLinksChange={mockOnLinksChange} />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 2')).toBeInTheDocument()
      })
      
      // 2つ目に値を入力
      const secondInput = screen.getByLabelText('SNSリンク 2')
      fireEvent.change(secondInput, { target: { value: 'https://instagram.com/user' } })
      
      // 3つ目の入力欄が追加される
      expect(mockOnLinksChange).toHaveBeenLastCalledWith(['https://twitter.com/user', 'https://instagram.com/user', ''])
    })

    it('maintains input order when middle input is cleared', async () => {
      render(<SNSLinksInput links={['first', 'second', 'third']} onLinksChange={mockOnLinksChange} />)
      
      // 3つの入力欄が表示されている状態から開始
      expect(screen.getByLabelText('SNSリンク 1')).toHaveValue('first')
      expect(screen.getByLabelText('SNSリンク 2')).toHaveValue('second')
      expect(screen.getByLabelText('SNSリンク 3')).toHaveValue('third')
      
      // 2つ目をクリア
      const secondInput = screen.getByLabelText('SNSリンク 2')
      fireEvent.change(secondInput, { target: { value: '' } })
      
      // 空の入力欄が削除される動作をテスト
      expect(mockOnLinksChange).toHaveBeenLastCalledWith(['first', ''])
    })
  })

  describe('URL Validation', () => {
    it('accepts valid HTTP URLs', async () => {
      render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'http://example.com' } })
      
      // エラーメッセージが表示されない
      expect(screen.queryByText('正しいURLを入力してください')).not.toBeInTheDocument()
    })

    it('accepts valid HTTPS URLs', async () => {
      render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      expect(screen.queryByText('正しいURLを入力してください')).not.toBeInTheDocument()
    })

    it('shows error for invalid URL format', async () => {
      const { rerender } = render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'invalid-url' } })
      
      // 親コンポーネントの状態更新をシミュレート
      expect(mockOnLinksChange).toHaveBeenCalledWith(['invalid-url', ''])
      rerender(<SNSLinksInput links={['invalid-url', '']} onLinksChange={mockOnLinksChange} />)
      
      // 再度inputを取得してblurイベントを発火
      const updatedInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.blur(updatedInput)
      
      await waitFor(() => {
        expect(screen.getByText('正しいURLを入力してください')).toBeInTheDocument()
      })
    })

    it('highlights invalid input with red border', async () => {
      const { rerender } = render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'invalid-url' } })
      
      // 親コンポーネントの状態更新をシミュレート
      rerender(<SNSLinksInput links={['invalid-url', '']} onLinksChange={mockOnLinksChange} />)
      
      const updatedInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.blur(updatedInput)
      
      await waitFor(() => {
        expect(updatedInput).toHaveClass('border-red-500')
      })
    })

    it('clears error when valid URL is entered', async () => {
      const { rerender } = render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      
      // 無効なURLを入力
      fireEvent.change(firstInput, { target: { value: 'invalid-url' } })
      rerender(<SNSLinksInput links={['invalid-url', '']} onLinksChange={mockOnLinksChange} />)
      
      let updatedInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.blur(updatedInput)
      
      await waitFor(() => {
        expect(screen.getByText('正しいURLを入力してください')).toBeInTheDocument()
      })
      
      // 有効なURLに修正
      fireEvent.change(updatedInput, { target: { value: 'https://twitter.com/user' } })
      rerender(<SNSLinksInput links={['https://twitter.com/user', '']} onLinksChange={mockOnLinksChange} />)
      
      updatedInput = screen.getByLabelText('SNSリンク 1')
      
      await waitFor(() => {
        expect(screen.queryByText('正しいURLを入力してください')).not.toBeInTheDocument()
        expect(updatedInput).not.toHaveClass('border-red-500')
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for each input', async () => {
      const { rerender } = render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      expect(firstInput).toHaveAttribute('aria-label', 'SNSリンク 1')
      
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      rerender(<SNSLinksInput links={['https://twitter.com/user', '']} onLinksChange={mockOnLinksChange} />)
      
      await waitFor(() => {
        const secondInput = screen.getByLabelText('SNSリンク 2')
        expect(secondInput).toHaveAttribute('aria-label', 'SNSリンク 2')
      })
    })

    it('associates error messages with inputs using aria-describedby', async () => {
      const { rerender } = render(<SNSLinksInput links={['']} onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'invalid-url' } })
      rerender(<SNSLinksInput links={['invalid-url', '']} onLinksChange={mockOnLinksChange} />)
      
      const updatedInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.blur(updatedInput)
      
      await waitFor(() => {
        expect(updatedInput).toHaveAttribute('aria-describedby')
        const errorId = updatedInput.getAttribute('aria-describedby')
        expect(document.getElementById(errorId!)).toHaveTextContent('正しいURLを入力してください')
      })
    })
  })
})
