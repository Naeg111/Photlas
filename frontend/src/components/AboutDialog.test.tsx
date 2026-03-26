import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AboutDialog } from './AboutDialog'

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

  it('「サービス概要」セクションが表示される', () => {
    render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)

    expect(screen.getByText('サービス概要')).toBeInTheDocument()
    expect(
      screen.getByText(/地図から写真に出会えるサービス/)
    ).toBeInTheDocument()
  })

  it('「使い方」セクションにステップが表示される', () => {
    render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)

    expect(screen.getByText('使い方')).toBeInTheDocument()
    expect(screen.getByText('スポットを探す')).toBeInTheDocument()
    expect(screen.getByText('フィルターで絞り込む')).toBeInTheDocument()
    expect(screen.getByText('写真を投稿する')).toBeInTheDocument()
    expect(screen.getByText('お気に入りに保存する')).toBeInTheDocument()
    expect(screen.getByText('プロフィールを充実させる')).toBeInTheDocument()
    expect(screen.getByText('ホーム画面に追加する')).toBeInTheDocument()
  })

  it('「地図の操作について」セクションが表示される', () => {
    render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)

    expect(screen.getByText('地図の操作について')).toBeInTheDocument()
    expect(screen.getByText('方位リセットボタン')).toBeInTheDocument()
    expect(screen.getByText('場所検索ボタン')).toBeInTheDocument()
    expect(screen.getByText('現在位置ボタン')).toBeInTheDocument()
  })

  it('「お問い合わせ」セクションが表示される', () => {
    render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)

    expect(screen.getByText('お問い合わせ')).toBeInTheDocument()
  })

  it('support@photlas.jpへのメールリンクが表示される', () => {
    render(<AboutDialog open={true} onOpenChange={mockOnOpenChange} />)

    const emailLink = screen.getByText('support@photlas.jp')
    expect(emailLink).toBeInTheDocument()
    expect(emailLink.closest('a')).toHaveAttribute('href', 'mailto:support@photlas.jp')
  })
})
