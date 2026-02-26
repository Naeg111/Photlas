import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProtectedImage } from './ProtectedImage'

/**
 * ProtectedImage コンポーネントのテスト
 * Issue#15: 画像のダウンロード保護
 */
describe('ProtectedImage', () => {
  const defaultProps = {
    src: 'https://example.com/photo.jpg',
    alt: 'テスト画像',
  }

  describe('画像保護機能', () => {
    it('右クリックメニューが無効化される', () => {
      render(<ProtectedImage {...defaultProps} />)

      const img = screen.getByAltText('テスト画像')
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      const isPrevented = !img.dispatchEvent(event)

      expect(isPrevented).toBe(true)
    })

    it('ドラッグ操作が無効化される', () => {
      render(<ProtectedImage {...defaultProps} />)

      const img = screen.getByAltText('テスト画像')
      const event = new Event('dragstart', { bubbles: true, cancelable: true })
      const isPrevented = !img.dispatchEvent(event)

      expect(isPrevented).toBe(true)
    })

    it('draggable属性がfalseになる', () => {
      render(<ProtectedImage {...defaultProps} />)

      const img = screen.getByAltText('テスト画像')

      expect(img).toHaveAttribute('draggable', 'false')
    })

    it('touch-callout-noneクラスが付与される', () => {
      render(<ProtectedImage {...defaultProps} />)

      const img = screen.getByAltText('テスト画像')

      expect(img.className).toContain('touch-callout-none')
    })

    it('user-drag-noneクラスが付与される', () => {
      render(<ProtectedImage {...defaultProps} />)

      const img = screen.getByAltText('テスト画像')

      expect(img.className).toContain('user-drag-none')
    })

    it('select-noneクラスが付与される', () => {
      render(<ProtectedImage {...defaultProps} />)

      const img = screen.getByAltText('テスト画像')

      expect(img.className).toContain('select-none')
    })

    it('userSelect: noneスタイルが付与される', () => {
      render(<ProtectedImage {...defaultProps} />)

      const img = screen.getByAltText('テスト画像')

      expect(img.style.userSelect).toBe('none')
    })
  })

  describe('プロップスの透過', () => {
    it('src属性が渡される', () => {
      render(<ProtectedImage {...defaultProps} />)

      const img = screen.getByAltText('テスト画像')

      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
    })

    it('alt属性が渡される', () => {
      render(<ProtectedImage {...defaultProps} />)

      expect(screen.getByAltText('テスト画像')).toBeInTheDocument()
    })

    it('追加のclassNameが保護クラスと結合される', () => {
      render(<ProtectedImage {...defaultProps} className="w-full h-full" />)

      const img = screen.getByAltText('テスト画像')

      expect(img.className).toContain('w-full h-full')
      expect(img.className).toContain('touch-callout-none')
    })

    it('追加のstyleが保護スタイルとマージされる', () => {
      render(
        <ProtectedImage {...defaultProps} style={{ objectFit: 'cover' }} />,
      )

      const img = screen.getByAltText('テスト画像')

      expect(img.style.objectFit).toBe('cover')
      expect(img.style.userSelect).toBe('none')
    })
  })
})
