import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PhotoDetailDialog } from './PhotoDetailDialog'

/**
 * Issue#11: フロントエンドデザインのコード導入 - 写真詳細ダイアログ
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - 写真のサムネイル表示
 * - 投稿者情報の表示
 * - 撮影日時の表示
 * - 位置情報の表示
 * - カテゴリーの表示
 * - いいね・コメント機能
 * - フルサイズ表示への切り替えボタン
 */

describe('PhotoDetailDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnOpenLightbox = vi.fn()
  const mockPhoto = {
    id: '1',
    imageUrl: 'https://example.com/photo.jpg',
    userName: 'テストユーザー',
    category: '風景',
    capturedAt: '2024-01-01T12:00:00Z',
    latitude: 35.6762,
    longitude: 139.6503,
    likes: 10,
    comments: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements', () => {
    it('renders when open prop is true with photo data', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onOpenLightbox={mockOnOpenLightbox}
          photo={mockPhoto}
        />
      )

      expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    })

    it('displays photo thumbnail', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onOpenLightbox={mockOnOpenLightbox}
          photo={mockPhoto}
        />
      )

      const image = screen.getByRole('img')
      expect(image).toHaveAttribute('src', mockPhoto.imageUrl)
    })

    it('displays user name', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onOpenLightbox={mockOnOpenLightbox}
          photo={mockPhoto}
        />
      )

      expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    })

    it('displays category', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onOpenLightbox={mockOnOpenLightbox}
          photo={mockPhoto}
        />
      )

      expect(screen.getByText('風景')).toBeInTheDocument()
    })

    it('displays like count', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onOpenLightbox={mockOnOpenLightbox}
          photo={mockPhoto}
        />
      )

      expect(screen.getByText(/10/)).toBeInTheDocument()
    })

    it('renders fullsize view button', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onOpenLightbox={mockOnOpenLightbox}
          photo={mockPhoto}
        />
      )

      const expandButton = screen.getByRole('button', { name: /拡大/i })
      expect(expandButton).toBeInTheDocument()
    })
  })

  describe('Location Display', () => {
    it('displays location information', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onOpenLightbox={mockOnOpenLightbox}
          photo={mockPhoto}
        />
      )

      // 緯度経度が表示されることを確認
      expect(screen.getByText(/35.67/)).toBeInTheDocument()
      expect(screen.getByText(/139.65/)).toBeInTheDocument()
    })
  })

  describe('Capture Date Display', () => {
    it('displays captured date', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onOpenLightbox={mockOnOpenLightbox}
          photo={mockPhoto}
        />
      )

      // 日付が何らかの形式で表示されることを確認
      expect(screen.getByText(/2024/)).toBeInTheDocument()
    })
  })
})
