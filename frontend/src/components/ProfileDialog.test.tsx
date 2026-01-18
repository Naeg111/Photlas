import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
      const user = userEvent.setup()

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
      await user.click(favoritesTab)

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

  // ============================================================
  // Issue#29: プロフィール機能強化のテスト
  // ============================================================

  describe('Issue#29: プロフィール画像アップロード機能', () => {
    it('画像選択ボタンをクリックするとファイル選択ダイアログが開く', async () => {
      const user = userEvent.setup()

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

      const selectButton = screen.getByRole('button', { name: /画像を選択/i })
      await user.click(selectButton)

      // ファイル入力要素が存在することを確認
      expect(screen.getByTestId('profile-image-input')).toBeInTheDocument()
    })

    it('画像を選択するとアップロードが開始される', async () => {
      const user = userEvent.setup()

      // fetchをモックしてpending状態を維持
      global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}))

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

      const fileInput = screen.getByTestId('profile-image-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      await user.upload(fileInput, file)

      // アップロード中の状態を確認
      await waitFor(() => {
        expect(screen.getByTestId('upload-progress')).toBeInTheDocument()
      })
    })

    it('アップロード成功後にプロフィール画像が更新される', async () => {
      const user = userEvent.setup()

      // API呼び出しをモック
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ uploadUrl: 'https://s3.example.com/upload', objectKey: 'profile-images/123/test.jpg' })
        })
        .mockResolvedValueOnce({ ok: true }) // S3アップロード
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ profileImageUrl: 'https://cdn.example.com/profile-images/123/test.jpg' })
        })

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

      const fileInput = screen.getByTestId('profile-image-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByTestId('upload-success')).toBeInTheDocument()
      })
    })

    it('プロフィール画像を削除できる', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn().mockResolvedValueOnce({ ok: true })

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

      const deleteButton = screen.getByTestId('delete-profile-image-button')
      await user.click(deleteButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/users/me/profile-image'),
          expect.objectContaining({ method: 'DELETE' })
        )
      })
    })
  })

  describe('Issue#29: SNSリンク編集機能', () => {
    it('SNSリンク編集ボタンが表示される（自分のプロフィール）', () => {
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

      expect(screen.getByTestId('edit-sns-links-button')).toBeInTheDocument()
    })

    it('SNSリンク編集モードでプラットフォーム選択ができる', async () => {
      const user = userEvent.setup()

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

      const editButton = screen.getByTestId('edit-sns-links-button')
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByTestId('sns-platform-select')).toBeInTheDocument()
      })
    })

    it('4種類のSNSプラットフォームが選択可能', async () => {
      const user = userEvent.setup()

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

      const editButton = screen.getByTestId('edit-sns-links-button')
      await user.click(editButton)

      await waitFor(() => {
        const platformSelect = screen.getByTestId('sns-platform-select')
        expect(platformSelect).toBeInTheDocument()
      })

      // プラットフォームオプションを確認
      expect(screen.getByText('X (Twitter)')).toBeInTheDocument()
      expect(screen.getByText('Instagram')).toBeInTheDocument()
      expect(screen.getByText('YouTube')).toBeInTheDocument()
      expect(screen.getByText('TikTok')).toBeInTheDocument()
    })

    it('SNSリンクを保存するとAPIが呼び出される', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          snsLinks: [{ platform: 'twitter', url: 'https://x.com/newuser' }]
        })
      })

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

      const editButton = screen.getByTestId('edit-sns-links-button')
      await user.click(editButton)

      const saveButton = screen.getByTestId('save-sns-links-button')
      await user.click(saveButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/users/me/sns-links'),
          expect.objectContaining({ method: 'PUT' })
        )
      })
    })
  })

  describe('Issue#29: ユーザー名変更機能', () => {
    it('ユーザー名を変更して保存するとAPIが呼び出される', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ username: 'newusername' })
      })

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
      await user.click(changeButton)

      const input = screen.getByTestId('username-input')
      await user.clear(input)
      await user.type(input, 'newusername')

      const saveButton = screen.getByTestId('save-username-button')
      await user.click(saveButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/users/me/username'),
          expect.objectContaining({ method: 'PUT' })
        )
      })
    })

    it('ユーザー名が空の場合はエラーが表示される', async () => {
      const user = userEvent.setup()

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
      await user.click(changeButton)

      const input = screen.getByTestId('username-input')
      await user.clear(input)

      const saveButton = screen.getByTestId('save-username-button')
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/ユーザー名を入力してください/i)).toBeInTheDocument()
      })
    })

    it('ユーザー名が30文字を超える場合はエラーが表示される', async () => {
      const user = userEvent.setup()

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
      await user.click(changeButton)

      const input = screen.getByTestId('username-input')
      await user.clear(input)
      await user.type(input, 'a'.repeat(31))

      const saveButton = screen.getByTestId('save-username-button')
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/30文字以内で入力してください/i)).toBeInTheDocument()
      })
    })

    it('ユーザー名が重複している場合はエラーが表示される', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'このユーザー名はすでに使用されています' })
      })

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
      await user.click(changeButton)

      const input = screen.getByTestId('username-input')
      await user.clear(input)
      await user.type(input, 'existinguser')

      const saveButton = screen.getByTestId('save-username-button')
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/このユーザー名はすでに使用されています/i)).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // Issue#30: お気に入り一覧表示テスト
  // ============================================================

  describe('Issue#30: お気に入り一覧表示', () => {
    it('お気に入りタブをクリックするとお気に入り一覧APIが呼び出される', async () => {
      const user = userEvent.setup()

      const mockFavoritesResponse = {
        content: [
          {
            photo: {
              photo_id: 1,
              title: 'Favorite Photo 1',
              thumbnail_url: 'https://example.com/thumb1.jpg',
            },
            favorited_at: '2025-01-01T00:00:00Z',
          },
        ],
        total_elements: 1,
        pageable: { page_number: 0, page_size: 20 },
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFavoritesResponse),
      })

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
      await user.click(favoritesTab)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/users/me/favorites'),
          expect.any(Object)
        )
      })
    })

    it('お気に入りが0件の場合、メッセージが表示される', async () => {
      const user = userEvent.setup()

      const mockEmptyFavoritesResponse = {
        content: [],
        total_elements: 0,
        pageable: { page_number: 0, page_size: 20 },
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmptyFavoritesResponse),
      })

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
      await user.click(favoritesTab)

      await waitFor(() => {
        expect(screen.getByText(/お気に入りはまだありません/i)).toBeInTheDocument()
      })
    })

    it('お気に入り写真をクリックするとPhotoDetailDialogが開く', async () => {
      const user = userEvent.setup()

      const mockFavoritesResponse = {
        content: [
          {
            photo: {
              photo_id: 999,
              title: 'Favorite Photo',
              thumbnail_url: 'https://example.com/thumb.jpg',
            },
            favorited_at: '2025-01-01T00:00:00Z',
          },
        ],
        total_elements: 1,
        pageable: { page_number: 0, page_size: 20 },
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFavoritesResponse),
      })

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
      await user.click(favoritesTab)

      await waitFor(() => {
        expect(screen.getByTestId('favorite-photo-item-999')).toBeInTheDocument()
      })

      const favoritePhoto = screen.getByTestId('favorite-photo-item-999')
      await user.click(favoritePhoto)

      expect(mockOnPhotoClick).toHaveBeenCalledWith(
        expect.objectContaining({ photoId: 999 })
      )
    })

    it('お気に入り一覧でページネーションが機能する', async () => {
      const user = userEvent.setup()

      // 21件以上のお気に入りがある場合（ページネーションが必要）
      const mockFavoritesPage1 = {
        content: Array.from({ length: 20 }, (_, i) => ({
          photo: {
            photo_id: i + 1,
            title: `Favorite Photo ${i + 1}`,
            thumbnail_url: `https://example.com/thumb${i + 1}.jpg`,
          },
          favorited_at: '2025-01-01T00:00:00Z',
        })),
        total_elements: 25,
        total_pages: 2,
        pageable: { page_number: 0, page_size: 20 },
        last: false,
      }

      const mockFavoritesPage2 = {
        content: Array.from({ length: 5 }, (_, i) => ({
          photo: {
            photo_id: i + 21,
            title: `Favorite Photo ${i + 21}`,
            thumbnail_url: `https://example.com/thumb${i + 21}.jpg`,
          },
          favorited_at: '2025-01-01T00:00:00Z',
        })),
        total_elements: 25,
        total_pages: 2,
        pageable: { page_number: 1, page_size: 20 },
        last: true,
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFavoritesPage1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFavoritesPage2),
        })

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
      await user.click(favoritesTab)

      await waitFor(() => {
        expect(screen.getByTestId('favorites-pagination')).toBeInTheDocument()
      })
    })

    it('お気に入り一覧の読み込み中はローディング表示される', async () => {
      const user = userEvent.setup()

      // 永続的にpending状態にする
      global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}))

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
      await user.click(favoritesTab)

      await waitFor(() => {
        expect(screen.getByTestId('favorites-loading')).toBeInTheDocument()
      })
    })
  })
})
