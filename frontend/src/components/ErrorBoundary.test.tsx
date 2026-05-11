import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary, isChunkLoadError } from './ErrorBoundary'

// Sentryモック
vi.mock('@sentry/react', () => ({
  withScope: vi.fn((callback) => callback({ setExtra: vi.fn() })),
  captureException: vi.fn(),
}))

// エラーを投げるテストコンポーネント
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>正常なコンテンツ</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('正常時は子コンポーネントがレンダリングされる', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('正常なコンテンツ')).toBeInTheDocument()
  })

  it('エラー発生時にフォールバックUIが表示される', () => {
    // React ErrorBoundaryのconsole.errorを抑制
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    expect(screen.getByText('予期しないエラーが発生しました。ページを再読み込みしてください。')).toBeInTheDocument()
    expect(screen.getByText('ページを再読み込み')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('再読み込みボタンをクリックするとlocation.reloadが呼ばれる', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    })

    const user = userEvent.setup()

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    await user.click(screen.getByText('ページを再読み込み'))
    expect(reloadMock).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('エラー発生時にSentryにエラーが報告される', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { captureException } = await import('@sentry/react')

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(captureException).toHaveBeenCalledWith(expect.any(Error))

    consoleSpy.mockRestore()
  })

  describe('Issue#130 - ChunkLoadError 自動リロード', () => {
    let reloadMock: ReturnType<typeof vi.fn>
    let setItemMock: ReturnType<typeof vi.fn>
    let getItemMock: ReturnType<typeof vi.fn>
    let consoleSpy: ReturnType<typeof vi.spyOn>

    function ThrowSpecificError({ message, name }: { message: string; name?: string }): null {
      const error = new Error(message)
      if (name) error.name = name
      throw error
    }

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
      })

      setItemMock = vi.fn()
      getItemMock = vi.fn().mockReturnValue(null)
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: {
          getItem: getItemMock,
          setItem: setItemMock,
          removeItem: vi.fn(),
          clear: vi.fn(),
          key: vi.fn(),
          length: 0,
        },
        writable: true,
        configurable: true,
      })
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    it('name が ChunkLoadError のエラーで自動リロードされる', () => {
      render(
        <ErrorBoundary>
          <ThrowSpecificError message="boom" name="ChunkLoadError" />
        </ErrorBoundary>
      )

      expect(setItemMock).toHaveBeenCalledWith('photlas:chunk-error-reloaded', '1')
      expect(reloadMock).toHaveBeenCalled()
    })

    it('"Loading chunk N failed" メッセージで自動リロードされる', () => {
      render(
        <ErrorBoundary>
          <ThrowSpecificError message="Loading chunk 12 failed." />
        </ErrorBoundary>
      )

      expect(reloadMock).toHaveBeenCalled()
    })

    it('"Failed to fetch dynamically imported module" メッセージで自動リロードされる', () => {
      render(
        <ErrorBoundary>
          <ThrowSpecificError message="Failed to fetch dynamically imported module: /assets/foo.js" />
        </ErrorBoundary>
      )

      expect(reloadMock).toHaveBeenCalled()
    })

    it('既にセッション中にリロード済みなら自動リロードせず、フォールバック UI を表示する', () => {
      getItemMock.mockReturnValue('1')

      render(
        <ErrorBoundary>
          <ThrowSpecificError message="Loading chunk 12 failed." />
        </ErrorBoundary>
      )

      expect(reloadMock).not.toHaveBeenCalled()
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })

    it('通常のエラーでは自動リロードしない', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(reloadMock).not.toHaveBeenCalled()
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })

    it('ChunkLoadError 自動リロード時は Sentry に通知しない', async () => {
      const { captureException } = await import('@sentry/react')
      vi.mocked(captureException).mockClear()

      render(
        <ErrorBoundary>
          <ThrowSpecificError message="boom" name="ChunkLoadError" />
        </ErrorBoundary>
      )

      expect(reloadMock).toHaveBeenCalled()
      expect(captureException).not.toHaveBeenCalled()
    })
  })

  describe('Issue#130 - isChunkLoadError ヘルパー', () => {
    it('name が ChunkLoadError ならば true', () => {
      const error = new Error('any message')
      error.name = 'ChunkLoadError'
      expect(isChunkLoadError(error)).toBe(true)
    })

    it('"Loading chunk N failed" メッセージなら true', () => {
      expect(isChunkLoadError(new Error('Loading chunk 42 failed.'))).toBe(true)
    })

    it('"Failed to fetch dynamically imported module" メッセージなら true', () => {
      expect(
        isChunkLoadError(new Error('Failed to fetch dynamically imported module: /a.js'))
      ).toBe(true)
    })

    it('通常のエラーメッセージなら false', () => {
      expect(isChunkLoadError(new Error('Cannot read property of undefined'))).toBe(false)
    })

    it('大文字小文字を区別せず判定する', () => {
      expect(isChunkLoadError(new Error('LOADING CHUNK 7 FAILED'))).toBe(true)
    })
  })
})
