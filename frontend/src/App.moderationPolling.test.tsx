import { render, screen, cleanup, act, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import App from './App'
import i18n from './i18n'
import { INITIAL_SPOTS_SPLASH_TIMEOUT_MS } from './config/app'
import { createPhoto, getPhotoUploadUrl, uploadFileToS3 } from './utils/apiClient'
import type { PhotoResponse } from './utils/apiClient'
import {
  MODERATION_STATUS_PENDING_REVIEW,
  MODERATION_STATUS_PUBLISHED,
  MODERATION_STATUS_QUARANTINED,
} from './utils/codeConstants'

/**
 * Spec#54: 投稿後のモデレーション状態の確認（ポーリング）とお知らせのテスト
 *
 * 以前はフロントの PhotoResponse 型が photoId（キャメルケース）になっていたが、
 * 実際の POST /photos の応答は photo.photo_id（スネークケース）のため、
 * ポーリングが一度も始まっていなかった。ここでは実際の応答の形で createPhoto をモックし、
 * /photos/{id}/status が呼ばれてお知らせが出ることを確かめる。
 */

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

const { MapMock } = vi.hoisted(() => {
  const mockMap = {
    setZoom: vi.fn(),
    getZoom: vi.fn(() => 11),
    getCenter: vi.fn(() => ({ lng: 139.7454, lat: 35.6585 })),
    getBounds: vi.fn(() => ({
      getNorth: () => 35.7,
      getSouth: () => 35.6,
      getEast: () => 139.8,
      getWest: () => 139.7,
    })),
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
    once: vi.fn(),
    setLanguage: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    addImage: vi.fn(),
    hasImage: vi.fn(() => false),
    getSource: vi.fn(() => ({ setData: vi.fn() })),
    removeSource: vi.fn(),
    removeLayer: vi.fn(),
    getLayer: vi.fn(() => undefined),
    setLayoutProperty: vi.fn(),
    dragRotate: { enable: vi.fn(), disable: vi.fn() },
    touchPitch: { enable: vi.fn(), disable: vi.fn() },
    touchZoomRotate: { enableRotation: vi.fn(), disableRotation: vi.fn() },
  }

  const MapMock = ({ children, onLoad }: any) => {
    if (onLoad) {
      onLoad({ target: mockMap })
    }
    return <div data-testid="mapbox-map">{children}</div>
  }

  return { MapMock }
})

vi.mock('react-map-gl', () => ({
  default: MapMock,
  Map: MapMock,
  Marker: ({ children }: any) => <div>{children}</div>,
  AttributionControl: () => null,
}))

// 地図はスタブに置き換える。本物の MapView はピンの取得などで state を更新し、偽のタイマーのもとで act の警告を出すため。
// App が ref 経由で呼ぶメソッドだけを持たせる。
const { mockRefreshSpots } = vi.hoisted(() => ({ mockRefreshSpots: vi.fn() }))
vi.mock('./components/MapView', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  const MapViewStub = forwardRef(function MapViewStub(_props: unknown, ref) {
    useImperativeHandle(ref, () => ({
      refreshSpots: mockRefreshSpots,
      autoCenter: vi.fn(),
      startGlobeRotationImmediately: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetNorthHeading: vi.fn(),
      centerOnUserLocation: vi.fn(),
      flyToPlace: vi.fn(),
      showShootingLocationPin: vi.fn(),
      clearShootingLocationPin: vi.fn(),
    }))
    return <div data-testid="map-stub" />
  })
  return { default: MapViewStub }
})

vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(() => ({ suggest: vi.fn(), retrieve: vi.fn() })),
  GeocodingCore: vi.fn(() => ({ forward: vi.fn() })),
  SessionToken: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
  Toaster: () => null,
}))

// 投稿ダイアログは、開いたら「投稿する」ボタンだけを出すスタブに置き換える
// （ファイル選択・クロップ・地図などの本物の入力手順はこのテストの対象外）
vi.mock('./components/PhotoContributionDialog', () => ({
  PhotoContributionDialog: ({ onSubmit }: { onSubmit: (data: unknown) => Promise<void> }) => (
    <button
      type="button"
      onClick={() => {
        onSubmit({
          file: new File(['x'], 'photo.jpg', { type: 'image/jpeg' }),
          categories: ['風景'],
          position: { lat: 35.6585, lng: 139.7454 },
          deviceType: 1,
        }).catch(() => {})
      }}
    >
      stub-submit
    </button>
  ),
}))

vi.mock('./utils/stripExif', () => ({
  stripExif: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
}))

vi.mock('./utils/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils/apiClient')>()
  return {
    ...actual,
    getPhotoUploadUrl: vi.fn(),
    uploadFileToS3: vi.fn(),
    createPhoto: vi.fn(),
  }
})

const PHOTO_ID = 123
const POLLING_INTERVAL_MS = 2000
const MAX_POLLING_COUNT = 15

