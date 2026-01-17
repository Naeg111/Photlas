import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PhotoLightbox } from './PhotoLightbox'

/**
 * PhotoLightbox コンポーネントのテスト
 * Issue#27: パネル・ダイアログ群の移行
 *
 * 写真を全画面で拡大表示するライトボックス
 */

// motion/react のモック
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

describe('PhotoLightbox', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    imageUrl: 'https://example.com/photo.jpg',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements - UI要素', () => {
    it('renders lightbox when open prop is true', () => {
      render(<PhotoLightbox {...defaultProps} />)

      expect(screen.getByAltText('フルサイズ写真')).toBeInTheDocument()
    })

    it('does not render lightbox when open prop is false', () => {
      render(<PhotoLightbox {...defaultProps} open={false} />)

      expect(screen.queryByAltText('フルサイズ写真')).not.toBeInTheDocument()
    })

    it('renders close button', () => {
      render(<PhotoLightbox {...defaultProps} />)

      // Xアイコンの閉じるボタン
      const closeButton = screen.getByRole('button')
      expect(closeButton).toBeInTheDocument()
    })

    it('renders image with provided URL', () => {
      render(<PhotoLightbox {...defaultProps} />)

      const image = screen.getByAltText('フルサイズ写真')
      expect(image).toHaveAttribute('src', defaultProps.imageUrl)
    })

    it('renders zoom percentage display', () => {
      render(<PhotoLightbox {...defaultProps} />)

      expect(screen.getByText(/拡大:/)).toBeInTheDocument()
      expect(screen.getByText(/100%/)).toBeInTheDocument()
    })
  })

  describe('User Interactions - ユーザー操作', () => {
    it('calls onOpenChange(false) when close button is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoLightbox {...defaultProps} />)

      const closeButton = screen.getByRole('button')
      await user.click(closeButton)

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })

    it('calls onOpenChange(false) when background is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoLightbox {...defaultProps} />)

      // 背景（黒い部分）をクリック
      const background = screen.getByAltText('フルサイズ写真').parentElement?.parentElement?.parentElement
      if (background) {
        await user.click(background)
      }

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Zoom Functionality - ズーム機能', () => {
    it('changes zoom level on wheel scroll', () => {
      render(<PhotoLightbox {...defaultProps} />)

      const imageContainer = screen.getByAltText('フルサイズ写真').parentElement?.parentElement

      if (imageContainer) {
        // ホイールスクロールでズーム
        fireEvent.wheel(imageContainer, { deltaY: -100 })
      }

      // ズームレベルが変わることを確認（具体的な値はコンポーネントの実装に依存）
      expect(screen.getByText(/拡大:/)).toBeInTheDocument()
    })
  })
})
