import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'

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
})
