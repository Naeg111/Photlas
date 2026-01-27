import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ProfileImageCropper from './ProfileImageCropper'

/**
 * Issue#35: プロフィール画像トリミング機能
 * TDD Red段階: ProfileImageCropperコンポーネントのテストケース定義
 *
 * 機能要件:
 * - トリミングモーダルの表示
 * - 1:1アスペクト比のトリミング枠
 * - 確定・キャンセル操作
 * - 300x300pxへのリサイズ出力
 */

// Canvas APIのモック
const mockToBlob = vi.fn((callback: (blob: Blob | null) => void) => {
  callback(new Blob(['test'], { type: 'image/jpeg' }))
})

const mockGetContext = vi.fn(() => ({
  drawImage: vi.fn(),
}))

// オリジナルのCanvas/Imageメソッドを保存
const originalToBlob = HTMLCanvasElement.prototype.toBlob
const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalImage = global.Image

// HTMLCanvasElement.prototype.toBlobとgetContextをモック
beforeEach(() => {
  HTMLCanvasElement.prototype.toBlob = mockToBlob as unknown as typeof HTMLCanvasElement.prototype.toBlob
  HTMLCanvasElement.prototype.getContext = mockGetContext as unknown as typeof HTMLCanvasElement.prototype.getContext

  // Imageのモック（@radix-ui/react-avatarとの互換性のためaddEventListenerを追加）
  Object.defineProperty(global, 'Image', {
    value: class {
      crossOrigin = ''
      src = ''
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      listeners: Record<string, Array<() => void>> = {}

      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }

      addEventListener(event: string, callback: () => void) {
        if (!this.listeners[event]) {
          this.listeners[event] = []
        }
        this.listeners[event].push(callback)
      }

      removeEventListener(event: string, callback: () => void) {
        if (this.listeners[event]) {
          this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
        }
      }
    },
    writable: true,
  })
})

// テスト後にオリジナルを復元
afterEach(() => {
  HTMLCanvasElement.prototype.toBlob = originalToBlob
  HTMLCanvasElement.prototype.getContext = originalGetContext
  Object.defineProperty(global, 'Image', {
    value: originalImage,
    writable: true,
  })
})

// react-easy-cropのモック
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

describe('ProfileImageCropper', () => {
  const mockOnCropComplete = vi.fn()
  const mockOnCancel = vi.fn()
  const testImageSrc = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基本表示', () => {
    it('トリミングモーダルが表示される', () => {
      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByTestId('cropper-modal')).toBeInTheDocument()
    })

    it('画像がプレビュー表示される', () => {
      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByTestId('cropper-component')).toBeInTheDocument()
    })

    it('「確定」ボタンが表示される', () => {
      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByRole('button', { name: /確定/i })).toBeInTheDocument()
    })

    it('「キャンセル」ボタンが表示される', () => {
      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByRole('button', { name: /キャンセル/i })).toBeInTheDocument()
    })

    it('ズームスライダーが表示される', () => {
      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByTestId('zoom-slider')).toBeInTheDocument()
    })
  })

  describe('操作', () => {
    it('「キャンセル」ボタンをクリックするとonCancelが呼ばれる', async () => {
      const user = userEvent.setup()

      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /キャンセル/i })
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('「確定」ボタンをクリックするとトリミング処理が実行される', async () => {
      const user = userEvent.setup()

      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      // Cropperのモックでトリミング領域を設定
      const mockCropTrigger = screen.getByTestId('mock-crop-trigger')
      await user.click(mockCropTrigger)

      // 確定ボタンをクリック
      const confirmButton = screen.getByRole('button', { name: /確定/i })
      await user.click(confirmButton)

      // onCropCompleteがBlobで呼び出されることを確認
      await waitFor(() => {
        expect(mockOnCropComplete).toHaveBeenCalledWith(expect.any(Blob))
      })
    })

    it('ズームスライダーを操作するとズームレベルが変わる', async () => {
      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      const slider = screen.getByTestId('zoom-slider')
      fireEvent.change(slider, { target: { value: '2' } })

      expect(slider).toHaveValue('2')
    })
  })

  describe('バリデーション', () => {
    it('トリミング領域が設定されていない場合、確定ボタンがdisabledになる', () => {
      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      const confirmButton = screen.getByRole('button', { name: /確定/i })
      expect(confirmButton).toBeDisabled()
    })

    it('トリミング領域が設定されると確定ボタンがenabledになる', async () => {
      const user = userEvent.setup()

      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      // Cropperのモックでトリミング領域を設定
      const mockCropTrigger = screen.getByTestId('mock-crop-trigger')
      await user.click(mockCropTrigger)

      const confirmButton = screen.getByRole('button', { name: /確定/i })
      expect(confirmButton).not.toBeDisabled()
    })
  })

  describe('処理中状態', () => {
    it('トリミング処理中はローディング表示される', async () => {
      const user = userEvent.setup()

      // 遅延するモック
      mockOnCropComplete.mockImplementation(() => new Promise(() => {}))

      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      // Cropperのモックでトリミング領域を設定
      const mockCropTrigger = screen.getByTestId('mock-crop-trigger')
      await user.click(mockCropTrigger)

      // 確定ボタンをクリック
      const confirmButton = screen.getByRole('button', { name: /確定/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByTestId('cropper-loading')).toBeInTheDocument()
      })
    })

    it('処理中はボタンがdisabledになる', async () => {
      const user = userEvent.setup()

      // 遅延するモック
      mockOnCropComplete.mockImplementation(() => new Promise(() => {}))

      render(
        <ProfileImageCropper
          imageSrc={testImageSrc}
          onCropComplete={mockOnCropComplete}
          onCancel={mockOnCancel}
        />
      )

      // Cropperのモックでトリミング領域を設定
      const mockCropTrigger = screen.getByTestId('mock-crop-trigger')
      await user.click(mockCropTrigger)

      // 確定ボタンをクリック
      const confirmButton = screen.getByRole('button', { name: /確定/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(confirmButton).toBeDisabled()
        expect(screen.getByRole('button', { name: /キャンセル/i })).toBeDisabled()
      })
    })
  })
})
