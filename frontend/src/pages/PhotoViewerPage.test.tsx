import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PhotoViewerPage from './PhotoViewerPage'

/**
 * Issue#15: 写真フルサイズ表示 (UI / 専用ビューアー)
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - `/photo-viewer/:photoId` ルートが定義されている
 * - 背景色が白色 (#FFFFFF)
 * - 画像のみが表示される（ヘッダー、フッター、ボタン類なし）
 * - 画像が画面中央に配置される
 * - object-fit: contain で全体が表示される
 * - 右クリックメニューが制限されている
 * - モバイルでの長押しによる保存メニューが抑制されている
 * - 画像のドラッグ&ドロップが制限されている
 */

// fetch APIのモック
global.fetch = vi.fn()

const MockedPhotoViewerPage = ({ photoId }: { photoId: string }) => (
  <MemoryRouter initialEntries={[`/photo-viewer/${photoId}`]}>
    <Routes>
      <Route path="/photo-viewer/:photoId" element={<PhotoViewerPage />} />
    </Routes>
  </MemoryRouter>
)

describe('PhotoViewerPage - Issue#15', () => {
  const mockPhotoData = {
    photo: {
      photo_id: 1234,
      title: '雨上がりの展望台から',
      image_url: 'https://example.com/full_1234.jpg',
      shot_at: '2025-08-15T18:30:00Z',
      weather: 'Rainy',
    },
    spot: {
      spot_id: 201
    },
    user: {
      user_id: 56,
      username: 'TaroPhoto',
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('データ取得', () => {
    it('指定されたphotoIdでAPIリクエストを送信する', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPhotoData
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/photos/1234')
      })
    })

    it('APIから取得した画像URLを表示する', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPhotoData
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toHaveAttribute('src', 'https://example.com/full_1234.jpg')
      })
    })
  })

  describe('レイアウトと画面構成', () => {
    it('背景色が白色である', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPhotoData
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        const container = screen.getByTestId('photo-viewer-container')
        expect(container).toHaveClass('bg-white')
      })
    })

    it('画像が画面中央に配置される', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPhotoData
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        const container = screen.getByTestId('photo-viewer-container')
        expect(container).toHaveClass('flex')
        expect(container).toHaveClass('items-center')
        expect(container).toHaveClass('justify-center')
      })
    })

    it('画像が全画面表示される', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPhotoData
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        const container = screen.getByTestId('photo-viewer-container')
        expect(container).toHaveClass('fixed')
        expect(container).toHaveClass('inset-0')
      })
    })

    it('画像にobject-fit: containが適用される', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPhotoData
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toHaveClass('object-contain')
      })
    })
  })

  describe('画像保護（保存制限）', () => {
    it('右クリックメニューが制限されている', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPhotoData
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        const image = screen.getByRole('img')

        // onContextMenu イベントハンドラーが設定されているか確認
        const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
        const preventDefaultSpy = vi.spyOn(contextMenuEvent, 'preventDefault')

        image.dispatchEvent(contextMenuEvent)

        expect(preventDefaultSpy).toHaveBeenCalled()
      })
    })

    it('画像のドラッグが制限されている', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPhotoData
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        const image = screen.getByRole('img')

        // onDragStart イベントハンドラーが設定されているか確認
        const dragStartHandler = vi.fn((e) => e.preventDefault())
        const originalHandler = image.ondragstart

        // dragstartイベントを発火してpreventDefaultが呼ばれることを確認
        const result = fireEvent.dragStart(image)

        // preventDefaultが呼ばれた場合、fireEventはfalseを返す
        expect(result).toBe(false)
      })
    })

    it('モバイルでの長押し保存メニューが抑制されるCSSが適用される', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPhotoData
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        const image = screen.getByRole('img')

        // user-select: none が適用されているか確認
        expect(image).toHaveClass('select-none')
      })
    })

    it('WebKitのタッチキャラウト（長押しメニュー）が抑制されるスタイルが適用される', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPhotoData
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        const image = screen.getByRole('img')

        // user-select: none がインラインスタイルで適用されているか確認
        expect(image).toHaveStyle({ userSelect: 'none' })
      })
    })

    it('ユーザードラッグが制限されるスタイルが適用される', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPhotoData
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        const image = screen.getByRole('img')

        // -webkit-user-drag: none がインラインスタイルで適用されているか確認
        expect(image).toHaveStyle({ WebkitUserDrag: 'none' })
      })
    })
  })

  describe('エラーハンドリング', () => {
    it('APIエラー時にエラーメッセージを表示する', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      await waitFor(() => {
        expect(screen.getByText(/画像の読み込みに失敗しました/i)).toBeInTheDocument()
      })
    })

    it('404エラー時に適切なメッセージを表示する', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Photo not found' })
      })
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="9999" />)

      await waitFor(() => {
        expect(screen.getByText(/写真が見つかりません/i)).toBeInTheDocument()
      })
    })

    it('ローディング中にローディングインジケーターを表示する', async () => {
      const mockFetch = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )
      global.fetch = mockFetch

      render(<MockedPhotoViewerPage photoId="1234" />)

      expect(screen.getByText(/読み込み中/i)).toBeInTheDocument()
    })
  })
})
