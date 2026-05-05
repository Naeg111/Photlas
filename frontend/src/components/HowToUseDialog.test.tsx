import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HowToUseDialog } from './HowToUseDialog'

/**
 * Issue#114: 操作方法ダイアログ
 * TDD Red段階
 */
describe('HowToUseDialog', () => {
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('open=trueの場合にダイアログが表示される', () => {
    render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('open=falseの場合にダイアログが表示されない', () => {
    render(<HowToUseDialog open={false} onOpenChange={mockOnOpenChange} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('タイトル「操作方法」が表示される', () => {
    render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
    expect(screen.getByText('操作方法')).toBeInTheDocument()
  })

  describe('アコーディオンの4カテゴリが表示される', () => {
    it('「基本の使い方」カテゴリが表示される', () => {
      render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(screen.getByText('基本の使い方')).toBeInTheDocument()
    })

    it('「マップの操作」カテゴリが表示される', () => {
      render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(screen.getByText('マップの操作')).toBeInTheDocument()
    })

    it('「写真の投稿」カテゴリが表示される', () => {
      render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(screen.getByText('写真の投稿')).toBeInTheDocument()
    })

    it('「その他の機能」カテゴリが表示される', () => {
      render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(screen.getByText('その他の機能')).toBeInTheDocument()
    })
  })

  describe('初期状態は全カテゴリが閉じている', () => {
    it('「スポットを探す」（基本の使い方の小項目）は初期状態では非表示', () => {
      render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
      // アコーディオンが閉じている場合、内容は DOM に存在しない
      expect(screen.queryByText('スポットを探す')).not.toBeInTheDocument()
    })
  })

  describe('カテゴリを開くと小項目が表示される', () => {
    it('「基本の使い方」を開くと「スポットを探す」「フィルターで絞り込む」が表示される', () => {
      render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
      fireEvent.click(screen.getByText('基本の使い方'))
      expect(screen.getByText('スポットを探す')).toBeInTheDocument()
      expect(screen.getByText('フィルターで絞り込む')).toBeInTheDocument()
    })

    it('「マップの操作」を開くと方位リセット・場所検索・現在位置が表示される', () => {
      render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
      fireEvent.click(screen.getByText('マップの操作'))
      expect(screen.getByText('方位リセットボタン')).toBeInTheDocument()
      expect(screen.getByText('場所検索ボタン')).toBeInTheDocument()
      expect(screen.getByText('現在位置ボタン')).toBeInTheDocument()
    })

    it('「写真の投稿」を開くと「写真を投稿する」が表示される', () => {
      render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
      fireEvent.click(screen.getByText('写真の投稿'))
      expect(screen.getByText('写真を投稿する')).toBeInTheDocument()
    })

    it('「その他の機能」を開くと全6項目（順序通り）が表示される', () => {
      render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
      fireEvent.click(screen.getByText('その他の機能'))
      expect(screen.getByText('お気に入りに保存する')).toBeInTheDocument()
      expect(screen.getByText('プロフィールを充実させる')).toBeInTheDocument()
      expect(screen.getByText('ホーム画面に追加する')).toBeInTheDocument()
      expect(screen.getByText('言語の切り替え')).toBeInTheDocument()
      expect(screen.getByText('撮影場所の指摘')).toBeInTheDocument()
      expect(screen.getByText('不適切な投稿の通報')).toBeInTheDocument()
    })
  })

  describe('1つだけ開くアコーディオン', () => {
    it('別カテゴリを開くと、前に開いていたカテゴリは閉じる', () => {
      render(<HowToUseDialog open={true} onOpenChange={mockOnOpenChange} />)
      fireEvent.click(screen.getByText('基本の使い方'))
      expect(screen.getByText('スポットを探す')).toBeInTheDocument()

      fireEvent.click(screen.getByText('写真の投稿'))
      expect(screen.queryByText('スポットを探す')).not.toBeInTheDocument()
      expect(screen.getByText('写真を投稿する')).toBeInTheDocument()
    })
  })
})
