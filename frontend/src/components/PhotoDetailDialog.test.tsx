import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import PhotoDetailDialog from './PhotoDetailDialog'

// Google Maps APIのモック
vi.mock('@react-google-maps/api', () => ({
  useLoadScript: () => ({ isLoaded: true, loadError: null }),
  GoogleMap: ({ children }: { children?: React.ReactNode }) => <div data-testid="google-map-mock">{children}</div>,
  OverlayViewF: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

// AuthContextのモック
const mockUseAuth = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

/**
 * Issue#14: 写真詳細表示 (UI + API)
 * TDD Red段階のテストコード
 */

// Test Data Constants
const TEST_SPOT_ID = 100
const TEST_PHOTO_ID_1 = 1234
const TEST_PHOTO_ID_2 = 5678
const TEST_PHOTO_ID_3 = 9012

// URLs
const TEST_THUMBNAIL_URL = 'https://example.com/thumb.jpg'
const TEST_STANDARD_URL = 'https://example.com/standard.jpg'
const TEST_ORIGINAL_URL = 'https://example.com/original.jpg'
const TEST_PROFILE_IMAGE_URL = 'https://example.com/profile.jpg'

// Text content
const TEST_PHOTO_TITLE_1 = 'Test Photo'
const TEST_PHOTO_TITLE_BEAUTIFUL = 'Beautiful Landscape'
const TEST_PHOTO_TITLE_2 = 'Photo 1'
const TEST_PHOTO_TITLE_3 = 'Photo 2'
const TEST_PHOTO_TITLE_TEST = 'Test'

// User data
const TEST_USERNAME = 'testuser'
const TEST_USER_ID = 1

// Dates
const TEST_SHOT_AT = '2024-01-15T14:30:00'

// Weather/Context
const TEST_WEATHER = '晴れ'
const TEST_TIME_OF_DAY = 'DAY'
const TEST_SUBJECT_CATEGORY = 'LANDSCAPE'

// SNS
const TEST_TWITTER_URL = 'https://twitter.com/testuser'
const TEST_INSTAGRAM_URL = 'https://instagram.com/testuser'

// Error messages
const ERROR_MESSAGE_NETWORK = 'Network error'
const ERROR_TEXT_LOAD_FAILED = '読み込みに失敗しました'

// Helper Functions - Create mock API response in the new format
function createMockApiResponse(overrides?: {
  photoId?: number
  title?: string
  imageUrl?: string
  shotAt?: string
  weather?: string
  isFavorited?: boolean
  favoriteCount?: number
  userId?: number
  username?: string
  spotId?: number
  shootingDirection?: number | null
  exif?: {
    camera_body?: string
    camera_lens?: string
    focal_length_35mm?: number
    f_value?: string
    shutter_speed?: string
    iso?: number
    image_width?: number
    image_height?: number
  } | null
  tags?: { tag_id: number; name: string }[]
  latitude?: number
  longitude?: number
  cropCenterX?: number | null
  cropCenterY?: number | null
  cropZoom?: number | null
}) {
  return {
    photo: {
      photo_id: overrides?.photoId ?? TEST_PHOTO_ID_1,
      title: overrides?.title ?? TEST_PHOTO_TITLE_1,
      image_url: overrides?.imageUrl ?? TEST_STANDARD_URL,
      shot_at: overrides?.shotAt ?? TEST_SHOT_AT,
      weather: overrides?.weather ?? TEST_WEATHER,
      is_favorited: overrides?.isFavorited ?? false,
      favorite_count: overrides?.favoriteCount ?? 0,
      shooting_direction: overrides?.shootingDirection ?? null,
      exif: overrides?.exif ?? null,
      tags: overrides?.tags ?? [],
      latitude: overrides?.latitude ?? null,
      longitude: overrides?.longitude ?? null,
      crop_center_x: overrides?.cropCenterX ?? null,
      crop_center_y: overrides?.cropCenterY ?? null,
      crop_zoom: overrides?.cropZoom ?? null,
    },
    spot: {
      spot_id: overrides?.spotId ?? TEST_SPOT_ID,
      latitude: 35.6762,
      longitude: 139.6503,
    },
    user: {
      user_id: overrides?.userId ?? TEST_USER_ID,
      username: overrides?.username ?? TEST_USERNAME,
    },
  }
}

// Legacy helper - kept for backward compatibility with some tests
function createMockPhotoDetail(overrides?: any) {
  return createMockApiResponse({
    photoId: overrides?.photoId,
    title: overrides?.title,
    imageUrl: overrides?.imageUrls?.standard ?? TEST_STANDARD_URL,
    weather: overrides?.weather,
    isFavorited: overrides?.isFavorited,
    favoriteCount: overrides?.favoriteCount,
    userId: overrides?.user?.userId,
    username: overrides?.user?.username,
    spotId: overrides?.spot?.spotId,
  })
}

function setupMockFetch(photoIds: number[], photoDetails: any[]) {
  const mockFetch = vi.fn()

  // First call: fetch photo IDs
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => photoIds,
  })

  // Subsequent calls: fetch photo details
  photoDetails.forEach((detail) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => detail,
    })
  })

  return mockFetch
}

