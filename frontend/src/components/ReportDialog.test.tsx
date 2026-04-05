import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReportDialog } from './ReportDialog'
import { REASON_ADULT_CONTENT, REASON_COPYRIGHT_INFRINGEMENT } from '../utils/codeConstants'

/**
 * Issue#54: 通報ダイアログ
 *
 * UI要件:
 * - ダイアログタイトル: 「この投稿を通報」
 * - 通報理由の選択（ラジオボタン）: 6種類
 * - 詳細説明の入力（テキストエリア）: 「その他」選択時は必須、それ以外は任意
 * - 文字数カウンター（0/300）
 * - キャンセルボタンと通報するボタン
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

      expect(screen.getByText('この投稿を通報')).toBeInTheDocument()
    })

    it('displays six report reason radio buttons', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      expect(screen.getByText('成人向けコンテンツ')).toBeInTheDocument()
      expect(screen.getByText('暴力的なコンテンツ')).toBeInTheDocument()
      expect(screen.getByText('著作権侵害')).toBeInTheDocument()
      expect(screen.getByText('プライバシー侵害')).toBeInTheDocument()
      expect(screen.getByText('スパム')).toBeInTheDocument()
      expect(screen.getByText('その他')).toBeInTheDocument()
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

      const textarea = screen.getByPlaceholderText(/通報理由の詳細を入力してください/)
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

    it('displays cancel and submit buttons', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      expect(screen.getByRole('button', { name: /キャンセル/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /通報する/i })).toBeInTheDocument()
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

      const submitButton = screen.getByRole('button', { name: /通報する/i })
      expect(submitButton).toBeDisabled()
    })

    it('submit button is enabled when a non-OTHER reason is selected (details optional)', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const reasonRadio = screen.getByLabelText('成人向けコンテンツ')
      fireEvent.click(reasonRadio)

      const submitButton = screen.getByRole('button', { name: /通報する/i })
      expect(submitButton).toBeEnabled()
    })

    it('submit button is disabled when OTHER is selected without details', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const reasonRadio = screen.getByLabelText('その他')
      fireEvent.click(reasonRadio)

      const submitButton = screen.getByRole('button', { name: /通報する/i })
      expect(submitButton).toBeDisabled()
    })

    it('submit button is enabled when OTHER is selected with details', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const reasonRadio = screen.getByLabelText('その他')
      fireEvent.click(reasonRadio)

      const textarea = screen.getByPlaceholderText(/通報理由の詳細を入力してください/)
      fireEvent.change(textarea, { target: { value: 'テスト詳細' } })

      const submitButton = screen.getByRole('button', { name: /通報する/i })
      expect(submitButton).toBeEnabled()
    })

    it('submit button is disabled when only details are entered without reason', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const textarea = screen.getByPlaceholderText(/通報理由の詳細を入力してください/)
      fireEvent.change(textarea, { target: { value: 'テスト詳細' } })

      const submitButton = screen.getByRole('button', { name: /通報する/i })
      expect(submitButton).toBeDisabled()
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

      const reasonRadio = screen.getByLabelText('成人向けコンテンツ')
      fireEvent.click(reasonRadio)

      const submitButton = screen.getByRole('button', { name: /通報する/i })
      expect(submitButton).toBeDisabled()
    })

    it('details label shows required when OTHER is selected', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const reasonRadio = screen.getByLabelText('その他')
      fireEvent.click(reasonRadio)

      expect(screen.getByText(/詳細説明（必須）/)).toBeInTheDocument()
    })

    it('details label shows optional when non-OTHER reason is selected', () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const reasonRadio = screen.getByLabelText('成人向けコンテンツ')
      fireEvent.click(reasonRadio)

      expect(screen.getByText(/詳細説明（任意）/)).toBeInTheDocument()
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

      const textarea = screen.getByPlaceholderText(/通報理由の詳細を入力してください/)
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

      const textarea = screen.getByPlaceholderText(/通報理由の詳細を入力してください/)
      const longText = 'あ'.repeat(301)
      fireEvent.change(textarea, { target: { value: longText } })

      expect(screen.getByText('301 / 300')).toBeInTheDocument()
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

    it('calls onSubmit with reason only when details not provided', async () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const reasonRadio = screen.getByLabelText('成人向けコンテンツ')
      fireEvent.click(reasonRadio)

      const submitButton = screen.getByRole('button', { name: /通報する/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          reason: REASON_ADULT_CONTENT,
          details: undefined,
        })
      })
    })

    it('calls onSubmit with reason and details when both provided', async () => {
      render(
        <ReportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
        />
      )

      const reasonRadio = screen.getByLabelText('著作権侵害')
      fireEvent.click(reasonRadio)

      const textarea = screen.getByPlaceholderText(/通報理由の詳細を入力してください/)
      fireEvent.change(textarea, { target: { value: 'テスト詳細内容' } })

      const submitButton = screen.getByRole('button', { name: /通報する/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          reason: REASON_COPYRIGHT_INFRINGEMENT,
          details: 'テスト詳細内容',
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

      const reasonRadio = screen.getByLabelText('成人向けコンテンツ')
      fireEvent.click(reasonRadio)

      const textarea = screen.getByPlaceholderText(/通報理由の詳細を入力してください/)
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
