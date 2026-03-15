import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PhotoViewerPage from './PhotoViewerPage'

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
const TEST_PHOTO_TITLE = '東京タワーの夜景'
const API_PHOTOS = '/api/v1/photos'

// モックAPIレスポンス
function createMockPhotoResponse(overrides?: { photoId?: number; title?: string }) {
  return {
    photo: {
      photo_id: overrides?.photoId ?? TEST_PHOTO_ID,
      title: overrides?.title ?? TEST_PHOTO_TITLE,
      image_url: 'https://example.com/photo.jpg',
      shot_at: '2024-01-15T14:30:00',
      weather: '晴れ',
      is_favorited: false,
      favorite_count: 5,
      exif: null,
      latitude: 35.658581,
      longitude: 139.745433,
      crop_center_x: null,
      crop_center_y: null,
      crop_zoom: null,
      moderation_status: 'PUBLISHED',
    },
    spot: {
      spot_id: 1,
      latitude: 35.658581,
      longitude: 139.745433,
    },
    user: {
      user_id: 1,
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
      expect(screen.getByText(TEST_PHOTO_TITLE)).toBeInTheDocument()
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

  it('document.titleが写真タイトルに設定される', async () => {
    const response = createMockPhotoResponse()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => response,
    })

    renderWithRoute(TEST_PHOTO_ID)

    await waitFor(() => {
      expect(document.title).toContain(TEST_PHOTO_TITLE)
    })
  })
})
