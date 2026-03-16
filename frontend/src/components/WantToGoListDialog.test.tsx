import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WantToGoListDialog } from './WantToGoListDialog'

describe('WantToGoListDialog', () => {
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('open=trueの場合にタイトル「行きたい場所リスト」が表示される', () => {
    render(<WantToGoListDialog open={true} onOpenChange={mockOnOpenChange} />)

    expect(screen.getByText('行きたい場所リスト')).toBeInTheDocument()
  })

  it('open=falseの場合にダイアログが表示されない', () => {
    render(<WantToGoListDialog open={false} onOpenChange={mockOnOpenChange} />)

    expect(screen.queryByText('行きたい場所リスト')).not.toBeInTheDocument()
  })

  it('「Coming Soon」メッセージが表示される', () => {
    render(<WantToGoListDialog open={true} onOpenChange={mockOnOpenChange} />)

    expect(screen.getByText('Coming Soon')).toBeInTheDocument()
  })

  it('MapPinアイコンが含まれている', () => {
    render(<WantToGoListDialog open={true} onOpenChange={mockOnOpenChange} />)

    // lucide-reactのMapPinアイコンはSVGとしてレンダリングされる
    const svgElements = document.querySelectorAll('svg')
    expect(svgElements.length).toBeGreaterThan(0)
  })

  it('閉じるボタンのクリックでonOpenChangeが呼ばれる', () => {
    render(<WantToGoListDialog open={true} onOpenChange={mockOnOpenChange} />)

    // Radix UIのDialogの閉じるボタン（sr-only "Close"テキストを持つ）
    const closeButton = screen.getByRole('button', { name: 'Close' })
    closeButton.click()

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })
})
