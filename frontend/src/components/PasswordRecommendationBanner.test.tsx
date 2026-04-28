import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PasswordRecommendationBanner from './PasswordRecommendationBanner'
import { AuthProvider } from '../contexts/AuthContext'

const mockFetch = vi.fn()

function renderBanner(onOpen?: () => void) {
  return render(
    <AuthProvider>
      <PasswordRecommendationBanner onOpenPasswordSection={onOpen} />
    </AuthProvider>
  )
}

describe('PasswordRecommendationBanner', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
    // 認証済み状態をシミュレート（JWT の exp は 2033 年、AuthProvider の期限チェックを通過）
    const validJwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhQGIuY29tIiwiZXhwIjoyMDAwMDAwMDAwfQ.sig'
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'auth_token') return validJwt
      if (key === 'auth_user')
        return JSON.stringify({
          userId: 1,
          username: 'alice',
          email: 'a@b.com',
          role: 101,
          language: 'ja',
        })
      return null
    })
  })

  it('shouldRecommend=true のときバナーを表示（タイトル + CTA）', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ shouldRecommend: true, provider: 'GOOGLE' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    renderBanner(vi.fn())

    await waitFor(() => {
      expect(screen.getByText('パスワードを設定しませんか？')).toBeInTheDocument()
    })
    expect(screen.getByText(/Google/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'パスワードを設定する' })).toBeInTheDocument()
  })

  it('shouldRecommend=false のとき何もレンダリングしない', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ shouldRecommend: false, provider: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const { container } = renderBanner()

    // API レスポンス反映後も表示されない
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    // バナーのテキストは出ない
    expect(screen.queryByText('パスワードを設定しませんか？')).not.toBeInTheDocument()
  })

  it('API 失敗時はフェイルセーフで表示しない', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network'))
    renderBanner()

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(screen.queryByText('パスワードを設定しませんか？')).not.toBeInTheDocument()
  })

  it('CTA クリックで onOpenPasswordSection が呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ shouldRecommend: true, provider: 'LINE' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const onOpen = vi.fn()
    renderBanner(onOpen)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'パスワードを設定する' })).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'パスワードを設定する' }))

    expect(onOpen).toHaveBeenCalled()
  })

  it('「閉じる」ボタンで dismiss API を呼びダイアログが消える', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ shouldRecommend: true, provider: 'GOOGLE' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    renderBanner()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: '閉じる' }))

    // dismiss API が呼ばれた
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
    const [dismissUrl, dismissOptions] = mockFetch.mock.calls[1]
    expect(dismissUrl).toContain('/password-recommendation/dismiss')
    expect(dismissOptions.method).toBe('POST')

    // ダイアログが非表示になる
    expect(screen.queryByText('パスワードを設定しませんか？')).not.toBeInTheDocument()
  })
})
