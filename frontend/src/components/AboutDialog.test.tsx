import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AboutDialog } from './AboutDialog'

/**
 * Issue#114: AboutDialog 改修
 *
 * サービス紹介に特化させ、以下のセクションを移動・削除：
 * - 「使い方」→ HowToUseDialog へ移動
 * - 「地図の操作について」→ HowToUseDialog へ移動
 * - 「お問い合わせ」→ ContactDialog へ移動
 *
 * 新規セクション「Photlasの特徴」を追加（6項目、見出し + 説明文）。
 */
describe('AboutDialog', () => {
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('open=trueの場合にダイアログが表示される', () => {
    render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('open=falseの場合にダイアログが表示されない', () => {
    render(<AboutDialog open={false} onOpenChange={mockOnOpenChange} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('タイトル「Photlasとは？」が表示される', () => {
    render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)
    expect(screen.getByText('Photlasとは？')).toBeInTheDocument()
  })

  describe('「サービス概要」セクション', () => {
    it('「サービス概要」セクションが表示される', () => {
      render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(screen.getByText('サービス概要')).toBeInTheDocument()
    })

    it('第1段落が「写真から行ってみたい場所が見つかるサービス」であること（地図→マップ統一）', () => {
      render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(
        screen.getByText(/写真から行ってみたい場所が見つかるサービスです/)
      ).toBeInTheDocument()
    })

    it('「地図」表記が「マップ」に統一されている', () => {
      render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)
      // 「マップをスクロール」が含まれる第2段落
      expect(screen.getByText(/マップをスクロール/)).toBeInTheDocument()
      // 旧第1段落の「地図から写真に出会える」は存在しない
      expect(screen.queryByText(/地図から写真に出会える/)).not.toBeInTheDocument()
    })
  })

  describe('「Photlasの特徴」セクション（新設）', () => {
    it('「Photlasの特徴」セクションが表示される', () => {
      render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(screen.getByText('Photlasの特徴')).toBeInTheDocument()
    })

    it('6項目すべての見出しが表示される', () => {
      render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(screen.getByText('マップから撮影スポットを発見できる')).toBeInTheDocument()
      expect(screen.getByText('写真の撮影地点がすぐわかる')).toBeInTheDocument()
      expect(screen.getByText('フィルターで好みの写真を探せる')).toBeInTheDocument()
      expect(screen.getByText('お気に入りに保存できる')).toBeInTheDocument()
      expect(screen.getByText('プロフィールでSNSをアピールできる')).toBeInTheDocument()
      expect(screen.getByText('ホーム画面に追加できる')).toBeInTheDocument()
    })
  })

  describe('削除されたセクション（HowToUseDialog / ContactDialog へ移動）', () => {
    it('「使い方」セクションが表示されない', () => {
      render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(screen.queryByText('使い方')).not.toBeInTheDocument()
    })

    it('「地図の操作について」セクションが表示されない', () => {
      render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(screen.queryByText('地図の操作について')).not.toBeInTheDocument()
      expect(screen.queryByText('マップの操作について')).not.toBeInTheDocument()
    })

    it('「お問い合わせ」セクションが表示されない', () => {
      render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(screen.queryByText('お問い合わせ')).not.toBeInTheDocument()
    })

    it('support@photlas.jp へのメールリンクが表示されない', () => {
      render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)
      expect(screen.queryByText('support@photlas.jp')).not.toBeInTheDocument()
    })
  })
})
