import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import PhotoDetailDialog from './PhotoDetailDialog'

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

// Camera info
const TEST_CAMERA_BODY = 'Canon EOS R5'
const TEST_CAMERA_LENS = 'RF 24-70mm f/2.8L'
const TEST_F_VALUE = 'f/2.8'
const TEST_SHUTTER_SPEED = '1/1000'
const TEST_ISO = '400'

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

// Helper Functions
function createMockImageUrls() {
  return {
    thumbnail: TEST_THUMBNAIL_URL,
    standard: TEST_STANDARD_URL,
    original: TEST_ORIGINAL_URL,
  }
}

function createMockCameraInfo() {
  return {
    body: TEST_CAMERA_BODY,
    lens: TEST_CAMERA_LENS,
    fValue: TEST_F_VALUE,
    shutterSpeed: TEST_SHUTTER_SPEED,
    iso: TEST_ISO,
  }
}

function createMockUser(username = TEST_USERNAME) {
  return {
    userId: TEST_USER_ID,
    username,
    profileImageUrl: TEST_PROFILE_IMAGE_URL,
    snsLinks: {
      twitter: TEST_TWITTER_URL,
      instagram: TEST_INSTAGRAM_URL,
    },
  }
}

function createMockPhotoDetail(overrides?: any) {
  return {
    photoId: TEST_PHOTO_ID_1,
    title: TEST_PHOTO_TITLE_1,
    imageUrls: createMockImageUrls(),
    shotAt: TEST_SHOT_AT,
    weather: TEST_WEATHER,
    timeOfDay: TEST_TIME_OF_DAY,
    subjectCategory: TEST_SUBJECT_CATEGORY,
    cameraInfo: createMockCameraInfo(),
    user: createMockUser(),
    spot: {
      spotId: TEST_SPOT_ID,
    },
    ...overrides,
  }
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
      const photoDetail = createMockPhotoDetail({
        title: TEST_PHOTO_TITLE_BEAUTIFUL,
        user: {
          userId: TEST_USER_ID,
          username: TEST_USERNAME,
          profileImageUrl: TEST_PROFILE_IMAGE_URL,
        },
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

      // カメラ情報が表示される
      expect(screen.getByText(new RegExp(TEST_CAMERA_BODY))).toBeInTheDocument()
      expect(screen.getByText(new RegExp(TEST_CAMERA_LENS.replace(/\//g, '\\/')))).toBeInTheDocument()
      expect(screen.getByText(TEST_F_VALUE)).toBeInTheDocument()
      expect(screen.getByText(TEST_SHUTTER_SPEED)).toBeInTheDocument()
      expect(screen.getByText(TEST_ISO)).toBeInTheDocument()

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
})
