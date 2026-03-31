import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileDialog from './ProfileDialog'

/**
 * Issue#18: マイページ機能 (UI + API)
 * Issue#36: ユーザー名更新機能
 * TDD Red段階: ProfileDialogコンポーネントのテストケース定義
 *
 * UI要件:
 * - プロフィール画像の表示（円形）
 * - ユーザー名の表示
 * - SNSリンクの表示
 * - タブUI（「投稿」と「お気に入り」）
 * - 写真グリッド表示（APIから取得）
 * - プロフィール編集機能（自分の場合のみ）
 */

// Issue#36: AuthContextのモック
const mockUpdateUser = vi.fn()
const mockGetAuthToken = vi.fn(() => 'mock-token')
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    updateUser: mockUpdateUser,
    getAuthToken: mockGetAuthToken,
  }),
}))

// URL.createObjectURLのモック
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.createObjectURL = mockCreateObjectURL

// Issue#35: react-easy-cropのモック
vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: { onCropComplete: (croppedArea: unknown, croppedAreaPixels: unknown) => void }) => {
    return (
      <div data-testid="cropper-component">
        <button
          data-testid="mock-crop-trigger"
          onClick={() =>
            onCropComplete(
              { x: 0, y: 0, width: 100, height: 100 },
              { x: 0, y: 0, width: 300, height: 300 }
            )
          }
        >
          Mock Crop
        </button>
      </div>
    )
  },
}))

// 投稿一覧APIのデフォルトモックレスポンス（空）
const mockEmptyPhotosResponse = {
  content: [],
  total_elements: 0,
  total_pages: 0,
  pageable: { page_number: 0, page_size: 20 },
  last: true,
}

