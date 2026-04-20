import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LinkAccountConfirmDialog from './LinkAccountConfirmDialog'

const mockFetch = vi.fn()

function renderDialog(overrides?: {
  onClose?: () => void
  onLinked?: (token: string, email: string) => void
  provider?: string
}) {
  return render(
    <LinkAccountConfirmDialog
      open={true}
      linkConfirmationToken="abc123"
      provider={overrides?.provider ?? 'GOOGLE'}
      onClose={overrides?.onClose ?? vi.fn()}
      onLinked={overrides?.onLinked ?? vi.fn()}
    />
  )
}

describe('LinkAccountConfirmDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
  })

  it('タイトルと provider を含む説明文を表示する（Google）', () => {
    renderDialog({ provider: 'GOOGLE' })
    expect(screen.getByText('既存アカウントとの連携確認')).toBeInTheDocument()
    expect(screen.getByText(/Google/)).toBeInTheDocument()
  })

  it('provider=LINE は説明文に LINE と表示', () => {
    renderDialog({ provider: 'LINE' })
    expect(screen.getByText(/LINE/)).toBeInTheDocument()
  })

  it('「連携する」クリックで POST /auth/oauth2/confirm-link を呼び token を送信', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ token: 'new.jwt.abc', email: 'alice@example.com' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    const onLinked = vi.fn()
    const onClose = vi.fn()
    renderDialog({ onLinked, onClose })

    await userEvent.click(screen.getByRole('button', { name: '連携する' }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain('/auth/oauth2/confirm-link')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ token: 'abc123' })

    await waitFor(() => {
      expect(onLinked).toHaveBeenCalledWith('new.jwt.abc', 'alice@example.com')
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('API エラー時はエラーメッセージを表示し onClose/onLinked は呼ばれない', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: '期限切れのトークンです' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const onLinked = vi.fn()
    const onClose = vi.fn()
    renderDialog({ onLinked, onClose })

    await userEvent.click(screen.getByRole('button', { name: '連携する' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/期限切れ/)
    })
    expect(onLinked).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('「キャンセル」クリックで onClose のみ呼ばれる', async () => {
    const onClose = vi.fn()
    const onLinked = vi.fn()
    renderDialog({ onClose, onLinked })

    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(onClose).toHaveBeenCalled()
    expect(onLinked).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
