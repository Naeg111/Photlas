import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminDeletedUserDetailPage from './AdminDeletedUserDetailPage'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    getAuthToken: () => 'test-admin-token',
    user: { role: 'ADMIN' },
  }),
}))

const MOCK_DETAIL = {
  email: 'deleted@example.com',
  original_username: 'deleteduser',
  deleted_at: '2026-03-01T00:00:00',
  deletion_hold_until: null,
  remaining_days: 65,
  photo_count: 3,
  violations: [
    { violation_type: 'CONTENT_VIOLATION', action_taken: 'WARNING', created_at: '2026-02-15T00:00:00' },
  ],
  sanctions: [
    { sanction_type: 'WARNING', reason: '利用規約違反', created_at: '2026-02-15T00:00:00' },
  ],
}

function renderWithRoute(userId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/manage/deleted-users/${userId}`]}>
      <Routes>
        <Route path="/manage/deleted-users/:userId" element={<AdminDeletedUserDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AdminDeletedUserDetailPage', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockNavigate.mockReset()
  })

  it('should display user detail info', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_DETAIL,
    })

    renderWithRoute()

    expect(await screen.findByText('deleted@example.com')).toBeInTheDocument()
    expect(screen.getByText('deleteduser')).toBeInTheDocument()
  })

  it('should display violation history', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_DETAIL,
    })

    renderWithRoute()

    expect(await screen.findByText(/WARNING/)).toBeInTheDocument()
  })

  it('should show email confirmation dialog for immediate delete', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_DETAIL,
    })

    renderWithRoute()

    const deleteButton = await screen.findByText('即時削除')
    fireEvent.click(deleteButton)

    expect(await screen.findByText(/メールアドレスを入力して確認/)).toBeInTheDocument()
  })
})
