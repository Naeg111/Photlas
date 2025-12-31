import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReportDialog } from './ReportDialog'

/**
 * Issue#19: 報告機能 (UI + API) - 報告ダイアログ
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - ダイアログタイトル: 「この投稿を報告」
 * - 報告理由の選択（ラジオボタン）
 * - 詳細説明の入力（テキストエリア）
 * - 文字数カウンター（0/300）
 * - キャンセルボタンと報告するボタン
 * - 理由と詳細が両方入力されている場合のみ報告ボタンを有効化
 */

describe('ReportDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements', () => {
    it('renders when open prop is true', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      expect(screen.getByText('この投稿を報告')).toBeInTheDocument()
    })

    it('displays dialog title', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      expect(screen.getByText('この投稿を報告')).toBeInTheDocument()
    })

    it('displays four report reason radio buttons', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      expect(screen.getByText('不適切なコンテンツ')).toBeInTheDocument()
      expect(screen.getByText('プライバシーの侵害')).toBeInTheDocument()
      expect(screen.getByText('場所が違う')).toBeInTheDocument()
      expect(screen.getByText('著作権侵害')).toBeInTheDocument()
    })

    it('displays details textarea', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const textarea = screen.getByPlaceholderText(/報告理由の詳細を入力してください/)
      expect(textarea).toBeInTheDocument()
    })

    it('displays character counter', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      expect(screen.getByText('0 / 300')).toBeInTheDocument()
    })

    it('displays cancel button', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      expect(screen.getByRole('button', { name: /キャンセル/i })).toBeInTheDocument()
    })

    it('displays submit button', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      expect(screen.getByRole('button', { name: /報告する/i })).toBeInTheDocument()
    })
  })

  describe('Button State', () => {
    it('submit button is disabled initially', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const submitButton = screen.getByRole('button', { name: /報告する/i })
      expect(submitButton).toBeDisabled()
    })

    it('submit button is disabled when only reason is selected', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const reasonRadio = screen.getByLabelText('不適切なコンテンツ')
      fireEvent.click(reasonRadio)

      const submitButton = screen.getByRole('button', { name: /報告する/i })
      expect(submitButton).toBeDisabled()
    })

    it('submit button is disabled when only details are entered', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const textarea = screen.getByPlaceholderText(/報告理由の詳細を入力してください/)
      fireEvent.change(textarea, { target: { value: 'テスト詳細' } })

      const submitButton = screen.getByRole('button', { name: /報告する/i })
      expect(submitButton).toBeDisabled()
    })

    it('submit button is enabled when both reason and details are provided', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const reasonRadio = screen.getByLabelText('不適切なコンテンツ')
      fireEvent.click(reasonRadio)

      const textarea = screen.getByPlaceholderText(/報告理由の詳細を入力してください/)
      fireEvent.change(textarea, { target: { value: 'テスト詳細' } })

      const submitButton = screen.getByRole('button', { name: /報告する/i })
      expect(submitButton).toBeEnabled()
    })

    it('submit button is disabled when isLoading is true', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={true}
        />
      )

      const reasonRadio = screen.getByLabelText('不適切なコンテンツ')
      fireEvent.click(reasonRadio)

      const textarea = screen.getByPlaceholderText(/報告理由の詳細を入力してください/)
      fireEvent.change(textarea, { target: { value: 'テスト詳細' } })

      const submitButton = screen.getByRole('button', { name: /報告する/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Character Counter', () => {
    it('updates character count when typing', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const textarea = screen.getByPlaceholderText(/報告理由の詳細を入力してください/)
      fireEvent.change(textarea, { target: { value: 'あいうえお' } })

      expect(screen.getByText('5 / 300')).toBeInTheDocument()
    })

    it('shows warning when exceeding 300 characters', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const textarea = screen.getByPlaceholderText(/報告理由の詳細を入力してください/)
      const longText = 'あ'.repeat(301)
      fireEvent.change(textarea, { target: { value: longText } })

      expect(screen.getByText('301 / 300')).toBeInTheDocument()
      // 警告表示の確認（赤色のテキスト）
      const counter = screen.getByText('301 / 300')
      expect(counter).toHaveClass('text-red-500')
    })
  })

  describe('User Interactions', () => {
    it('calls onOpenChange when cancel button is clicked', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /キャンセル/i })
      fireEvent.click(cancelButton)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })

    it('calls onSubmit with correct data when submit button is clicked', async () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const reasonRadio = screen.getByLabelText('不適切なコンテンツ')
      fireEvent.click(reasonRadio)

      const textarea = screen.getByPlaceholderText(/報告理由の詳細を入力してください/)
      fireEvent.change(textarea, { target: { value: 'テスト詳細内容' } })

      const submitButton = screen.getByRole('button', { name: /報告する/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          reason: 'INAPPROPRIATE_CONTENT',
          details: 'テスト詳細内容'
        })
      })
    })

    it('resets form when dialog is closed', () => {
      const { rerender } = render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const reasonRadio = screen.getByLabelText('不適切なコンテンツ')
      fireEvent.click(reasonRadio)

      const textarea = screen.getByPlaceholderText(/報告理由の詳細を入力してください/)
      fireEvent.change(textarea, { target: { value: 'テスト詳細' } })

      // ダイアログを閉じる
      rerender(
        <ReportDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      // 再度開く
      rerender(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      // フォームがリセットされていることを確認
      expect(screen.getByText('0 / 300')).toBeInTheDocument()
    })
  })
})