interface RenderPhotoDetailDialogProps {
  open?: boolean
  spotId?: number
  onClose?: () => void
}

function renderPhotoDetailDialog({
  open = true,
  spotId = TEST_SPOT_ID,
  onClose = () => {},
}: RenderPhotoDetailDialogProps = {}) {
  return render(<PhotoDetailDialog open={open} spotId={spotId} onClose={onClose} />)
}

describe('PhotoDetailDialog Component - Issue#14', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルトはログイン済み状態
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { userId: 1, username: 'testuser', email: 'test@example.com', role: 'USER' },
      login: vi.fn(),
      logout: vi.fn(),
      getAuthToken: () => 'mock-token',
      updateUser: vi.fn(),
    })
  })

  describe('基本表示とAPI連携', () => {
    it('ダイアログが開かれたとき、スポット写真一覧APIを呼び出す', async () => {
      const photoIds = [TEST_PHOTO_ID_1, TEST_PHOTO_ID_2, TEST_PHOTO_ID_3]
      const photoDetail = createMockPhotoDetail()
      const mockFetch = setupMockFetch(photoIds, [photoDetail])

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      renderPhotoDetailDialog()

      await waitFor(() => {
        // /api/v1/spots/{spotId}/photos が呼ばれる
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/v1/spots/${TEST_SPOT_ID}/photos`),
          expect.any(Object)
        )
      })

      await waitFor(() => {
        // /api/v1/photos/{photoId} が呼ばれる
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/v1/photos/${TEST_PHOTO_ID_1}`),
          expect.any(Object)
        )
      })
    })

    it('写真詳細情報が正しく表示される', async () => {
      const photoDetail = createMockApiResponse({
        title: TEST_PHOTO_TITLE_BEAUTIFUL,
        username: TEST_USERNAME,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(<PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      // 写真タイトルが表示される
      await waitFor(() => {
        expect(screen.getByText(TEST_PHOTO_TITLE_BEAUTIFUL)).toBeInTheDocument()
      })

      // ユーザー名が表示される
      expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument()
    })
  })

  describe('カルーセル制御', () => {
    it('複数の写真がある場合、ドットインジケーターが表示される', async () => {
      const photoIds = [TEST_PHOTO_ID_1, TEST_PHOTO_ID_2, TEST_PHOTO_ID_3]
      const photoDetail = createMockPhotoDetail({
        title: TEST_PHOTO_TITLE_2,
        imageUrls: {
          standard: TEST_STANDARD_URL,
        },
        user: { userId: TEST_USER_ID, username: TEST_USERNAME },
        spot: { spotId: TEST_SPOT_ID },
      })
      const mockFetch = setupMockFetch(photoIds, [photoDetail])

      const { rerender } = render(<PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        const indicators = screen.queryAllByTestId(/^dot-indicator-/)
        expect(indicators).toHaveLength(3)
      })
    })

    it('スワイプ操作で次の写真に移動する', async () => {
      const photoIds = [TEST_PHOTO_ID_1, TEST_PHOTO_ID_2]
      const photoDetail1 = createMockPhotoDetail({
        photoId: TEST_PHOTO_ID_1,
        title: TEST_PHOTO_TITLE_2,
        imageUrls: { standard: TEST_STANDARD_URL },
        user: { userId: TEST_USER_ID, username: TEST_USERNAME },
        spot: { spotId: TEST_SPOT_ID },
      })
      const photoDetail2 = createMockPhotoDetail({
        photoId: TEST_PHOTO_ID_2,
        title: TEST_PHOTO_TITLE_3,
        imageUrls: { standard: TEST_STANDARD_URL },
        user: { userId: TEST_USER_ID, username: TEST_USERNAME },
        spot: { spotId: TEST_SPOT_ID },
      })
      const mockFetch = setupMockFetch(photoIds, [photoDetail1, photoDetail2])

      const { rerender } = render(<PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_PHOTO_TITLE_2)).toBeInTheDocument()
      })

      // 次へボタンをクリック
      const nextButton = screen.getByLabelText('次の写真')
      await user.click(nextButton)

      // 2枚目の写真詳細APIが呼ばれたことを確認
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/v1/photos/${TEST_PHOTO_ID_2}`),
          expect.any(Object)
        )
      })
    })
  })

  describe('ローディングとエラーハンドリング', () => {
    it('写真読み込み中はローディングスピナーが表示される', async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 1000))
      )
      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      renderPhotoDetailDialog()

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('APIエラー時にエラーメッセージが表示される', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error(ERROR_MESSAGE_NETWORK))
      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      renderPhotoDetailDialog()

      await waitFor(() => {
        expect(screen.getByText(new RegExp(ERROR_TEXT_LOAD_FAILED))).toBeInTheDocument()
      })
    })
  })

  describe('ダイアログ制御', () => {
    it('openがfalseの場合、ダイアログは表示されない', () => {
      renderPhotoDetailDialog({ open: false })

      expect(screen.queryByTestId('photo-detail-dialog')).not.toBeInTheDocument()
    })

    it('閉じるボタンをクリックするとonCloseが呼ばれる', async () => {
      const photoDetail = createMockPhotoDetail({
        title: TEST_PHOTO_TITLE_TEST,
        imageUrls: { standard: TEST_STANDARD_URL },
        user: { userId: TEST_USER_ID, username: TEST_USERNAME },
        spot: { spotId: TEST_SPOT_ID },
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const onClose = vi.fn()
      const { rerender } = render(<PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={onClose} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_PHOTO_TITLE_TEST)).toBeInTheDocument()
      })

      const closeButton = screen.getByLabelText('閉じる')
      await user.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })
  })

  // ============================================================
  // Issue#30: お気に入り機能テスト
  // ============================================================

  describe('Issue#30: お気に入りボタン', () => {
    it('お気に入りボタン（ハートアイコン）が表示される', async () => {
      const photoDetail = createMockPhotoDetail()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('favorite-button')).toBeInTheDocument()
      })
    })

    it('お気に入り未登録の場合、枠線ハートが表示される', async () => {
      const photoDetail = createMockPhotoDetail({ isFavorited: false })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        const favoriteButton = screen.getByTestId('favorite-button')
        expect(favoriteButton).toBeInTheDocument()
        expect(favoriteButton).toHaveAttribute('aria-label', 'お気に入りに追加')
      })
    })

    it('お気に入り済みの場合、塗りつぶしハートが表示される', async () => {
      const photoDetail = createMockPhotoDetail({ isFavorited: true })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        const favoriteButton = screen.getByTestId('favorite-button')
        expect(favoriteButton).toBeInTheDocument()
        expect(favoriteButton).toHaveAttribute('aria-label', 'お気に入りから削除')
      })
    })

    it('お気に入りボタンをクリックするとAPIが呼び出される', async () => {
      const photoDetail = createMockPhotoDetail({ isFavorited: false })
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [TEST_PHOTO_ID_1] })
        .mockResolvedValueOnce({ ok: true, json: async () => photoDetail })
        .mockResolvedValueOnce({ ok: true }) // POST /favorite

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('favorite-button')).toBeInTheDocument()
      })

      const favoriteButton = screen.getByTestId('favorite-button')
      await user.click(favoriteButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/v1/photos/${TEST_PHOTO_ID_1}/favorite`),
          expect.objectContaining({ method: 'POST' })
        )
      })
    })

    it('お気に入り済みの写真をクリックすると削除APIが呼び出される', async () => {
      const photoDetail = createMockPhotoDetail({ isFavorited: true })
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [TEST_PHOTO_ID_1] })
        .mockResolvedValueOnce({ ok: true, json: async () => photoDetail })
        .mockResolvedValueOnce({ ok: true }) // DELETE /favorite

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('favorite-button')).toBeInTheDocument()
      })

      const favoriteButton = screen.getByTestId('favorite-button')
      await user.click(favoriteButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/v1/photos/${TEST_PHOTO_ID_1}/favorite`),
          expect.objectContaining({ method: 'DELETE' })
        )
      })
    })

    it('API呼び出し中はボタンが無効化される', async () => {
      const photoDetail = createMockPhotoDetail({ isFavorited: false })
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [TEST_PHOTO_ID_1] })
        .mockResolvedValueOnce({ ok: true, json: async () => photoDetail })
        .mockImplementationOnce(() => new Promise(() => {})) // 永続的にpending

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('favorite-button')).toBeInTheDocument()
      })

      const favoriteButton = screen.getByTestId('favorite-button')
      await user.click(favoriteButton)

      await waitFor(() => {
        expect(favoriteButton).toBeDisabled()
      })
    })

    it('成功時にアイコン状態が即時更新される（楽観的UI更新）', async () => {
      const photoDetail = createMockPhotoDetail({ isFavorited: false })
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [TEST_PHOTO_ID_1] })
        .mockResolvedValueOnce({ ok: true, json: async () => photoDetail })
        .mockResolvedValueOnce({ ok: true }) // POST /favorite

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        const favoriteButton = screen.getByTestId('favorite-button')
        expect(favoriteButton).toHaveAttribute('aria-label', 'お気に入りに追加')
      })

      const favoriteButton = screen.getByTestId('favorite-button')
      await user.click(favoriteButton)

      await waitFor(() => {
        expect(favoriteButton).toHaveAttribute('aria-label', 'お気に入りから削除')
      })
    })

    it('未ログイン状態ではお気に入りボタンが無効化される', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        getAuthToken: () => null,
        updateUser: vi.fn(),
      })

      const photoDetail = createMockPhotoDetail()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        const favoriteButton = screen.getByTestId('favorite-button')
        expect(favoriteButton).toBeDisabled()
      })
    })

    it('お気に入り数（favoriteCount）が表示される', async () => {
      const photoDetail = createMockPhotoDetail({ favoriteCount: 42 })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('favorite-count')).toHaveTextContent('42')
      })
    })
  })

  // ============================================================
  // Issue#44: 写真詳細ダイアログの情報拡張テスト
  // ============================================================

  describe('Issue#44: EXIF情報ブロックの表示', () => {
    it('EXIF情報が全て揃っている場合、撮影情報ブロックが全項目表示される', async () => {
      const photoDetail = createMockApiResponse({
        exif: {
          camera_body: 'Canon EOS R5',
          camera_lens: 'RF 24-70mm f/2.8L',
          focal_length_35mm: 35,
          f_value: 'f/2.8',
          shutter_speed: '1/1000',
          iso: 400,
          image_width: 8192,
          image_height: 5464,
        },
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('撮影情報')).toBeInTheDocument()
        expect(screen.getByText('Canon EOS R5')).toBeInTheDocument()
        expect(screen.getByText('RF 24-70mm f/2.8L')).toBeInTheDocument()
        expect(screen.getByText('35mm')).toBeInTheDocument()
        expect(screen.getByText('f/2.8')).toBeInTheDocument()
        expect(screen.getByText('1/1000')).toBeInTheDocument()
        expect(screen.getByText('ISO 400')).toBeInTheDocument()
        expect(screen.getByText('8192 x 5464')).toBeInTheDocument()
      })
    })

    it('EXIF情報が一部のみの場合、取得できた項目のみ表示される', async () => {
      const photoDetail = createMockApiResponse({
        exif: {
          camera_body: 'iPhone 15 Pro',
          iso: 100,
        },
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('撮影情報')).toBeInTheDocument()
        expect(screen.getByText('iPhone 15 Pro')).toBeInTheDocument()
        expect(screen.getByText('ISO 100')).toBeInTheDocument()
      })

      // 未取得のフィールドは表示されない
      expect(screen.queryByText(/RF/)).not.toBeInTheDocument()
      expect(screen.queryByText(/f\//)).not.toBeInTheDocument()
    })

    it('EXIF情報が全くない場合、撮影情報ブロックが非表示になる', async () => {
      const photoDetail = createMockApiResponse({
        exif: null,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_PHOTO_TITLE_1)).toBeInTheDocument()
      })

      expect(screen.queryByText('撮影情報')).not.toBeInTheDocument()
    })
  })

  describe('Issue#44: 撮影方向の表示', () => {
    it('撮影方向が記録されている場合、方角テキストと角度が表示される', async () => {
      const photoDetail = createMockApiResponse({
        shootingDirection: 225,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(/南西/)).toBeInTheDocument()
        expect(screen.getByText(/225°/)).toBeInTheDocument()
      })
    })

    it('撮影方向の角度が正しく8方位に変換される', async () => {
      // 北=0°のテスト
      const photoDetail = createMockApiResponse({
        shootingDirection: 0,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(/北/)).toBeInTheDocument()
        expect(screen.getByText(/0°/)).toBeInTheDocument()
      })
    })

    it('撮影方向が記録されていない場合は非表示', async () => {
      const photoDetail = createMockApiResponse({
        shootingDirection: null,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_PHOTO_TITLE_1)).toBeInTheDocument()
      })

      // 撮影方向の表示がないことを確認
      expect(screen.queryByText(/撮影方向/)).not.toBeInTheDocument()
    })
  })

  describe('Issue#44: 撮影コンテクスト情報の拡充', () => {
    it('撮影日時がフォーマットされて表示される', async () => {
      const photoDetail = createMockApiResponse({
        shotAt: '2026-01-15T18:30:00',
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(/2026年1月15日/)).toBeInTheDocument()
        expect(screen.getByText(/18:30/)).toBeInTheDocument()
      })
    })

    it('タグがチップ形式で表示される', async () => {
      const photoDetail = createMockApiResponse({
        tags: [
          { tag_id: 1, name: '桜' },
          { tag_id: 2, name: '夕焼け' },
        ],
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('桜')).toBeInTheDocument()
        expect(screen.getByText('夕焼け')).toBeInTheDocument()
      })
    })

    it('タグがない場合はタグセクションが非表示', async () => {
      const photoDetail = createMockApiResponse({
        tags: [],
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_PHOTO_TITLE_1)).toBeInTheDocument()
      })

      // タグチップが存在しないことを確認
      expect(screen.queryAllByTestId('detail-tag-chip')).toHaveLength(0)
    })
  })

  // ============================================================
  // Issue#45: 撮影地点ミニマップテスト
  // ============================================================

  describe('Issue#45: 撮影地点ミニマップ', () => {
    it('撮影座標がある場合、ミニマップが表示される', async () => {
      const photoDetail = createMockApiResponse({
        latitude: 35.6586,
        longitude: 139.7454,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('detail-minimap')).toBeInTheDocument()
      })
    })

    it('撮影方向がある場合、矢印オーバーレイが表示される', async () => {
      const photoDetail = createMockApiResponse({
        latitude: 35.6586,
        longitude: 139.7454,
        shootingDirection: 180,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('detail-minimap')).toBeInTheDocument()
        expect(screen.getByTestId('minimap-direction-arrow')).toBeInTheDocument()
      })
    })

    it('撮影方向がない場合、矢印オーバーレイは非表示', async () => {
      const photoDetail = createMockApiResponse({
        latitude: 35.6586,
        longitude: 139.7454,
        shootingDirection: null,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('detail-minimap')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('minimap-direction-arrow')).not.toBeInTheDocument()
    })

    it('撮影座標がない場合はスポット座標でミニマップが表示される', async () => {
      const photoDetail = createMockApiResponse()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        // スポット座標でフォールバック表示される
        expect(screen.getByTestId('detail-minimap')).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // 撮影地点プレビュー: ミニマップクリックテスト
  // ============================================================

  describe('撮影地点プレビュー: ミニマップクリック', () => {
    it('ミニマップクリック時にonMinimapClickが座標つきで呼ばれる', async () => {
      const photoDetail = createMockApiResponse({
        latitude: 35.6586,
        longitude: 139.7454,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])
      const onMinimapClick = vi.fn()

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} onMinimapClick={onMinimapClick} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} onMinimapClick={onMinimapClick} />)

      await waitFor(() => {
        expect(screen.getByTestId('detail-minimap')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('detail-minimap'))

      expect(onMinimapClick).toHaveBeenCalledWith({
        lat: 35.6586,
        lng: 139.7454,
        shootingDirection: null,
      })
    })

    it('撮影座標がない場合、スポット座標でonMinimapClickが呼ばれる', async () => {
      const photoDetail = createMockApiResponse()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])
      const onMinimapClick = vi.fn()

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} onMinimapClick={onMinimapClick} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} onMinimapClick={onMinimapClick} />)

      await waitFor(() => {
        expect(screen.getByTestId('detail-minimap')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('detail-minimap'))

      // スポット座標（35.6762, 139.6503）でコールバックが呼ばれる
      expect(onMinimapClick).toHaveBeenCalledWith({
        lat: 35.6762,
        lng: 139.6503,
        shootingDirection: null,
      })
    })

    it('onMinimapClickが未設定の場合、ミニマップはcursor-pointerクラスを持たない', async () => {
      const photoDetail = createMockApiResponse({
        latitude: 35.6586,
        longitude: 139.7454,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        const minimap = screen.getByTestId('detail-minimap')
        expect(minimap).not.toHaveClass('cursor-pointer')
      })
    })
  })

  // ===== Issue#49: クロップ表示テスト =====
  describe('Issue#49: クロップ表示', () => {
    it('写真表示エリアが正方形コンテナで表示される', async () => {
      const photoDetail = createMockApiResponse()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('photo-crop-container')).toBeInTheDocument()
      })
    })

    it('クロップデータがある場合、画像にクロップスタイルが設定される', async () => {
      const photoDetail = createMockApiResponse({
        cropCenterX: 0.3,
        cropCenterY: 0.7,
        cropZoom: 1.5,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        const img = screen.getByAltText(TEST_PHOTO_TITLE_1)
        expect(img).toHaveStyle({ objectFit: 'cover' })
        expect(img).toHaveStyle({ objectPosition: '30% 70%' })
        expect(img).toHaveStyle({ transform: 'scale(1.5)' })
      })
    })

    it('クロップデータがない場合、中央表示のデフォルトスタイルが適用される', async () => {
      const photoDetail = createMockApiResponse()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} />)

      await waitFor(() => {
        const img = screen.getByAltText(TEST_PHOTO_TITLE_1)
        expect(img).toHaveStyle({ objectFit: 'cover' })
        expect(img).toHaveStyle({ objectPosition: '50% 50%' })
        expect(img).toHaveStyle({ transform: 'scale(1)' })
      })
    })

    it('画像クリックでonImageClickが呼ばれる', async () => {
      const photoDetail = createMockApiResponse({
        cropCenterX: 0.3,
        cropCenterY: 0.7,
        cropZoom: 1.5,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])
      const mockImageClick = vi.fn()

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotId={TEST_SPOT_ID} onClose={() => {}} onImageClick={mockImageClick} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={TEST_SPOT_ID} onClose={() => {}} onImageClick={mockImageClick} />)

      await waitFor(() => {
        expect(screen.getByAltText(TEST_PHOTO_TITLE_1)).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByAltText(TEST_PHOTO_TITLE_1))

      expect(mockImageClick).toHaveBeenCalledWith(photoDetail.photo.image_url)
    })
  })
})
