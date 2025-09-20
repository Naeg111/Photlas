import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
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

  describe('Initial State', () => {
    it('renders only first SNS link input initially', () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      expect(screen.getByLabelText('SNSリンク 1')).toBeInTheDocument()
      expect(screen.queryByLabelText('SNSリンク 2')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('SNSリンク 3')).not.toBeInTheDocument()
    })

    it('first input has proper placeholder', () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      expect(firstInput).toHaveAttribute('placeholder', 'https://twitter.com/username など')
    })

    it('calls onLinksChange with empty array initially', () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      expect(mockOnLinksChange).toHaveBeenCalledWith([])
    })
  })

  describe('Dynamic Input Addition', () => {
    it('adds second input when first input has text', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 2')).toBeInTheDocument()
      })
    })

    it('adds third input when second input has text', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      // 1つ目に入力
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 2')).toBeInTheDocument()
      })
      
      // 2つ目に入力
      const secondInput = screen.getByLabelText('SNSリンク 2')
      fireEvent.change(secondInput, { target: { value: 'https://instagram.com/user' } })
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 3')).toBeInTheDocument()
      })
    })

    it('does not add fourth input (maximum 3)', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      // 3つすべてに入力
      const inputs = [
        { label: 'SNSリンク 1', value: 'https://twitter.com/user' },
        { label: 'SNSリンク 2', value: 'https://instagram.com/user' },
        { label: 'SNSリンク 3', value: 'https://linkedin.com/user' }
      ]
      
      for (let i = 0; i < inputs.length; i++) {
        if (i > 0) {
          await waitFor(() => {
            expect(screen.getByLabelText(inputs[i].label)).toBeInTheDocument()
          })
        }
        
        const input = screen.getByLabelText(inputs[i].label)
        fireEvent.change(input, { target: { value: inputs[i].value } })
      }
      
      // 4つ目は表示されない
      expect(screen.queryByLabelText('SNSリンク 4')).not.toBeInTheDocument()
    })

    it('removes empty trailing inputs when previous input is cleared', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      // 2つの入力欄を表示
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 2')).toBeInTheDocument()
      })
      
      // 1つ目をクリア
      fireEvent.change(firstInput, { target: { value: '' } })
      
      await waitFor(() => {
        expect(screen.queryByLabelText('SNSリンク 2')).not.toBeInTheDocument()
      })
    })
  })

  describe('Value Management', () => {
    it('calls onLinksChange with current values when input changes', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      await waitFor(() => {
        expect(mockOnLinksChange).toHaveBeenCalledWith(['https://twitter.com/user'])
      })
    })

    it('filters out empty values in callback', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      // 2つの入力欄を表示し、値を設定
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 2')).toBeInTheDocument()
      })
      
      const secondInput = screen.getByLabelText('SNSリンク 2')
      fireEvent.change(secondInput, { target: { value: 'https://instagram.com/user' } })
      
      // 1つ目をクリア（空にする）
      fireEvent.change(firstInput, { target: { value: '' } })
      
      await waitFor(() => {
        expect(mockOnLinksChange).toHaveBeenLastCalledWith(['https://instagram.com/user'])
      })
    })

    it('maintains input order regardless of which inputs have values', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      // 3つの入力欄を表示
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'first' } })
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 2')).toBeInTheDocument()
      })
      
      const secondInput = screen.getByLabelText('SNSリンク 2')
      fireEvent.change(secondInput, { target: { value: 'second' } })
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 3')).toBeInTheDocument()
      })
      
      const thirdInput = screen.getByLabelText('SNSリンク 3')
      fireEvent.change(thirdInput, { target: { value: 'third' } })
      
      // 2番目をクリア
      fireEvent.change(secondInput, { target: { value: '' } })
      
      await waitFor(() => {
        expect(mockOnLinksChange).toHaveBeenLastCalledWith(['first', 'third'])
      })
    })
  })

  describe('URL Validation', () => {
    it('accepts valid HTTP URLs', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'http://example.com' } })
      
      // エラーメッセージが表示されない
      expect(screen.queryByText('正しいURLを入力してください')).not.toBeInTheDocument()
    })

    it('accepts valid HTTPS URLs', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      expect(screen.queryByText('正しいURLを入力してください')).not.toBeInTheDocument()
    })

    it('shows error for invalid URL format', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'invalid-url' } })
      fireEvent.blur(firstInput)
      
      await waitFor(() => {
        expect(screen.getByText('正しいURLを入力してください')).toBeInTheDocument()
      })
    })

    it('highlights invalid input with red border', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'invalid-url' } })
      fireEvent.blur(firstInput)
      
      await waitFor(() => {
        expect(firstInput).toHaveClass('border-red-500')
      })
    })

    it('clears error when valid URL is entered', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      
      // 無効なURLを入力
      fireEvent.change(firstInput, { target: { value: 'invalid-url' } })
      fireEvent.blur(firstInput)
      
      await waitFor(() => {
        expect(screen.getByText('正しいURLを入力してください')).toBeInTheDocument()
      })
      
      // 有効なURLに修正
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      await waitFor(() => {
        expect(screen.queryByText('正しいURLを入力してください')).not.toBeInTheDocument()
        expect(firstInput).not.toHaveClass('border-red-500')
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for each input', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      await waitFor(() => {
        const secondInput = screen.getByLabelText('SNSリンク 2')
        expect(secondInput).toHaveAttribute('aria-label', 'SNSリンク 2')
      })
    })

    it('associates error messages with inputs using aria-describedby', async () => {
      render(<SNSLinksInput onLinksChange={mockOnLinksChange} />)
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'invalid-url' } })
      fireEvent.blur(firstInput)
      
      await waitFor(() => {
        expect(firstInput).toHaveAttribute('aria-describedby')
        const errorId = firstInput.getAttribute('aria-describedby')
        expect(document.getElementById(errorId!)).toHaveTextContent('正しいURLを入力してください')
      })
    })
  })
})