/** バックエンドの POST /photos の実際の応答の形（PhotoResponse.java の @JsonProperty に合わせる） */
const CREATE_PHOTO_RESPONSE: PhotoResponse = {
  photo: {
    photo_id: PHOTO_ID,
    image_url: 'https://cdn.example.com/uploads/1/photo.jpg',
    shot_at: '2026-11-15T10:00:00',
    weather: null,
    is_favorited: false,
    favorite_count: 0,
    moderation_status: MODERATION_STATUS_PENDING_REVIEW,
  },
  spot: { spot_id: 45, latitude: 35.6585, longitude: 139.7454 },
  user: { user_id: 1, username: 'testuser' },
}

let moderationStatus = MODERATION_STATUS_PENDING_REVIEW
const fetchMock = vi.fn((url: string) => {
  if (typeof url === 'string' && url.endsWith(`/photos/${PHOTO_ID}/status`)) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ photo_id: String(PHOTO_ID), moderation_status: moderationStatus }),
    } as Response)
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
})

function statusRequestCount() {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith(`/photos/${PHOTO_ID}/status`)).length
}

/**
 * 時計を進め、確認処理（fetch → json → toast）の Promise も流し切る。
 * act() で包むと、偽のタイマーのもとで act の後始末が終わらず止まってしまうため、包まない。
 */
async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
}

async function renderAndSubmitPhoto() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  )
  // スプラッシュ画面を抜ける（Issue#156: ピン待ち上限まで進めて確実に解除する）
  act(() => {
    vi.advanceTimersByTime(INITIAL_SPOTS_SPLASH_TIMEOUT_MS)
  })

  fireEvent.click(screen.getByRole('button', { name: /投稿/i }))
  fireEvent.click(await screen.findByRole('button', { name: 'stub-submit' }))

  await waitFor(() => expect(createPhoto).toHaveBeenCalledTimes(1))
}

describe('App - Spec#54: 投稿後の審査状態のお知らせ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    moderationStatus = MODERATION_STATUS_PENDING_REVIEW
    global.fetch = fetchMock as unknown as typeof fetch
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'auth_token') return 'fake-token'
      if (key === 'auth_user') {
        return JSON.stringify({ userId: 1, email: 'test@example.com', username: 'testuser', role: 'user' })
      }
      return null
    })
    vi.mocked(sessionStorage.getItem).mockReturnValue(null)
    vi.mocked(getPhotoUploadUrl).mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      objectKey: 'uploads/1/photo.jpg',
    })
    vi.mocked(uploadFileToS3).mockResolvedValue(undefined)
    vi.mocked(createPhoto).mockResolvedValue(CREATE_PHOTO_RESPONSE)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('photo.photo_id を使って /photos/{id}/status を確かめ、公開されたらお知らせを出す', async () => {
    await renderAndSubmitPhoto()
    expect(statusRequestCount()).toBe(0)

    // 1回目: まだ審査中 → お知らせは出ない
    await advance(POLLING_INTERVAL_MS)
    expect(statusRequestCount()).toBe(1)
    expect(toast.success).not.toHaveBeenCalled()

    // 2回目: 公開済み → 「写真が公開されました」
    moderationStatus = MODERATION_STATUS_PUBLISHED
    await advance(POLLING_INTERVAL_MS)
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('写真が公開されました'))
    expect(statusRequestCount()).toBe(2)
    // 公開されたら地図のピンを取り直す
    expect(mockRefreshSpots).toHaveBeenLastCalledWith({ bypassCache: true })

    // 確認はそこで止まる
    await advance(POLLING_INTERVAL_MS * 3)
    expect(statusRequestCount()).toBe(2)
  })

  it('確認の途中で言語を切り替えても、切り替え後の言語でお知らせを出す', async () => {
    await renderAndSubmitPhoto()

    // 1回目: まだ審査中
    await advance(POLLING_INTERVAL_MS)
    expect(statusRequestCount()).toBe(1)

    // 言語の切り替えで画面全体が描き直されるので act で包む（偽のタイマーのもとで止まらないよう、同期の act にする）
    act(() => {
      void i18n.changeLanguage('en')
    })
    try {
      moderationStatus = MODERATION_STATUS_PUBLISHED
      await advance(POLLING_INTERVAL_MS)
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Your photo has been published'))
      expect(toast.success).not.toHaveBeenCalledWith('写真が公開されました')
    } finally {
      act(() => {
        void i18n.changeLanguage('ja')
      })
    }
  })

  it('隔離されたらコンテンツポリシー違反の可能性をお知らせする', async () => {
    moderationStatus = MODERATION_STATUS_QUARANTINED
    await renderAndSubmitPhoto()

    await advance(POLLING_INTERVAL_MS)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('写真がコンテンツポリシーに違反している可能性があります')
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('最大回数まで審査中のままなら、審査中であることをお知らせして確認をやめる', async () => {
    await renderAndSubmitPhoto()

    await advance(POLLING_INTERVAL_MS * (MAX_POLLING_COUNT + 1))
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith('写真は審査中です。審査完了後に公開されます。')
    )
    expect(statusRequestCount()).toBe(MAX_POLLING_COUNT)

    await advance(POLLING_INTERVAL_MS * 3)
    expect(statusRequestCount()).toBe(MAX_POLLING_COUNT)
  })
})
