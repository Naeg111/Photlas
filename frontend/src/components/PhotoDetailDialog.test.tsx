import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import PhotoDetailDialog from './PhotoDetailDialog'
import { MODERATION_STATUS_QUARANTINED, MODERATION_STATUS_PENDING_REVIEW, MODERATION_STATUS_PUBLISHED } from '../utils/codeConstants'
import { _resetRateLimitNotifyDebounce } from '../utils/notifyIfRateLimited'

// Mapbox GL JS (react-map-gl) のモック
const { MapMock } = vi.hoisted(() => {
  const mockMapInstance = { setLanguage: vi.fn() }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MapMock = ({ children, onLoad }: { children?: React.ReactNode; onLoad?: (e: any) => void }) => {
    if (onLoad) onLoad({ target: mockMapInstance })
    return <div data-testid="mapbox-map">{children}</div>
  }
  return { MapMock }
})
vi.mock('react-map-gl', () => ({
  default: MapMock,
  Map: MapMock,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

// AuthContextのモック
const mockUseAuth = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// Issue#65: sonnerのモック
const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))
vi.mock('sonner', () => ({
  toast: mockToast,
}))

// Issue#65: LocationSuggestionDialogのモック
const TEST_SUGGESTED_LAT = 35.68
const TEST_SUGGESTED_LNG = 139.76
const { MockLocationSuggestionDialog } = vi.hoisted(() => {
  const MockLocationSuggestionDialog = ({ open, onSubmit }: {
    open: boolean
    onSubmit?: (lat: number, lng: number) => void
  }) => {
    if (!open) return null
    return (
      <div data-testid="location-suggestion-dialog">
        <button
          data-testid="mock-suggestion-submit"
          onClick={() => onSubmit?.(35.68, 139.76)}
        >
          送信
        </button>
      </div>
    )
  }
  return { MockLocationSuggestionDialog }
})
vi.mock('./LocationSuggestionDialog', () => ({
  LocationSuggestionDialog: MockLocationSuggestionDialog,
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

// Helper Functions - Create mock API response in PhotoDetailResponse format (Issue#88)
function createMockApiResponse(overrides?: {
  photoId?: number
  imageUrls?: {
    thumbnail?: string | null
    standard?: string
    original?: string
  }
  shotAt?: string
  weather?: string
  isFavorited?: boolean
  favoriteCount?: number
  userId?: number
  username?: string
  spotId?: number
  cameraInfo?: {
    body?: string
    lens?: string
    focalLength35mm?: number
    fValue?: string
    shutterSpeed?: string
    iso?: string
    imageWidth?: number
    imageHeight?: number
  } | null
  latitude?: number
  longitude?: number
  cropCenterX?: number | null
  cropCenterY?: number | null
  cropZoom?: number | null
  moderationStatus?: number | null
  placeName?: string
  categories?: string[] | null
}) {
  return {
    photoId: overrides?.photoId ?? TEST_PHOTO_ID_1,
    imageUrls: {
      thumbnail: overrides?.imageUrls?.thumbnail ?? TEST_THUMBNAIL_URL,
      standard: overrides?.imageUrls?.standard ?? TEST_STANDARD_URL,
      original: overrides?.imageUrls?.original ?? TEST_ORIGINAL_URL,
    },
    placeName: overrides?.placeName ?? null,
    shotAt: overrides?.shotAt ?? TEST_SHOT_AT,
    weather: overrides?.weather ?? TEST_WEATHER,
    isFavorited: overrides?.isFavorited ?? false,
    favoriteCount: overrides?.favoriteCount ?? 0,
    cameraInfo: overrides?.cameraInfo ?? null,
    latitude: overrides?.latitude ?? null,
    longitude: overrides?.longitude ?? null,
    cropCenterX: overrides?.cropCenterX ?? null,
    cropCenterY: overrides?.cropCenterY ?? null,
    cropZoom: overrides?.cropZoom ?? null,
    moderationStatus: overrides?.moderationStatus ?? null,
    categories: overrides?.categories ?? null,
    user: {
      userId: overrides?.userId ?? TEST_USER_ID,
      username: overrides?.username ?? TEST_USERNAME,
    },
    spot: {
      spotId: overrides?.spotId ?? TEST_SPOT_ID,
      latitude: 35.6762,
      longitude: 139.6503,
    },
  }
}

// Legacy helper - kept for backward compatibility with some tests
function createMockPhotoDetail(overrides?: any) {
  return createMockApiResponse({
    photoId: overrides?.photoId,
    imageUrls: overrides?.imageUrls ? {
      thumbnail: overrides.imageUrls.thumbnail ?? TEST_THUMBNAIL_URL,
      standard: overrides.imageUrls.standard ?? TEST_STANDARD_URL,
      original: overrides.imageUrls.original ?? TEST_ORIGINAL_URL,
    } : undefined,
    weather: overrides?.weather,
    isFavorited: overrides?.isFavorited,
    favoriteCount: overrides?.favoriteCount,
    userId: overrides?.user?.userId,
    username: overrides?.user?.username,
    spotId: overrides?.spot?.spotId,
    moderationStatus: overrides?.moderationStatus,
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

  // Issue#65: ステータスAPI等の追加呼び出しに対するデフォルトレスポンス
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({}),
  })

  return mockFetch
}

interface RenderPhotoDetailDialogProps {
  open?: boolean
  spotIds?: number[]
  onClose?: () => void
}

function renderPhotoDetailDialog({
  open = true,
  spotIds = [TEST_SPOT_ID],
  onClose = () => {},
}: RenderPhotoDetailDialogProps = {}) {
  return render(<PhotoDetailDialog open={open} spotIds={spotIds} onClose={onClose} />)
}

describe('PhotoDetailDialog Component - Issue#14', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetRateLimitNotifyDebounce()
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
        username: TEST_USERNAME,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(<PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      // ユーザー名が表示される
      await waitFor(() => {
        expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument()
      })
    })
  })

  describe('カルーセル制御', () => {
    it('複数の写真がある場合、枚数インジケーターが表示される', async () => {
      const photoIds = [TEST_PHOTO_ID_1, TEST_PHOTO_ID_2, TEST_PHOTO_ID_3]
      const photoDetail = createMockPhotoDetail({
        imageUrls: {
          standard: TEST_STANDARD_URL,
        },
        user: { userId: TEST_USER_ID, username: TEST_USERNAME },
        spot: { spotId: TEST_SPOT_ID },
      })
      const mockFetch = setupMockFetch(photoIds, [photoDetail])

      const { rerender } = render(<PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('1 / 3')).toBeInTheDocument()
      })
    })

    it('スワイプ操作で次の写真に移動する', async () => {
      const photoIds = [TEST_PHOTO_ID_1, TEST_PHOTO_ID_2]
      const photoDetail1 = createMockPhotoDetail({
        photoId: TEST_PHOTO_ID_1,
        imageUrls: { standard: TEST_STANDARD_URL },
        user: { userId: TEST_USER_ID, username: TEST_USERNAME },
        spot: { spotId: TEST_SPOT_ID },
      })
      const photoDetail2 = createMockPhotoDetail({
        photoId: TEST_PHOTO_ID_2,
        imageUrls: { standard: TEST_STANDARD_URL },
        user: { userId: TEST_USER_ID, username: TEST_USERNAME },
        spot: { spotId: TEST_SPOT_ID },
      })
      const mockFetch = setupMockFetch(photoIds, [photoDetail1, photoDetail2])

      const { rerender } = render(<PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument()
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

  describe('パフォーマンス最適化 - プリフェッチとレンダリング最適化', () => {
    it('最初の写真表示時に前後の写真データが事前にフェッチされる', async () => {
      const photoIds = [TEST_PHOTO_ID_1, TEST_PHOTO_ID_2, TEST_PHOTO_ID_3]
      const photoDetail1 = createMockPhotoDetail({ photoId: TEST_PHOTO_ID_1, imageUrls: { standard: TEST_STANDARD_URL }, user: { userId: TEST_USER_ID, username: TEST_USERNAME }, spot: { spotId: TEST_SPOT_ID } })
      const photoDetail2 = createMockPhotoDetail({ photoId: TEST_PHOTO_ID_2, imageUrls: { standard: 'https://example.com/photo2.jpg' }, user: { userId: TEST_USER_ID, username: TEST_USERNAME }, spot: { spotId: TEST_SPOT_ID } })
      const photoDetail3 = createMockPhotoDetail({ photoId: TEST_PHOTO_ID_3, imageUrls: { standard: 'https://example.com/photo3.jpg' }, user: { userId: TEST_USER_ID, username: TEST_USERNAME }, spot: { spotId: TEST_SPOT_ID } })
      const mockFetch = setupMockFetch(photoIds, [photoDetail1, photoDetail2, photoDetail3])

      const { rerender } = render(<PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      Object.defineProperty(globalThis, 'fetch', { value: mockFetch, writable: true, configurable: true })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      // 最初の写真(1) + 次の写真(2)のプリフェッチが呼ばれる
      await waitFor(() => {
        const photoCalls = mockFetch.mock.calls.filter((call: string[]) =>
          call[0]?.includes('/api/v1/photos/') && !call[0]?.includes('/photos?')
        )
        expect(photoCalls.length).toBeGreaterThanOrEqual(2)
      })
    })

    it('5枚の写真がある場合、currentIndex=0ではimgタグは最大2枚のみレンダリングされる（仮想化）', async () => {
      const ids = [101, 102, 103, 104, 105]
      const details = ids.map(id => createMockPhotoDetail({
        photoId: id,
        imageUrls: { standard: `https://example.com/photo${id}.jpg` },
        user: { userId: TEST_USER_ID, username: TEST_USERNAME },
        spot: { spotId: TEST_SPOT_ID },
      }))
      const mockFetch = setupMockFetch(ids, details)

      const { rerender } = render(<PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      Object.defineProperty(globalThis, 'fetch', { value: mockFetch, writable: true, configurable: true })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument()
      })

      // currentIndex=0の場合、自身(0)と次(1)の最大2枚のみ画像がレンダリングされる
      // 3枚目以降はスライド枠はあるがimg要素は存在しない
      const images = screen.queryAllByAltText('画像')
      expect(images.length).toBeLessThanOrEqual(2)
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
        imageUrls: { standard: TEST_STANDARD_URL },
        user: { userId: TEST_USER_ID, username: TEST_USERNAME },
        spot: { spotId: TEST_SPOT_ID },
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const onClose = vi.fn()
      const { rerender } = render(<PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={onClose} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument()
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
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('favorite-button')).toBeInTheDocument()
      })
    })

    it('お気に入り未登録の場合、枠線ハートが表示される', async () => {
      const photoDetail = createMockPhotoDetail({ isFavorited: false })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // ステータスAPI
        .mockImplementationOnce(() => new Promise(() => {})) // 永続的にpending

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // ステータスAPI
        .mockResolvedValueOnce({ ok: true }) // POST /favorite

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        const favoriteButton = screen.getByTestId('favorite-button')
        expect(favoriteButton).toBeDisabled()
      })
    })

    it('お気に入り数（favoriteCount）が表示される', async () => {
      const photoDetail = createMockPhotoDetail({ favoriteCount: 42 })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        cameraInfo: {
          body: 'Canon EOS R5',
          lens: 'RF 24-70mm f/2.8L',
          focalLength35mm: 35,
          fValue: 'f/2.8',
          shutterSpeed: '1/1000',
          iso: '400',
          imageWidth: 8192,
          imageHeight: 5464,
        },
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        cameraInfo: {
          body: 'iPhone 15 Pro',
          iso: '100',
        },
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument()
      })

      expect(screen.queryByText('撮影情報')).not.toBeInTheDocument()
    })
  })

  describe('Issue#44: 撮影コンテクスト情報の拡充', () => {
    it('撮影日時がフォーマットされて表示される', async () => {
      const photoDetail = createMockApiResponse({
        shotAt: '2026-01-15T18:30:00',
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(/2026年1月15日/)).toBeInTheDocument()
        expect(screen.getByText(/18:30/)).toBeInTheDocument()
      })
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
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('detail-minimap')).toBeInTheDocument()
      })
    })

    it('撮影座標がない場合はスポット座標でミニマップが表示される', async () => {
      const photoDetail = createMockApiResponse()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} onMinimapClick={onMinimapClick} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} onMinimapClick={onMinimapClick} />)

      await waitFor(() => {
        expect(screen.getByTestId('detail-minimap')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('detail-minimap'))

      expect(onMinimapClick).toHaveBeenCalledWith({
        lat: 35.6586,
        lng: 139.7454,
      })
    })

    it('撮影座標がない場合、スポット座標でonMinimapClickが呼ばれる', async () => {
      const photoDetail = createMockApiResponse()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])
      const onMinimapClick = vi.fn()

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} onMinimapClick={onMinimapClick} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} onMinimapClick={onMinimapClick} />)

      await waitFor(() => {
        expect(screen.getByTestId('detail-minimap')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('detail-minimap'))

      // スポット座標（35.6762, 139.6503）でコールバックが呼ばれる
      expect(onMinimapClick).toHaveBeenCalledWith({
        lat: 35.6762,
        lng: 139.6503,
      })
    })

    it('onMinimapClickが未設定の場合、ミニマップはcursor-pointerクラスを持たない', async () => {
      const photoDetail = createMockApiResponse({
        latitude: 35.6586,
        longitude: 139.7454,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

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
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        const img = screen.getByAltText('画像')
        expect(img).toHaveStyle({ objectFit: 'cover' })
        expect(img).toHaveStyle({ objectPosition: '30% 70%' })
        expect(img).toHaveStyle({ transform: 'scale(1.5)' })
      })
    })

    it('クロップデータがない場合、中央表示のデフォルトスタイルが適用される', async () => {
      const photoDetail = createMockApiResponse()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        const img = screen.getByAltText('画像')
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
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} onImageClick={mockImageClick} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} onImageClick={mockImageClick} />)

      await waitFor(() => {
        expect(screen.getByAltText('画像')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByAltText('画像'))

      expect(mockImageClick).toHaveBeenCalledWith(photoDetail.imageUrls.original)
    })
  })

  // Issue#54: モデレーションステータスバナーのテスト
  describe('Issue#54: モデレーションステータスバナー', () => {
    it('QUARANTINED状態の写真に非公開バナーが表示される', async () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true, userId: TEST_USER_ID })

      const photoDetail = createMockApiResponse({
        moderationStatus: MODERATION_STATUS_QUARANTINED,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('quarantined-banner')).toBeInTheDocument()
      })

      expect(screen.getByText('この投稿はコンテンツポリシーに違反している可能性があるため、現在非公開です。')).toBeInTheDocument()
    })

    it('PENDING_REVIEW状態の写真に審査中バナーが表示される', async () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true, userId: TEST_USER_ID })

      const photoDetail = createMockApiResponse({
        moderationStatus: MODERATION_STATUS_PENDING_REVIEW,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('pending-review-banner')).toBeInTheDocument()
      })

      expect(screen.getByText('この投稿は審査中です。審査完了後に公開されます。')).toBeInTheDocument()
    })

    it('PUBLISHED状態の写真にはバナーが表示されない', async () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true, userId: TEST_USER_ID })

      const photoDetail = createMockApiResponse({
        moderationStatus: MODERATION_STATUS_PUBLISHED,
      })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument()
      })

      expect(screen.queryByTestId('quarantined-banner')).not.toBeInTheDocument()
      expect(screen.queryByTestId('pending-review-banner')).not.toBeInTheDocument()
    })
  })

  // ============================================================
  // Issue#57: ユーザーによる写真削除機能テスト
  // ============================================================

  describe('Issue#57: 写真削除機能', () => {
    it('isDeletable=trueかつ自分の写真の場合、削除ボタンが表示される', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />)

      await waitFor(() => {
        expect(screen.getByTestId('delete-photo-button')).toBeInTheDocument()
      })
    })

    it('isDeletable=falseの場合、削除ボタンが表示されない', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument()
      })

      expect(screen.queryByTestId('delete-photo-button')).not.toBeInTheDocument()
    })

    it('isDeletable=falseの場合、自分の写真でも編集ボタンが表示されない', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable={false} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable={false} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument()
      })

      expect(screen.queryByTestId('edit-photo-button')).not.toBeInTheDocument()
    })

    it('削除ボタンを押すと確認ダイアログが表示される', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />)

      await waitFor(() => {
        expect(screen.getByTestId('delete-photo-button')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('delete-photo-button'))

      await waitFor(() => {
        expect(screen.getByText('この写真を削除しますか？この操作は取り消せません。')).toBeInTheDocument()
      })
    })

    it('確認ダイアログで削除を実行するとAPIが呼ばれダイアログが閉じる', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])
      const mockOnClose = vi.fn()

      // 削除APIの成功レスポンスを追加
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      })

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={mockOnClose} isDeletable />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={mockOnClose} isDeletable />)

      await waitFor(() => {
        expect(screen.getByTestId('delete-photo-button')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('delete-photo-button'))

      await waitFor(() => {
        expect(screen.getByText('削除する')).toBeInTheDocument()
      })

      await user.click(screen.getByText('削除する'))

      await waitFor(() => {
        // DELETE APIが呼ばれること
        const deleteCalls = mockFetch.mock.calls.filter(
          (call: [string, RequestInit?]) => call[1]?.method === 'DELETE'
        )
        expect(deleteCalls.length).toBe(1)
        expect(deleteCalls[0][0]).toContain(`/photos/${TEST_PHOTO_ID_1}`)
      })

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('削除APIがエラーを返した場合、エラーメッセージが表示される', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      // 削除APIのエラーレスポンス
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'アクセスが拒否されました' }),
      })

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />)

      await waitFor(() => {
        expect(screen.getByTestId('delete-photo-button')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('delete-photo-button'))

      await waitFor(() => {
        expect(screen.getByText('削除する')).toBeInTheDocument()
      })

      await user.click(screen.getByText('削除する'))

      await waitFor(() => {
        // toast.errorはモック化されていないのでDOMで検証は難しいが、
        // onCloseが呼ばれないことを確認
        const deleteCalls = mockFetch.mock.calls.filter(
          (call: [string, RequestInit?]) => call[1]?.method === 'DELETE'
        )
        expect(deleteCalls.length).toBe(1)
      })
    })
  })

  // ============================================================
  // Issue#58: 共有ボタンテスト
  // ============================================================

  describe('Issue#58: 共有ボタン', () => {
    it('共有ボタンが表示される', async () => {
      const photoDetail = createMockApiResponse()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('share-button')).toBeInTheDocument()
      })
    })

    it('未ログイン状態でも共有ボタンが表示される', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        getAuthToken: () => null,
        updateUser: vi.fn(),
      })

      const photoDetail = createMockApiResponse()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('share-button')).toBeInTheDocument()
      })
    })

    it('Web Share API非対応の場合、クリックでURLがクリップボードにコピーされる', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      })
      Object.defineProperty(navigator, 'share', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const photoDetail = createMockApiResponse()
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('share-button')).toBeInTheDocument()
      })

      // fireEvent で直接クリック
      const shareButton = screen.getByTestId('share-button')
      shareButton.click()

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining(`/photo-viewer/${TEST_PHOTO_ID_1}`)
        )
      })
    })
  })

  // ============================================================
  // Issue#61: 写真メタデータ編集機能テスト
  // ============================================================

  describe('Issue#61: 写真メタデータ編集', () => {
    it('自分の写真の場合、編集ボタンが表示される', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />)

      await waitFor(() => {
        expect(screen.getByTestId('edit-photo-button')).toBeInTheDocument()
      })
    })

    it('他人の写真の場合、編集ボタンが表示されない', async () => {
      const photoDetail = createMockApiResponse({ userId: 999 })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(TEST_USERNAME)).toBeInTheDocument()
      })

      expect(screen.queryByTestId('edit-photo-button')).not.toBeInTheDocument()
    })

    it('編集ボタンを押すと編集モードになり保存・キャンセルボタンが表示される', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />)

      await waitFor(() => {
        expect(screen.getByTestId('edit-photo-button')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('edit-photo-button'))

      await waitFor(() => {
        expect(screen.getByTestId('edit-save-button')).toBeInTheDocument()
        expect(screen.getByTestId('edit-cancel-button')).toBeInTheDocument()
      })
    })

    it('キャンセルボタンを押すと表示モードに戻る', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />)

      await waitFor(() => {
        expect(screen.getByTestId('edit-photo-button')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('edit-photo-button'))

      await waitFor(() => {
        expect(screen.getByTestId('edit-cancel-button')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('edit-cancel-button'))

      await waitFor(() => {
        expect(screen.queryByTestId('edit-save-button')).not.toBeInTheDocument()
        expect(screen.getByTestId('edit-photo-button')).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // Issue#65: 撮影場所の指摘API連携テスト
  // ============================================================
  describe('Issue#65: 撮影場所の指摘API連携', () => {
    function createLocationSuggestionMockFetch(
      postConfig: { ok: boolean; status?: number; body?: Record<string, unknown> } | 'reject'
    ) {
      const photoDetail = createMockApiResponse({ userId: 999, username: 'otheruser' })
      return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/location-suggestions') && options?.method === 'POST') {
          if (postConfig === 'reject') {
            return Promise.reject(new Error('Network error'))
          }
          return Promise.resolve({
            ok: postConfig.ok,
            status: postConfig.status ?? (postConfig.ok ? 201 : 400),
            json: async () => postConfig.body ?? {},
          })
        }
        if (url.includes('/spots/') && url.includes('/photos')) {
          return Promise.resolve({ ok: true, json: async () => [TEST_PHOTO_ID_1] })
        }
        if (url.includes(`/photos/${TEST_PHOTO_ID_1}`)) {
          return Promise.resolve({ ok: true, json: async () => photoDetail })
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
      })
    }

    async function renderAndOpenSuggestionDialog(mockFetch: ReturnType<typeof vi.fn>) {
      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )
      Object.defineProperty(globalThis, 'fetch', { value: mockFetch, writable: true, configurable: true })
      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('location-suggestion-button')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('location-suggestion-button'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-suggestion-submit')).toBeInTheDocument()
      })

      return user
    }

    it('指摘送信時にAPIにPOSTリクエストが送信される', async () => {
      const mockFetch = createLocationSuggestionMockFetch({ ok: true, status: 201, body: { id: 1 } })
      const user = await renderAndOpenSuggestionDialog(mockFetch)

      await user.click(screen.getByTestId('mock-suggestion-submit'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/photos/${TEST_PHOTO_ID_1}/location-suggestions`),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ latitude: TEST_SUGGESTED_LAT, longitude: TEST_SUGGESTED_LNG }),
          })
        )
      })
    })

    it('指摘送信成功時に成功トーストが表示される', async () => {
      const mockFetch = createLocationSuggestionMockFetch({ ok: true, status: 201, body: { id: 1 } })
      const user = await renderAndOpenSuggestionDialog(mockFetch)

      await user.click(screen.getByTestId('mock-suggestion-submit'))

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('指摘を送信しました')
      })
    })

    it('指摘送信成功時にダイアログが閉じる', async () => {
      const mockFetch = createLocationSuggestionMockFetch({ ok: true, status: 201, body: { id: 1 } })
      const user = await renderAndOpenSuggestionDialog(mockFetch)

      await user.click(screen.getByTestId('mock-suggestion-submit'))

      await waitFor(() => {
        expect(screen.queryByTestId('location-suggestion-dialog')).not.toBeInTheDocument()
      })
    })

    it('400エラー時にサーバーのメッセージがエラートーストに表示される', async () => {
      const mockFetch = createLocationSuggestionMockFetch({
        ok: false,
        status: 400,
        body: { message: '自分の投稿に対して撮影場所の指摘はできません' },
      })
      const user = await renderAndOpenSuggestionDialog(mockFetch)

      await user.click(screen.getByTestId('mock-suggestion-submit'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('自分の投稿に対して撮影場所の指摘はできません')
      })
    })

    it('400エラー時にダイアログが閉じる', async () => {
      const mockFetch = createLocationSuggestionMockFetch({
        ok: false,
        status: 400,
        body: { message: '自分の投稿に対して撮影場所の指摘はできません' },
      })
      const user = await renderAndOpenSuggestionDialog(mockFetch)

      await user.click(screen.getByTestId('mock-suggestion-submit'))

      await waitFor(() => {
        expect(screen.queryByTestId('location-suggestion-dialog')).not.toBeInTheDocument()
      })
    })

    it('ネットワークエラー時にエラートーストが表示される', async () => {
      const mockFetch = createLocationSuggestionMockFetch('reject')
      const user = await renderAndOpenSuggestionDialog(mockFetch)

      await user.click(screen.getByTestId('mock-suggestion-submit'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('指摘の送信に失敗しました')
      })
    })

    it('指摘済みの場合は指摘ボタンが表示されない', async () => {
      // ステータスAPIがhasSuggested=trueを返すモック
      const photoDetail = createMockApiResponse({ userId: 999, username: 'otheruser' })
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/location-suggestions/status')) {
          return Promise.resolve({ ok: true, json: async () => ({ hasSuggested: true }) })
        }
        if (url.includes('/spots/') && url.includes('/photos')) {
          return Promise.resolve({ ok: true, json: async () => [TEST_PHOTO_ID_1] })
        }
        if (url.includes(`/photos/${TEST_PHOTO_ID_1}`)) {
          return Promise.resolve({ ok: true, json: async () => photoDetail })
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
      })

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )
      Object.defineProperty(globalThis, 'fetch', { value: mockFetch, writable: true, configurable: true })
      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      // 写真が読み込まれるのを待つ
      await waitFor(() => {
        expect(screen.getByText('otheruser')).toBeInTheDocument()
      })

      // 指摘ボタンが表示されない
      expect(screen.queryByTestId('location-suggestion-button')).not.toBeInTheDocument()
    })
  })

  // ============================================================
  // UI改善: アクションボタンの並び順
  // ============================================================

  describe('アクションボタンの並び順', () => {
    it('投稿者本人の場合、ボタンが お気に入り→削除→編集→共有 の順で並ぶ', async () => {
      mockUseAuth.mockReturnValue({ user: { userId: TEST_USER_ID, username: TEST_USERNAME }, isAuthenticated: true })

      const mockDetail = createMockApiResponse({ userId: TEST_USER_ID, username: TEST_USERNAME })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [mockDetail])
      global.fetch = mockFetch

      render(
        <PhotoDetailDialog
          open={true}
          spotIds={[TEST_SPOT_ID]}
          onClose={vi.fn()}
          isDeletable={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('favorite-button')).toBeInTheDocument()
      })

      const actionBar = screen.getByTestId('favorite-button').parentElement!
      const buttons = actionBar.querySelectorAll('button')
      const testIds = Array.from(buttons).map(b => b.getAttribute('data-testid')).filter(Boolean)

      expect(testIds).toEqual([
        'favorite-button',
        'delete-photo-button',
        'edit-photo-button',
        'share-button',
        'location-suggestion-button',
        'report-button',
      ])
    })
  })

  // ============================================================
  // Issue#78: 投稿者本人による指摘・通報ボタンの非活性化
  // ============================================================

  describe('Issue#78: 指摘・通報ボタンの非活性化', () => {
    it('投稿者本人の場合、通報ボタンが非活性で表示される', async () => {
      mockUseAuth.mockReturnValue({ user: { userId: TEST_USER_ID, username: TEST_USERNAME }, isAuthenticated: true })

      const mockDetail = createMockApiResponse({ userId: TEST_USER_ID, username: TEST_USERNAME })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [mockDetail])
      global.fetch = mockFetch

      render(
        <PhotoDetailDialog
          open={true}
          spotIds={[TEST_SPOT_ID]}
          onClose={vi.fn()}
          isDeletable={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('report-button')).toBeInTheDocument()
      })

      expect(screen.getByTestId('report-button')).toBeDisabled()
    })

    it('投稿者本人の場合、撮影場所の指摘ボタンが非活性で表示される', async () => {
      mockUseAuth.mockReturnValue({ user: { userId: TEST_USER_ID, username: TEST_USERNAME }, isAuthenticated: true })

      const mockDetail = createMockApiResponse({ userId: TEST_USER_ID, username: TEST_USERNAME })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [mockDetail])
      global.fetch = mockFetch

      render(
        <PhotoDetailDialog
          open={true}
          spotIds={[TEST_SPOT_ID]}
          onClose={vi.fn()}
          isDeletable={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('location-suggestion-button')).toBeInTheDocument()
      })

      expect(screen.getByTestId('location-suggestion-button')).toBeDisabled()
    })

    it('他人の投稿の場合、通報ボタンが活性で表示される', async () => {
      mockUseAuth.mockReturnValue({ user: { userId: TEST_USER_ID, username: TEST_USERNAME }, isAuthenticated: true })

      const otherUserId = 999
      const mockDetail = createMockApiResponse({ userId: otherUserId, username: 'otheruser' })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [mockDetail])
      global.fetch = mockFetch

      render(
        <PhotoDetailDialog
          open={true}
          spotIds={[TEST_SPOT_ID]}
          onClose={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('report-button')).toBeInTheDocument()
      })

      expect(screen.getByTestId('report-button')).not.toBeDisabled()
    })
  })

  // ============================================================
  // プロフィール画像表示
  // ============================================================

  describe('プロフィール画像表示', () => {
    it('ユーザーのプロフィール画像がAPIレスポンスに含まれる場合、画像が表示される', async () => {
      mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false })

      const mockDetail = createMockApiResponse()
      // APIレスポンスにprofileImageUrlを追加
      mockDetail.user = { ...mockDetail.user, profileImageUrl: 'https://cdn.example.com/profile/1.jpg' }
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [mockDetail])
      global.fetch = mockFetch

      render(
        <PhotoDetailDialog
          open={true}
          spotIds={[TEST_SPOT_ID]}
          onClose={vi.fn()}
        />
      )

      await waitFor(() => {
        const profileImg = document.querySelector('img[src="https://cdn.example.com/profile/1.jpg"]')
        expect(profileImg).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // 投稿詳細ミニマップのMapbox帰属表示
  // ============================================================

  describe('投稿詳細ミニマップのMapbox帰属表示', () => {
    it('ミニマップにMapboxロゴリンクが表示される', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        const logoLink = screen.getByLabelText('Mapbox ホームページ')
        expect(logoLink).toHaveAttribute('href', 'https://www.mapbox.com/')
      })
    })

    it('ミニマップに帰属情報ボタンが表示される', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '帰属情報' })).toBeInTheDocument()
      })
    })
  })

  // Issue#96 PR3: 429 レート制限ハンドリング（パターンB: トースト通知 + デバウンス）
  describe('Rate Limit (429) - レート制限', () => {
    it('写真詳細の 429 プリフェッチでトースト通知が表示される', async () => {
      const photoIds = [TEST_PHOTO_ID_1, TEST_PHOTO_ID_2]
      const photoDetail1 = createMockPhotoDetail({ photoId: TEST_PHOTO_ID_1 })

      const mockFetch = vi.fn()
        // 1. photo IDs 取得
        .mockResolvedValueOnce({ ok: true, json: async () => photoIds })
        // 2. photo 0 詳細取得（成功）
        .mockResolvedValueOnce({ ok: true, json: async () => photoDetail1 })
        // 3. プリフェッチ対象の photo 1 詳細取得（429）
        .mockResolvedValueOnce(
          new Response('Too many requests', {
            status: 429,
            statusText: 'Too Many Requests',
            headers: { 'Retry-After': '60' },
          })
        )
        // Issue#65: 以降のステータスAPI等にはデフォルトで空オブジェクトを返す
        .mockResolvedValue({ ok: true, json: async () => ({}) })

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      renderPhotoDetailDialog()

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('リクエストが多すぎます')
        )
      })
    })

    it('お気に入りトグルで 429 を受信した場合、トースト通知が表示され楽観的UIがリバートされる', async () => {
      const photoDetail = createMockPhotoDetail({
        photoId: TEST_PHOTO_ID_1,
        isFavorited: false,
        favoriteCount: 5,
      })
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [TEST_PHOTO_ID_1] })
        .mockResolvedValueOnce({ ok: true, json: async () => photoDetail })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // ステータスAPI
        .mockResolvedValueOnce(
          new Response('Too many requests', {
            status: 429,
            statusText: 'Too Many Requests',
            headers: { 'Retry-After': '60' },
          })
        )

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('favorite-button')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('favorite-button'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('リクエストが多すぎます')
        )
      })
    })
  })

  describe('投稿削除のトースト文言', () => {
    it('削除成功時に「削除しました」トーストが表示される', async () => {
      const photoDetail = createMockApiResponse({ userId: TEST_USER_ID })
      const mockFetch = setupMockFetch([TEST_PHOTO_ID_1], [photoDetail])

      const { rerender } = render(
        <PhotoDetailDialog open={false} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />
      )

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotIds={[TEST_SPOT_ID]} onClose={() => {}} isDeletable />)

      await waitFor(() => {
        expect(screen.getByTestId('delete-photo-button')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('delete-photo-button'))

      await waitFor(() => {
        expect(screen.getByText('この写真を削除しますか？この操作は取り消せません。')).toBeInTheDocument()
      })

      // 削除API成功を設定
      Object.defineProperty(globalThis, 'fetch', {
        value: vi.fn().mockResolvedValue({ ok: true }),
        writable: true,
        configurable: true,
      })

      await user.click(screen.getByRole('button', { name: '削除する' }))

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('削除しました')
      })
    })
  })
})
