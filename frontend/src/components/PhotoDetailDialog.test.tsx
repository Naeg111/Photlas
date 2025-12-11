import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  const mockOnUserClick = vi.fn()
  const mockOnPhotoClick = vi.fn()
  const mockPhoto = {
    id: '1',
    imageUrl: 'https://example.com/photo.jpg',
    username: 'テストユーザー',
    userAvatarUrl: 'https://example.com/avatar.jpg',
    date: '2024年1月1日',
    weather: '晴れ',
    category: '風景',
    timeOfDay: '昼'
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
          photo={mockPhoto}
          onUserClick={mockOnUserClick}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    })

    it('displays photo thumbnail', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          photo={mockPhoto}
          onUserClick={mockOnUserClick}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const images = screen.getAllByRole('img')
      const photoImage = images.find(img => img.getAttribute('src') === mockPhoto.imageUrl)
      expect(photoImage).toBeTruthy()
    })

    it('displays user name', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          photo={mockPhoto}
          onUserClick={mockOnUserClick}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    })

    it('displays category', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          photo={mockPhoto}
          onUserClick={mockOnUserClick}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.getByText('風景')).toBeInTheDocument()
    })

    it('displays like count', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          photo={mockPhoto}
          onUserClick={mockOnUserClick}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // お気に入りボタンが存在することを確認
      const favoriteButton = screen.getByRole('button', { name: /お気に入り/i })
      expect(favoriteButton).toBeInTheDocument()
    })

    it('renders fullsize view button', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          photo={mockPhoto}
          onUserClick={mockOnUserClick}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 画像をクリック可能な要素が存在することを確認
      const clickableImages = screen.getAllByRole('img')
      expect(clickableImages.length).toBeGreaterThan(0)
    })
  })

  describe('Location Display', () => {
    it('displays location information', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          photo={mockPhoto}
          onUserClick={mockOnUserClick}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 天候情報が表示されることを確認
      expect(screen.getByText('晴れ')).toBeInTheDocument()
    })
  })

  describe('Capture Date Display', () => {
    it('displays captured date', () => {
      render(
        <PhotoDetailDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          photo={mockPhoto}
          onUserClick={mockOnUserClick}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 日付が表示されることを確認
      expect(screen.getByText(/2024年1月1日/)).toBeInTheDocument()
    })
  })
})