// 投稿一覧APIのモックレスポンス（写真あり）
const mockPhotosResponse = {
  content: [
    {
      photo: {
        photo_id: 1,
        image_url: 'https://cdn.example.com/photos/1.jpg',
        crop_center_x: 0.3,
        crop_center_y: 0.7,
        crop_zoom: 1.5,
      },
      spot: { spot_id: 10 },
      user: { user_id: 123, username: 'testuser' },
    },
    {
      photo: {
        photo_id: 2,
        image_url: 'https://cdn.example.com/photos/2.jpg',
        crop_center_x: null,
        crop_center_y: null,
        crop_zoom: null,
      },
      spot: { spot_id: 20 },
      user: { user_id: 123, username: 'testuser' },
    },
  ],
  total_elements: 2,
  total_pages: 1,
  pageable: { page_number: 0, page_size: 20 },
  last: true,
}

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

  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルトではAPIが空レスポンスを返す
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEmptyPhotosResponse),
    })
  })

  describe('基本表示', () => {
    it('プロフィールダイアログが表示される', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
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
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const xLink = screen.getByRole('link', { name: /^X$/i })
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
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 他ユーザーのプロフィールではタブ自体が表示されない
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    })

    it('タブを切り替えることができる', async () => {
      const user = userEvent.setup()

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
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

  describe('投稿写真グリッド表示', () => {
    it('APIから取得した写真がグリッド表示される', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPhotosResponse),
      })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('photo-grid')).toBeInTheDocument()
      })

      expect(screen.getByTestId('post-photo-item-1')).toBeInTheDocument()
      expect(screen.getByTestId('post-photo-item-2')).toBeInTheDocument()
    })

    it('写真画像が正しいsrcで表示される', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPhotosResponse),
      })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('post-photo-item-1')).toBeInTheDocument()
      })

      const img = screen.getByTestId('post-photo-item-1').querySelector('img')
      expect(img).toHaveAttribute('src', 'https://cdn.example.com/photos/1.jpg')
    })

    it('Issue#77 - 写真をクリックするとonPhotoClickがphotoIdで呼ばれる', async () => {
      const mockOnPhotoClick = vi.fn()
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPhotosResponse),
      })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('post-photo-item-1')).toBeInTheDocument()
      })

      // photo_id=1の写真をクリック → onPhotoClickがphotoIdで呼ばれる
      fireEvent.click(screen.getByTestId('post-photo-item-1'))
      expect(mockOnPhotoClick).toHaveBeenCalledWith(1)
    })

    it('投稿がない場合はメッセージが表示される', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmptyPhotosResponse),
      })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('まだ投稿がありません')).toBeInTheDocument()
      })
    })

    it('自分のプロフィールでは /api/v1/users/me/photos が呼ばれる', async () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/users/me/photos'),
          expect.any(Object)
        )
      })
    })

    it('他ユーザーのプロフィールでは /api/v1/users/{userId}/photos が呼ばれる', async () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockOtherUserProfile}
          isOwnProfile={false}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/users/456/photos'),
          expect.any(Object)
        )
      })
    })

    it('写真読み込み中はローディングが表示される', async () => {
      global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}))

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('posts-loading')).toBeInTheDocument()
      })
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
    it('×ボタンをクリックするとダイアログが閉じる', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={false}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // DialogのCloseボタン（×ボタン）をクリック
      const closeButton = screen.getByRole('button', { name: /Close/i })
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
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
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const selectButton = screen.getByRole('button', { name: /画像を選択/i })
      await user.click(selectButton)

      // ファイル入力要素が存在することを確認
      expect(screen.getByTestId('profile-image-input')).toBeInTheDocument()
    })

    // Issue#35: 画像選択後はトリミングモーダルが表示される
    it('画像を選択するとトリミングモーダルが表示される', async () => {
      const user = userEvent.setup()

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const fileInput = screen.getByTestId('profile-image-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      await user.upload(fileInput, file)

      // Issue#35: トリミングモーダルが表示される
      await waitFor(() => {
        expect(screen.getByTestId('cropper-modal')).toBeInTheDocument()
      })
    })

    // Issue#35: トリミング確定後にアップロードが実行される
    it('トリミング確定後にアップロードが実行され、成功表示される', async () => {
      const user = userEvent.setup()

      // Canvas APIのモック
      HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
        callback(new Blob(['test'], { type: 'image/jpeg' }))
      }) as unknown as typeof HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
        drawImage: vi.fn(),
      })) as unknown as typeof HTMLCanvasElement.prototype.getContext

      // Imageモック
      Object.defineProperty(global, 'Image', {
        value: class {
          crossOrigin = ''
          src = ''
          onload: (() => void) | null = null
          constructor() {
            setTimeout(() => { if (this.onload) this.onload() }, 0)
          }
        },
        writable: true,
      })

      // API呼び出しをモック（投稿一覧 + presigned URL + S3アップロード + 画像登録）
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })
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
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const fileInput = screen.getByTestId('profile-image-input')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      await user.upload(fileInput, file)

      // トリミングモーダルが表示される
      await waitFor(() => {
        expect(screen.getByTestId('cropper-modal')).toBeInTheDocument()
      })

      // トリミング領域を設定（モックトリガーをクリック）
      const mockCropTrigger = screen.getByTestId('mock-crop-trigger')
      await user.click(mockCropTrigger)

      // 確定ボタンをクリック
      const confirmButton = screen.getByRole('button', { name: /確定/i })
      await user.click(confirmButton)

      // Issue#82: アップロードは実行されず、保存待ち状態になる
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
      })
    })

    it('プロフィール画像を削除できる', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const deleteButton = screen.getByTestId('delete-profile-image-button')
      await user.click(deleteButton)

      // Issue#82: 削除は即座にAPIを呼ばず、保存待ち状態になる
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
      })
    })

    it('画像削除後に保存せずダイアログを閉じて再度開くと元の画像が表示される', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })

      const { rerender } = render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 画像が表示されていることを確認
      expect(document.querySelector('img[src="https://example.com/avatar.jpg"]')).toBeInTheDocument()

      // 画像を削除
      const deleteButton = screen.getByTestId('delete-profile-image-button')
      await user.click(deleteButton)

      // 保存せずにダイアログを閉じる
      rerender(
        <ProfileDialog
          open={false}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // ダイアログを再度開く
      global.fetch = vi.fn()
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })

      rerender(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 未保存なので元の画像が表示される
      await waitFor(() => {
        expect(document.querySelector('img[src="https://example.com/avatar.jpg"]')).toBeInTheDocument()
      })
    })

    it('画像設定後に保存せずダイアログを閉じて再度開くと元の画像が表示される', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })

      const { rerender } = render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 画像設定ボタンをクリック（ファイル選択 → トリミング → 完了のフロー）
      const file = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(input, file)

      // トリミングダイアログが表示される
      await waitFor(() => {
        expect(screen.getByTestId('cropper-component')).toBeInTheDocument()
      })

      // トリミング完了
      await user.click(screen.getByTestId('mock-crop-trigger'))
      await user.click(screen.getByRole('button', { name: '確定' }))

      // 保存せずにダイアログを閉じる
      rerender(
        <ProfileDialog
          open={false}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // ダイアログを再度開く
      global.fetch = vi.fn()
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })

      rerender(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 未保存なので元の画像が表示される
      await waitFor(() => {
        expect(document.querySelector('img[src="https://example.com/avatar.jpg"]')).toBeInTheDocument()
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
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const editButton = screen.getByTestId('edit-sns-links-button')
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByTestId('sns-platform-select-0')).toBeInTheDocument()
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
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const editButton = screen.getByTestId('edit-sns-links-button')
      await user.click(editButton)

      await waitFor(() => {
        const platformSelect = screen.getByTestId('sns-platform-select-0')
        expect(platformSelect).toBeInTheDocument()
      })

      // プラットフォームオプションを確認（最初のselectから取得）
      const platformSelect = screen.getByTestId('sns-platform-select-0')
      const options = platformSelect.querySelectorAll('option')
      const optionTexts = Array.from(options).map((opt) => opt.textContent)
      expect(optionTexts).toContain('X')
      expect(optionTexts).toContain('Instagram')
      expect(optionTexts).toContain('YouTube')
      expect(optionTexts).toContain('TikTok')
    })

    it('SNSリンク編集ダイアログに設定済みのリンクが表示される', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        // プロフィールAPI（snsLinksが空なのでフェッチされる）
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            userId: 123,
            username: 'testuser',
            profileImageUrl: null,
            snsLinks: [
              { platform: 'instagram', url: 'https://instagram.com/testuser' },
            ],
          }),
        })
        // 写真一覧API
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={{ ...mockUserProfile, snsLinks: [] }}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // APIからSNSリンクが取得される
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /instagram/i })).toBeInTheDocument()
      })

      // SNSリンク編集ダイアログを開く
      const editButton = screen.getByTestId('edit-sns-links-button')
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByTestId('sns-link-edit-dialog')).toBeInTheDocument()
      })

      // 設定済みのURLが入力欄に表示されている
      const urlInput = screen.getByTestId('sns-url-input-0')
      expect(urlInput).toHaveValue('https://instagram.com/testuser')

      // プラットフォームがInstagramに選択されている
      const platformSelect = screen.getByTestId('sns-platform-select-0')
      expect(platformSelect).toHaveValue('instagram')
    })

    it('SNSリンクを保存するとAPIが呼び出される', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })
        .mockResolvedValueOnce({
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
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // SNSリンク編集ダイアログを開く
      const editButton = screen.getByTestId('edit-sns-links-button')
      await user.click(editButton)

      // ダイアログが開くのを待つ
      await waitFor(() => {
        expect(screen.getByTestId('sns-link-edit-dialog')).toBeInTheDocument()
      })

      // ダイアログ内の保存ボタンをクリック
      const saveButton = screen.getByRole('button', { name: '保存' })
      await user.click(saveButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/users/me/sns-links'),
          expect.objectContaining({ method: 'PUT' })
        )
      })
    })

    // Issue#37: SNSリンクURL入力のバインドテスト
    it('SNSリンクのURLを入力して保存すると、入力内容がAPIに送信される', async () => {
      const user = userEvent.setup()
      const newUrl = 'https://x.com/newusername'

      global.fetch = vi.fn()
        // プロフィールAPI（snsLinksが空なのでフェッチされる）
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ profileImageUrl: null, snsLinks: [] }),
        })
        // 写真一覧API
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })
        // SNSリンク保存API
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ snsLinks: [] })
        })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={{ ...mockUserProfile, snsLinks: [] }}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // SNSリンク編集ダイアログを開く
      const editButton = screen.getByTestId('edit-sns-links-button')
      await user.click(editButton)

      // ダイアログが開くのを待つ
      await waitFor(() => {
        expect(screen.getByTestId('sns-link-edit-dialog')).toBeInTheDocument()
      })

      // URLを入力
      const urlInput = screen.getByTestId('sns-url-input-0')
      await user.type(urlInput, newUrl)

      // ダイアログ内の保存ボタンをクリック
      const saveButton = screen.getByRole('button', { name: '保存' })
      await user.click(saveButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/users/me/sns-links'),
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining(newUrl)
          })
        )
      })
    })

    // Issue#37: SNSリンク追加機能テスト
    it('リンクを追加ボタンで新しいリンク入力欄が追加される', async () => {
      const user = userEvent.setup()

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={{ ...mockUserProfile, snsLinks: [] }}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 編集モードを開く
      const editButton = screen.getByTestId('edit-sns-links-button')
      await user.click(editButton)

      // 追加ボタンをクリック
      const addButton = screen.getByTestId('add-sns-link-button')
      await user.click(addButton)

      // 2つ目の入力欄が表示される
      expect(screen.getByTestId('sns-url-input-1')).toBeInTheDocument()
    })

    // Issue#37: SNSリンク削除機能テスト
    it('削除ボタンでリンク入力欄が削除される', async () => {
      const user = userEvent.setup()

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={{ ...mockUserProfile, snsLinks: [{ url: 'https://x.com/test', platform: 'twitter' }] }}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 編集モードを開く
      const editButton = screen.getByTestId('edit-sns-links-button')
      await user.click(editButton)

      // 削除ボタンをクリック
      const deleteButton = screen.getByTestId('delete-sns-link-0')
      await user.click(deleteButton)

      // 入力欄が削除される
      expect(screen.queryByTestId('sns-url-input-0')).not.toBeInTheDocument()
    })
  })

  describe('Issue#29: ユーザー名変更機能', () => {
    it('ユーザー名を変更して保存するとAPIが呼び出される', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ username: 'newusername' })
        })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const changeButton = screen.getByRole('button', { name: /変更/i })
      await user.click(changeButton)

      const input = screen.getByTestId('username-input')
      await user.clear(input)
      await user.type(input, 'newusername')

      const saveButton = screen.getByTestId('save-all-changes-button')
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
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const changeButton = screen.getByRole('button', { name: /変更/i })
      await user.click(changeButton)

      const input = screen.getByTestId('username-input')
      await user.clear(input)

      const saveButton = screen.getByTestId('save-all-changes-button')
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
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const changeButton = screen.getByRole('button', { name: /変更/i })
      await user.click(changeButton)

      const input = screen.getByTestId('username-input')
      await user.clear(input)
      await user.type(input, 'a'.repeat(31))

      const saveButton = screen.getByTestId('save-all-changes-button')
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/30文字以内で入力してください/i)).toBeInTheDocument()
      })
    })

    it('ユーザー名が重複している場合はエラーが表示される', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })
        .mockResolvedValueOnce({
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
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const changeButton = screen.getByRole('button', { name: /変更/i })
      await user.click(changeButton)

      const input = screen.getByTestId('username-input')
      await user.clear(input)
      await user.type(input, 'existinguser')

      const saveButton = screen.getByTestId('save-all-changes-button')
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
              image_url: 'https://example.com/photo1.jpg',
            },
            spot: { spot_id: 1 },
            user: { user_id: 1, username: 'testuser' },
          },
        ],
        total_elements: 1,
        pageable: { page_number: 0, page_size: 20 },
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFavoritesResponse),
        })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
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

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyFavoritesResponse),
        })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const favoritesTab = screen.getByRole('tab', { name: 'お気に入り' })
      await user.click(favoritesTab)

      await waitFor(() => {
        expect(screen.getByText(/お気に入りはまだありません/i)).toBeInTheDocument()
      })
    })

    it('お気に入り一覧でページネーションが機能する', async () => {
      const user = userEvent.setup()

      // 21件以上のお気に入りがある場合（ページネーションが必要）
      const mockFavoritesPage1 = {
        content: Array.from({ length: 20 }, (_, i) => ({
          photo: {
            photo_id: i + 1,
            image_url: `https://example.com/photo${i + 1}.jpg`,
          },
          spot: { spot_id: i + 1 },
          user: { user_id: 1, username: 'testuser' },
        })),
        total_elements: 25,
        total_pages: 2,
        pageable: { page_number: 0, page_size: 20 },
        last: false,
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFavoritesPage1),
        })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
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

      // 投稿一覧は即座に返し、お気に入りだけペンディングにする
      let fetchCallCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        fetchCallCount++
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEmptyPhotosResponse),
          })
        }
        return new Promise(() => {}) // お気に入りはペンディング
      })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
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

  // ============================================================
  // Issue#54: プロフィール通報ボタンテスト
  // ============================================================
  describe('Issue#54: プロフィール通報', () => {
    it('他人のプロフィールには通報ボタンが表示される', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockOtherUserProfile}
          isOwnProfile={false}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.getByLabelText('このプロフィールを通報')).toBeInTheDocument()
    })

    it('自分のプロフィールには通報ボタンが表示されない', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      expect(screen.queryByLabelText('このプロフィールを通報')).not.toBeInTheDocument()
    })
  })

  // ============================================================
  // Issue#79: プロフィール画像のAPI取得
  // ============================================================

  describe('Issue#79: プロフィール画像のAPI取得', () => {
    it('profileImageUrlがnullの場合、APIからプロフィール情報を取得して画像を表示する', async () => {
      const profileWithoutImage = {
        ...mockUserProfile,
        profileImageUrl: null,
      }

      // 1回目: プロフィールAPI → 画像URLを含むレスポンス
      // 2回目: 写真一覧API → 空レスポンス
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            userId: 123,
            username: 'testuser',
            profileImageUrl: 'https://cdn.example.com/profile/123.jpg',
            snsLinks: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={profileWithoutImage}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // APIから取得した画像が表示される
      await waitFor(() => {
        const img = document.querySelector('img[src="https://cdn.example.com/profile/123.jpg"]')
        expect(img).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // Issue#80: 投稿一覧の即時反映とサムネイル表示
  // ============================================================

  describe('Issue#80: 投稿一覧の即時反映', () => {
    it('ダイアログを再度開いた際に投稿一覧が再取得される', async () => {
      // 1回目open: 空レスポンス
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEmptyPhotosResponse),
      })

      const { rerender } = render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })

      const firstCallCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length

      // ダイアログを閉じる
      rerender(
        <ProfileDialog
          open={false}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 2回目open: 写真ありレスポンス
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPhotosResponse),
      })

      rerender(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 再取得されて写真が表示される
      await waitFor(() => {
        expect(screen.getByTestId('post-photo-item-1')).toBeInTheDocument()
      })
    })
  })

  describe('Issue#80: サムネイルフォールバック', () => {
    it('投稿写真グリッドでImageWithFallbackが使用されている', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPhotosResponse),
      })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('post-photo-item-1')).toBeInTheDocument()
      })

      // ImageWithFallbackが使われていることを確認（fallbackSrcがdata属性に存在）
      const img = screen.getByTestId('post-photo-item-1').querySelector('img')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('data-fallback-src')
    })
  })

  // ============================================================
  // プロフィールダイアログUI改善
  // ============================================================

  describe('プロフィールダイアログUI改善', () => {
    it('ダイアログの高さが固定されている（min-hが設定されている）', () => {
      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const dialogContent = document.querySelector('[data-slot="dialog-content"]')
      expect(dialogContent).toBeInTheDocument()
      expect(dialogContent?.className).toContain('min-h-[80vh]')
    })

    it('「SNSリンクを編集」ボタンを押すとSNSリンク編集ダイアログが開く', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEmptyPhotosResponse),
      })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={mockUserProfile}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      const editButton = screen.getByTestId('edit-sns-links-button')
      await user.click(editButton)

      // SNSリンク編集ダイアログが開く
      await waitFor(() => {
        expect(screen.getByTestId('sns-link-edit-dialog')).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // プロフィール画像の他ユーザー表示バグ修正
  // ============================================================

  describe('プロフィール画像のユーザー間リセット', () => {
    it('ダイアログを閉じて別ユーザーで開くと、前のユーザーの画像が表示されない', async () => {
      // 1回目: 自分のプロフィール（画像あり）
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            userId: 123,
            username: 'testuser',
            profileImageUrl: 'https://cdn.example.com/profile/123.jpg',
            snsLinks: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })

      const { rerender } = render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={{ ...mockUserProfile, profileImageUrl: null }}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // APIから画像が取得される
      await waitFor(() => {
        expect(document.querySelector('img[src="https://cdn.example.com/profile/123.jpg"]')).toBeInTheDocument()
      })

      // ダイアログを閉じる
      rerender(
        <ProfileDialog
          open={false}
          onClose={mockOnClose}
          userProfile={{ ...mockUserProfile, profileImageUrl: null }}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 2回目: 別ユーザーのプロフィール（画像なし）
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEmptyPhotosResponse),
      })

      rerender(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={{ userId: 456, username: 'otheruser', profileImageUrl: null, snsLinks: [] }}
          isOwnProfile={false}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      // 前のユーザーの画像が表示されていないこと
      await waitFor(() => {
        expect(document.querySelector('img[src="https://cdn.example.com/profile/123.jpg"]')).not.toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // SNSリンクのAPI取得・表示順序
  // ============================================================

  describe('SNSリンクのAPI取得と表示', () => {
    it('snsLinksが空でもAPIから取得してSNSアイコンが表示される', async () => {
      const profileWithoutSns = {
        ...mockUserProfile,
        profileImageUrl: 'https://example.com/avatar.jpg',
        snsLinks: [],
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            userId: 123,
            username: 'testuser',
            profileImageUrl: 'https://example.com/avatar.jpg',
            snsLinks: [
              { platform: 'twitter', url: 'https://x.com/test' },
              { platform: 'instagram', url: 'https://instagram.com/test' },
            ],
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockEmptyPhotosResponse),
        })

      render(
        <ProfileDialog
          open={true}
          onClose={mockOnClose}
          userProfile={profileWithoutSns}
          isOwnProfile={true}
          onPhotoClick={mockOnPhotoClick}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /^X$/i })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /instagram/i })).toBeInTheDocument()
      })
    })
  })
})
