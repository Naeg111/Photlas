import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PhotoViewerPage from './PhotoViewerPage'
import { MODERATION_STATUS_PUBLISHED } from '../utils/codeConstants'
import { _resetRateLimitNotifyDebounce } from '../utils/notifyIfRateLimited'

// Mapbox GL JS のモック
vi.mock('react-map-gl', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

// AuthContextのモック
const mockUseAuth = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// Issue#96 PR3: sonner のモック（429 トースト検証用）
const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))
vi.mock('sonner', () => ({
  toast: mockToast,
}))

// navigateモック
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// テスト定数
const TEST_PHOTO_ID = 123
const TEST_PLACE_NAME = '東京タワー'
const API_PHOTOS = '/api/v1/photos'

// Issue#88: モックAPIレスポンス（PhotoDetailResponse形式）
function createMockPhotoResponse(overrides?: { photoId?: number; placeName?: string }) {
  return {
    photoId: overrides?.photoId ?? TEST_PHOTO_ID,
    imageUrls: {
      thumbnail: 'https://example.com/thumb.webp',
      standard: 'https://example.com/photo.jpg',
      original: 'https://example.com/photo.jpg',
    },
    placeName: overrides?.placeName ?? TEST_PLACE_NAME,
    shotAt: '2024-01-15T14:30:00',
    weather: 401,
    isFavorited: false,
    favoriteCount: 5,
    cameraInfo: null,
    latitude: 35.658581,
    longitude: 139.745433,
    cropCenterX: null,
    cropCenterY: null,
    cropZoom: null,
    moderationStatus: MODERATION_STATUS_PUBLISHED,
    categories: null,
    spot: {
      spotId: 1,
      latitude: 35.658581,
      longitude: 139.745433,
    },
    user: {
      userId: 1,
      username: 'testuser',
    },
  }
}

const mockFetch = vi.fn()

function renderWithRoute(photoId: number) {
  return render(
    <MemoryRouter initialEntries={[`/photo-viewer/${photoId}`]}>
      <Routes>
        <Route path="/photo-viewer/:photoId" element={<PhotoViewerPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PhotoViewerPage', () => {
  const originalTitle = document.title

  beforeEach(() => {
    vi.resetAllMocks()
    _resetRateLimitNotifyDebounce()
    global.fetch = mockFetch
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      getAuthToken: () => null,
      updateUser: vi.fn(),
    })
  })

  afterEach(() => {
    document.title = originalTitle
  })

  it('写真詳細を取得してPhotoDetailDialogに表示する', async () => {
    const response = createMockPhotoResponse()
    // PhotoViewerPage の fetch + PhotoDetailDialog の singlePhotoId fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderWithRoute(TEST_PHOTO_ID)

    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })
  })

  it('写真が存在しない場合、エラーメッセージを表示する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: '写真が見つかりません' }),
    })

    renderWithRoute(99999)

    await waitFor(() => {
      expect(screen.getByText(/写真が見つかりません/)).toBeInTheDocument()
    })
  })

  it('通信エラー時にエラーメッセージを表示する', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    renderWithRoute(TEST_PHOTO_ID)

    await waitFor(() => {
      expect(screen.getByText(/読み込みに失敗しました/)).toBeInTheDocument()
    })
  })

  it('document.titleが場所名に設定される', async () => {
    const response = createMockPhotoResponse()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderWithRoute(TEST_PHOTO_ID)

    await waitFor(() => {
      expect(document.title).toContain(TEST_PLACE_NAME)
    })
  })

  // Issue#96 PR3: 429 レート制限ハンドリング（パターンB: トースト通知）
  describe('Rate Limit (429) - レート制限', () => {
    it('429 受信時に rate-limit トースト通知を表示する', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Too many requests', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Retry-After': '60' },
        })
      )

      renderWithRoute(TEST_PHOTO_ID)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('リクエストが多すぎます')
        )
      })
    })
  })
})
