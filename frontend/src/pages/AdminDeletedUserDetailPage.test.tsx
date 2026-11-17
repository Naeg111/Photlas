import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminDeletedUserDetailPage from './AdminDeletedUserDetailPage'
import {
  ROLE_ADMIN,
  REASON_ADULT_CONTENT,
  ACTION_TAKEN_REMOVED,
  SANCTION_WARNING,
} from '../utils/codeConstants'
import i18n from '../i18n'

const mockFetch = vi.fn()
const originalFetch = global.fetch

beforeAll(() => {
  global.fetch = mockFetch
})

afterAll(() => {
  global.fetch = originalFetch
})

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    getAuthToken: () => 'test-admin-token',
    user: { role: ROLE_ADMIN },
  }),
}))

const MOCK_DETAIL = {
  email: 'deleted@example.com',
  original_username: 'deleteduser',
  deleted_at: '2026-03-01T00:00:00',
  deletion_hold_until: null,
  remaining_days: 65,
  photo_count: 3,
  // バックエンドは種類・処置・制裁を数値コードで返す
  violations: [
    { violation_type: REASON_ADULT_CONTENT, action_taken: ACTION_TAKEN_REMOVED, created_at: '2026-02-15T00:00:00' },
  ],
  sanctions: [
    { sanction_type: SANCTION_WARNING, reason: '利用規約違反', created_at: '2026-02-15T00:00:00' },
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
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_DETAIL,
    })

    renderWithRoute()

    // Spec#93 追加対応: 数値コードではなく名前で表示する
    expect(await screen.findByText(/成人向けコンテンツ/)).toBeInTheDocument()
    expect(screen.getByText('削除')).toBeInTheDocument()
    expect(screen.getByText('警告')).toBeInTheDocument()
  })

  it('未知のコードは数値のまま表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...MOCK_DETAIL,
        violations: [{ violation_type: 899, action_taken: 1399, created_at: '2026-02-15T00:00:00' }],
        sanctions: [{ sanction_type: 799, reason: 'r', created_at: '2026-02-15T00:00:00' }],
      }),
    })

    renderWithRoute()

    expect(await screen.findByText('1399')).toBeInTheDocument()
    expect(screen.getByText(/^899 - /)).toBeInTheDocument()
    expect(screen.getByText('799')).toBeInTheDocument()
  })

  it('Spec#93 追加対応: 言語設定が英語なら英語で表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_DETAIL,
    })

    await i18n.changeLanguage('en')
    try {
      renderWithRoute()

      expect(await screen.findByText('Deleted User Details')).toBeInTheDocument()
      expect(screen.getByText('Violations and Sanctions')).toBeInTheDocument()
      expect(screen.getByText(/Adult Content/)).toBeInTheDocument()
      expect(screen.getByText('Removed')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('Delete now')).toBeInTheDocument()
      expect(screen.queryByText('即時削除')).not.toBeInTheDocument()
    } finally {
      await i18n.changeLanguage('ja')
    }
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
