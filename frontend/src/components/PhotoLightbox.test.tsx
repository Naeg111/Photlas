import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PhotoLightbox } from './PhotoLightbox'
import { toast } from 'sonner'
import i18n from '../i18n'

/**
 * PhotoLightbox コンポーネントのテスト
 * Spec#27: パネル・ダイアログ群の移行
 * Spec#88: ローディング表示テスト追加
 *
 * 写真を全画面で拡大表示するライトボックス
 */

// motion/react のモック
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Spec#65: sonnerのモック
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// jsdom は URL.createObjectURL をサポートしないためモック
let objectUrlCounter = 0
if (!URL.createObjectURL) {
  URL.createObjectURL = () => ''
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {}
}
vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
  return `blob:http://localhost/mock-${++objectUrlCounter}`
})
vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

/**
 * fetch をモックして画像Blobを即座に返すヘルパー
 */
function mockFetchImmediate() {
  const blob = new Blob(['fake-image'], { type: 'image/jpeg' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(blob, { headers: { 'Content-Length': String(blob.size) } })
  ))
}

describe('PhotoLightbox', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    imageUrl: 'https://example.com/photo.jpg',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchImmediate()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Spec#93 追加対応: 言語の切り替え', () => {
    afterEach(async () => {
      await act(async () => {
        await i18n.changeLanguage('ja')
      })
    })

    it('開いている間に言語が切り替わっても、画像を取り直さない', async () => {
      render(<PhotoLightbox {...defaultProps} />)
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

      await act(async () => {
        await i18n.changeLanguage('en')
      })

      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('読み込みに失敗したら、今の言語でお知らせを出す', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
      await act(async () => {
        await i18n.changeLanguage('en')
      })

      render(<PhotoLightbox {...defaultProps} />)

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Failed to load image. Please close and open it again.')
      )
    })
  })

  describe('UI Elements - UI要素', () => {
    it('renders lightbox when open prop is true', async () => {
      render(<PhotoLightbox {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByAltText('フルサイズ写真')).toBeInTheDocument()
      })
    })

    it('does not render lightbox when open prop is false', () => {
      render(<PhotoLightbox {...defaultProps} open={false} />)

      expect(screen.queryByAltText('フルサイズ写真')).not.toBeInTheDocument()
    })

    it('renders close button', () => {
      render(<PhotoLightbox {...defaultProps} />)

      // Xアイコンの閉じるボタン
      const closeButton = screen.getByRole('button')
      expect(closeButton).toBeInTheDocument()
    })

    it('renders image with provided URL', async () => {
      render(<PhotoLightbox {...defaultProps} />)

      await waitFor(() => {
        const image = screen.getByAltText('フルサイズ写真')
        // Spec#88: BlobURLで表示されるため、src属性はblob:で始まる
        expect(image).toHaveAttribute('src', expect.stringContaining('blob:'))
      })
    })

    it('renders zoom percentage display', () => {
      render(<PhotoLightbox {...defaultProps} />)

      expect(screen.getByText(/拡大:/)).toBeInTheDocument()
      expect(screen.getByText(/100%/)).toBeInTheDocument()
    })
  })

  describe('User Interactions - ユーザー操作', () => {
    it('calls onOpenChange(false) when close button is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoLightbox {...defaultProps} />)

      const closeButton = screen.getByRole('button')
      await user.click(closeButton)

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })

    it('calls onOpenChange(false) when background is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoLightbox {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByAltText('フルサイズ写真')).toBeInTheDocument()
      })

      // 背景（黒い部分）をクリック
      const background = screen.getByAltText('フルサイズ写真').parentElement?.parentElement?.parentElement
      if (background) {
        await user.click(background)
      }

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  // ===== Spec#88: ローディング表示テスト =====
  describe('Spec#88: オリジナル画像ローディング表示', () => {
    it('画像読み込み中にローディング画面が表示される（200ms超過時）', async () => {
      // fetch をモックして遅延させる（ReadableStreamで進捗取得を想定）
      const mockFetch = vi.fn().mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve(new Response(new Blob(['fake-image-data']), {
              headers: { 'Content-Length': '1000000' },
            }))
          }, 500)
        })
      )
      vi.stubGlobal('fetch', mockFetch)

      render(<PhotoLightbox {...defaultProps} />)

      // 200ms超過後にローディング画面（Photlasアイコン＋プログレスバー）が表示される
      await new Promise(r => setTimeout(r, 300))
      expect(screen.queryByTestId('lightbox-loading')).toBeInTheDocument()

      vi.unstubAllGlobals()
    })

    it('ローディング画面にプログレスバーが表示される', async () => {
      const mockFetch = vi.fn().mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve(new Response(new Blob(['fake-image-data']), {
              headers: { 'Content-Length': '1000000' },
            }))
          }, 500)
        })
      )
      vi.stubGlobal('fetch', mockFetch)

      render(<PhotoLightbox {...defaultProps} />)

      await new Promise(r => setTimeout(r, 300))
      expect(screen.queryByTestId('lightbox-progress-bar')).toBeInTheDocument()

      vi.unstubAllGlobals()
    })
  })

  describe('Zoom Functionality - ズーム機能', () => {
    it('changes zoom level on wheel scroll', async () => {
      render(<PhotoLightbox {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByAltText('フルサイズ写真')).toBeInTheDocument()
      })

      // 初期状態は100%
      expect(screen.getByText('拡大: 100%')).toBeInTheDocument()

      const imageContainer = screen.getByAltText('フルサイズ写真').parentElement?.parentElement

      if (imageContainer) {
        // ホイールスクロールでズームイン（deltaY < 0）
        fireEvent.wheel(imageContainer, { deltaY: -100 })
      }

      // ZOOM_DELTA=0.1でズームインし、110%になることを確認
      expect(screen.getByText('拡大: 110%')).toBeInTheDocument()
    })
  })

  describe('Spec#93 追加対応: 表示言語', () => {
    it('英語の設定では、拡大率と写真の代替テキストが英語になる', async () => {
      await i18n.changeLanguage('en')
      try {
        render(<PhotoLightbox {...defaultProps} />)

        await waitFor(() => {
          expect(screen.getByAltText('Full-size photo')).toBeInTheDocument()
        })
        expect(screen.getByText('Zoom: 100%')).toBeInTheDocument()
        expect(screen.queryByText(/拡大:/)).not.toBeInTheDocument()
      } finally {
        await i18n.changeLanguage('ja')
      }
    })
  })
})
