import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UsernameSetupDialog from './UsernameSetupDialog'
import { AuthProvider } from '../contexts/AuthContext'

const mockFetch = vi.fn()

function renderDialog(overrides?: {
  initialUsername?: string
  onClose?: () => void
  onUpdated?: (name: string) => void
}) {
  return render(
    <AuthProvider>
      <UsernameSetupDialog
        open={true}
        initialUsername={overrides?.initialUsername ?? 'user_abc1234'}
        onClose={overrides?.onClose ?? vi.fn()}
        onUpdated={overrides?.onUpdated}
      />
    </AuthProvider>
  )
}

describe('UsernameSetupDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
    // 認証済み状態をシミュレート（JWT の exp は 2033 年、AuthProvider の期限チェックを通過）
    const validJwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhQGIuY29tIiwiZXhwIjoyMDAwMDAwMDAwfQ.jwt.test.value'
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'auth_token') return validJwt
      if (key === 'auth_user')
        return JSON.stringify({
          userId: 1,
          username: 'user_abc1234',
          email: 'a@b.com',
          role: 101,
          language: 'ja',
        })
      return null
    })
  })

  it('ダイアログタイトルと初期表示名が表示される', () => {
    renderDialog({ initialUsername: 'user_abc1234' })
    expect(screen.getByText('表示名を設定')).toBeInTheDocument()
    const input = screen.getByLabelText('表示名') as HTMLInputElement
    expect(input.value).toBe('user_abc1234')
  })

  it('空欄のときは確定ボタンが無効化される', async () => {
    renderDialog({ initialUsername: '' })
    const saveButton = screen.getByRole('button', { name: '確定する' })
    expect(saveButton).toBeDisabled()
  })

  it('確定ボタンクリックで PUT /users/me/username を呼ぶ', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ username: 'alice' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const onUpdated = vi.fn()
    const onClose = vi.fn()
    renderDialog({ initialUsername: 'alice', onUpdated, onClose })

    await userEvent.click(screen.getByRole('button', { name: '確定する' }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain('/users/me/username')
    expect(options.method).toBe('PUT')
    // fetchJson は Headers オブジェクトを使う
    expect((options.headers as Headers).get('Authorization')).toMatch(/^Bearer /)
    expect(JSON.parse(options.body)).toEqual({ username: 'alice' })

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith('alice')
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('API エラー時はエラーメッセージが表示され onClose は呼ばれない', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'USERNAME_TAKEN' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const onClose = vi.fn()
    renderDialog({ initialUsername: 'alice', onClose })

    await userEvent.click(screen.getByRole('button', { name: '確定する' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/USERNAME_TAKEN/)
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('「後で設定する」クリックで onClose のみ呼ばれる', async () => {
    const onClose = vi.fn()
    renderDialog({ onClose })

    await userEvent.click(screen.getByRole('button', { name: '後で設定する' }))

    expect(onClose).toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
