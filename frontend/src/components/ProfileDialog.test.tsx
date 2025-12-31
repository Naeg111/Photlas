import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileDialog from './ProfileDialog'

/**
 * Issue#18: マイページ機能 (UI + API)
 * TDD Red段階: ProfileDialogコンポーネントのテストケース定義
 *
 * UI要件:
 * - プロフィール画像の表示（円形）
 * - ユーザー名の表示
 * - SNSリンクの表示
 * - タブUI（「投稿」と「お気に入り」）
 * - 写真グリッド表示
 * - プロフィール編集機能（自分の場合のみ）
 */

describe('ProfileDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnPhotoClick = vi.fn()

  const mockUserProfile = {
    userId: 123,
    username: 'testuser',
    email: 'test@example.com',
    profileImageUrl: 'https://example.com/avatar.jpg',
    snsLinks: [
      { url: 'https://x.com/testuser' },
      { url: 'https://instagram.com/testuser' }
    ]
  }

  const mockOtherUserProfile = {
    userId: 456,
    username: 'otheruser',
    profileImageUrl: null,
    snsLinks: []
  }

  const mockPhotos = [
    {
      photoId: 1,
      title: 'Test Photo 1',
      s3ObjectKey: 'photos/1.jpg',
      shotAt: '2025-01-01T00:00:00',
      weather: '晴れ',
      isFavorited: false
    },
    {
      photoId: 2,
      title: 'Test Photo 2',
      s3ObjectKey: 'photos/2.jpg',
      shotAt: '2025-01-02T00:00:00',
      weather: '曇り',
      isFavorited: true
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基本表示', () => {
    it('プロフィールダイアログが表示される', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          photos={mockPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    it('プロフィール画像が円形で表示される', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          photos={mockPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const avatar = screen.getByAltText('testuser')
      expect(avatar).toBeInTheDocument()
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg')
    })

    it('プロフィール画像が未設定の場合、デフォルトアイコンが表示される', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockOtherUserProfile}
          isOwnProfile={false}
          photos={[]}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const defaultIcon = screen.getByTestId('default-avatar-icon')
      expect(defaultIcon).toBeInTheDocument()
    })

    it('SNSリンクが表示される', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          photos={mockPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const xLink = screen.getByRole('link', { name: /x.com/i })
      const instaLink = screen.getByRole('link', { name: /instagram/i })
      expect(xLink).toBeInTheDocument()
      expect(instaLink).toBeInTheDocument()
    })
  })

  describe('タブUI', () => {
    it('「投稿」タブと「お気に入り」タブが表示される（自分のプロフィール）', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          photos={mockPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.getByRole('tab', { name: '投稿' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'お気に入り' })).toBeInTheDocument()
    })

    it('他ユーザーのプロフィールでは「投稿」タブのみ表示される', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockOtherUserProfile}
          isOwnProfile={false}
          photos={[]}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.getByRole('tab', { name: '投稿' })).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'お気に入り' })).not.toBeInTheDocument()
    })

    it('タブを切り替えることができる', async () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          photos={mockPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const favoritesTab = screen.getByRole('tab', { name: 'お気に入り' })
      fireEvent.click(favoritesTab)

      await waitFor(() => {
        expect(favoritesTab).toHaveAttribute('aria-selected', 'true')
      })
    })
  })

  describe('写真グリッド表示', () => {
    it('写真がグリッド表示される', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          photos={mockPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const grid = screen.getByTestId('photo-grid')
      expect(grid).toBeInTheDocument()
    })

    it('写真をクリックすると詳細ダイアログが開く', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          photos={mockPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const photoItems = screen.getAllByTestId(/^photo-item-/)
      fireEvent.click(photoItems[0])

      expect(mockOnPhotoClick).toHaveBeenCalledWith(mockPhotos[0])
    })
  })

  describe('プロフィール編集機能（自分のプロフィールの場合）', () => {
    it('自分のプロフィールの場合、「画像を選択」ボタンが表示される', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          photos={mockPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.getByRole('button', { name: /画像を選択/i })).toBeInTheDocument()
    })

    it('自分のプロフィールの場合、ユーザー名の「変更」ボタンが表示される', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          photos={mockPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.getByRole('button', { name: /変更/i })).toBeInTheDocument()
    })

    it('他ユーザーのプロフィールの場合、編集ボタンが表示されない', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockOtherUserProfile}
          isOwnProfile={false}
          photos={[]}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.queryByRole('button', { name: /画像を選択/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /変更/i })).not.toBeInTheDocument()
    })

    it('ユーザー名変更ボタンをクリックすると入力フォームが表示される', async () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          photos={mockPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const changeButton = screen.getByRole('button', { name: /変更/i })
      fireEvent.click(changeButton)

      await waitFor(() => {
        expect(screen.getByTestId('username-input')).toBeInTheDocument()
      })
    })
  })

  describe('閉じるボタン', () => {
    it('閉じるボタンをクリックするとダイアログが閉じる', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          photos={mockPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const closeButton = screen.getByRole('button', { name: /閉じる/i })
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('ページネーション', () => {
    it('写真が20件以上ある場合、ページネーションが表示される', () => {
      const manyPhotos = Array.from({ length: 25 }, (_, i) => ({
        photoId: i + 1,
        title: `Photo ${i + 1}`,
        s3ObjectKey: `photos/${i + 1}.jpg`,
        shotAt: '2025-01-01T00:00:00',
        weather: '晴れ',
        isFavorited: false
      }))

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          photos={manyPhotos}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })
})
