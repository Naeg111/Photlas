import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ConfirmEmailChangePage from './ConfirmEmailChangePage'

// fetchモック（無限ペンディングでローディング状態にとどめる）
const mockFetch = vi.fn()

// AuthContext モック
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    login: vi.fn(),
    updateUser: vi.fn(),
  }),
}))

// navigateモック
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

const renderWithToken = (token = 'test-token') => {
  return render(
    <MemoryRouter initialEntries={[`/confirm-email-change?token=${token}`]}>
      <ConfirmEmailChangePage />
    </MemoryRouter>
  )
}

describe('ConfirmEmailChangePage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
    mockFetch.mockImplementation(() => new Promise(() => {})) // 永続的にペンディング
  })

  describe('Issue#110 - 背景色', () => {
    it('ページ全体の外側コンテナの背景が bg-black である', () => {
      const { container } = renderWithToken()

      const outer = container.querySelector('.min-h-screen')
      expect(outer).toHaveClass('bg-black')
      expect(outer).not.toHaveClass('bg-gray-50')
    })

    it('中央のカード（bg-white）はそのまま維持される', () => {
      const { container } = renderWithToken()

      const card = container.querySelector('.bg-white')
      expect(card).toBeInTheDocument()
    })
  })
})
