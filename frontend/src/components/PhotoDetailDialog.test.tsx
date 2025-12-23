import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import PhotoDetailDialog from './PhotoDetailDialog'

/**
 * Issue#14: 写真詳細表示 (UI + API)
 * TDD Red段階のテストコード
 */

describe('PhotoDetailDialog Component - Issue#14', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基本表示とAPI連携', () => {
    it('ダイアログが開かれたとき、スポット写真一覧APIを呼び出す', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [1234, 5678, 9012],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            photoId: 1234,
            title: 'Test Photo',
            imageUrls: {
              thumbnail: 'https://example.com/thumb.jpg',
              standard: 'https://example.com/standard.jpg',
              original: 'https://example.com/original.jpg',
            },
            shotAt: '2024-01-15T14:30:00',
            weather: '晴れ',
            timeOfDay: 'DAY',
            subjectCategory: 'LANDSCAPE',
            cameraInfo: {
              body: 'Canon EOS R5',
              lens: 'RF 24-70mm f/2.8L',
              fValue: 'f/2.8',
              shutterSpeed: '1/1000',
              iso: '400',
            },
            user: {
              userId: 1,
              username: 'testuser',
              profileImageUrl: 'https://example.com/profile.jpg',
              snsLinks: {
                twitter: 'https://twitter.com/testuser',
                instagram: 'https://instagram.com/testuser',
              },
            },
            spot: {
              spotId: 100,
            },
          }),
        })
      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      render(<PhotoDetailDialog open={true} spotId={100} onClose={() => {}} />)

      await waitFor(() => {
        // /api/v1/spots/{spotId}/photos が呼ばれる
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/spots/100/photos'),
          expect.any(Object)
        )
      })

      await waitFor(() => {
        // /api/v1/photos/{photoId} が呼ばれる
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/photos/1234'),
          expect.any(Object)
        )
      })
    })

    it('写真詳細情報が正しく表示される', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [1234],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            photoId: 1234,
            title: 'Beautiful Landscape',
            imageUrls: {
              thumbnail: 'https://example.com/thumb.jpg',
              standard: 'https://example.com/standard.jpg',
              original: 'https://example.com/original.jpg',
            },
            shotAt: '2024-01-15T14:30:00',
            weather: '晴れ',
            timeOfDay: 'DAY',
            subjectCategory: 'LANDSCAPE',
            cameraInfo: {
              body: 'Canon EOS R5',
              lens: 'RF 24-70mm f/2.8L',
              fValue: 'f/2.8',
              shutterSpeed: '1/1000',
              iso: '400',
            },
            user: {
              userId: 1,
              username: 'testuser',
              profileImageUrl: 'https://example.com/profile.jpg',
            },
            spot: {
              spotId: 100,
            },
          }),
        })

      const { rerender } = render(<PhotoDetailDialog open={false} spotId={100} onClose={() => {}} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={100} onClose={() => {}} />)

      // 写真タイトルが表示される
      await waitFor(() => {
        expect(screen.getByText('Beautiful Landscape')).toBeInTheDocument()
      })

      // カメラ情報が表示される
      expect(screen.getByText(/Canon EOS R5/)).toBeInTheDocument()
      expect(screen.getByText(/RF 24-70mm f\/2.8L/)).toBeInTheDocument()
      expect(screen.getByText('f/2.8')).toBeInTheDocument()
      expect(screen.getByText('1/1000')).toBeInTheDocument()
      expect(screen.getByText('400')).toBeInTheDocument()

      // ユーザー名が表示される
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })
  })

  describe('カルーセル制御', () => {
    it('複数の写真がある場合、ドットインジケーターが表示される', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [1234, 5678, 9012],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            photoId: 1234,
            title: 'Photo 1',
            imageUrls: {
              standard: 'https://example.com/photo1.jpg',
            },
            user: { userId: 1, username: 'user1' },
            spot: { spotId: 100 },
          }),
        })

      const { rerender } = render(<PhotoDetailDialog open={false} spotId={100} onClose={() => {}} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      rerender(<PhotoDetailDialog open={true} spotId={100} onClose={() => {}} />)

      await waitFor(() => {
        const indicators = screen.queryAllByTestId(/^dot-indicator-/)
        expect(indicators).toHaveLength(3)
      })
    })

    it('スワイプ操作で次の写真に移動する', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [1234, 5678],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            photoId: 1234,
            title: 'Photo 1',
            imageUrls: { standard: 'https://example.com/photo1.jpg' },
            user: { userId: 1, username: 'user1' },
            spot: { spotId: 100 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            photoId: 5678,
            title: 'Photo 2',
            imageUrls: { standard: 'https://example.com/photo2.jpg' },
            user: { userId: 1, username: 'user1' },
            spot: { spotId: 100 },
          }),
        })

      const { rerender } = render(<PhotoDetailDialog open={false} spotId={100} onClose={() => {}} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotId={100} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Photo 1')).toBeInTheDocument()
      })

      // 次へボタンをクリック
      const nextButton = screen.getByLabelText('次の写真')
      await user.click(nextButton)

      // 2枚目の写真詳細APIが呼ばれたことを確認
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/photos/5678'),
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

      render(<PhotoDetailDialog open={true} spotId={100} onClose={() => {}} />)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('APIエラー時にエラーメッセージが表示される', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      render(<PhotoDetailDialog open={true} spotId={100} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(/読み込みに失敗しました/)).toBeInTheDocument()
      })
    })
  })

  describe('ダイアログ制御', () => {
    it('openがfalseの場合、ダイアログは表示されない', () => {
      render(<PhotoDetailDialog open={false} spotId={100} onClose={() => {}} />)

      expect(screen.queryByTestId('photo-detail-dialog')).not.toBeInTheDocument()
    })

    it('閉じるボタンをクリックするとonCloseが呼ばれる', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [1234],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            photoId: 1234,
            title: 'Test',
            imageUrls: { standard: 'https://example.com/photo.jpg' },
            user: { userId: 1, username: 'user1' },
            spot: { spotId: 100 },
          }),
        })

      const onClose = vi.fn()
      const { rerender } = render(<PhotoDetailDialog open={false} spotId={100} onClose={onClose} />)

      Object.defineProperty(globalThis, 'fetch', {
        value: mockFetch,
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      rerender(<PhotoDetailDialog open={true} spotId={100} onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument()
      })

      const closeButton = screen.getByLabelText('閉じる')
      await user.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })
  })
})
