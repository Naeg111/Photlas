import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminDeletedUsersPage from './AdminDeletedUsersPage'
import { ROLE_ADMIN } from '../utils/codeConstants'

// Mock fetch
const mockFetch = vi.fn()
const originalFetch = global.fetch

beforeAll(() => {
  global.fetch = mockFetch
})

afterAll(() => {
  global.fetch = originalFetch
})

// Mock useAuth
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    getAuthToken: () => 'test-admin-token',
    user: { role: ROLE_ADMIN },
  }),
}))

describe('AdminDeletedUsersPage', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('should render page title', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [], total_elements: 0, total_pages: 0 }),
    })

    render(
      <MemoryRouter>
        <AdminDeletedUsersPage />
      </MemoryRouter>
    )

    expect(screen.getByText('退会済みユーザー管理')).toBeInTheDocument()
  })

  it('should display deleted users from API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            user_id: 1,
            email: 'deleted@example.com',
            original_username: 'deleteduser',
            deleted_at: '2026-03-01T00:00:00',
            remaining_days: 65,
            hold_active: false,
          },
        ],
        total_elements: 1,
        total_pages: 1,
      }),
    })

    render(
      <MemoryRouter>
        <AdminDeletedUsersPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('deleted@example.com')).toBeInTheDocument()
    expect(screen.getByText('deleteduser')).toBeInTheDocument()
  })
})
