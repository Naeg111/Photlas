import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
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

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// 本物の AuthContext と同じく、getAuthToken はレンダーごとに作り直さない（fetchDetail の依存が毎回変わらないように）
const { mockGetAuthToken } = vi.hoisted(() => ({ mockGetAuthToken: () => 'test-admin-token' }))
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    getAuthToken: mockGetAuthToken,
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

  it('詳細の取得が失敗したら「読み込み中」のまま止めず、失敗と戻るボタンを表示する', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })

    renderWithRoute()

    expect(await screen.findByText('データの取得に失敗しました')).toBeInTheDocument()
    expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith('データの取得に失敗しました')

    fireEvent.click(screen.getByRole('button', { name: '戻る' }))
    expect(mockNavigate).toHaveBeenCalledWith('/manage/deleted-users')
  })

  it('保持期間の延長がサーバーに拒否されたら、失敗を知らせる', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_DETAIL })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })

    renderWithRoute()

    fireEvent.click(await screen.findByText('保持期間延長'))
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByText('延長する'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('保持期間の延長に失敗しました')
    })
  })

  it('保持延長の解除がサーバーに拒否されたら、失敗を知らせる', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...MOCK_DETAIL, deletion_hold_until: '2026-12-31T00:00:00' }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })

    renderWithRoute()

    fireEvent.click(await screen.findByText('保持延長を解除'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('解除に失敗しました')
    })
  })

  it('エクスポートがサーバーに拒否されたら、失敗を知らせる', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_DETAIL })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })

    renderWithRoute()

    fireEvent.click(await screen.findByText('データエクスポート'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('エクスポートに失敗しました')
    })
  })

  it('同じ時刻の履歴が複数あっても、key が重ならずにすべて表示する', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...MOCK_DETAIL,
        violations: [
          { violation_type: REASON_ADULT_CONTENT, action_taken: ACTION_TAKEN_REMOVED, created_at: '2026-02-15T00:00:00' },
          { violation_type: REASON_ADULT_CONTENT, action_taken: ACTION_TAKEN_REMOVED, created_at: '2026-02-15T00:00:00' },
        ],
        sanctions: [
          { sanction_type: SANCTION_WARNING, reason: 'r1', created_at: '2026-02-15T00:00:00' },
          { sanction_type: SANCTION_WARNING, reason: 'r2', created_at: '2026-02-15T00:00:00' },
        ],
      }),
    })

    try {
      renderWithRoute()

      expect(await screen.findAllByText('削除')).toHaveLength(2)
      expect(screen.getAllByText('警告')).toHaveLength(2)
      const keyWarnings = consoleError.mock.calls.filter((args) =>
        args.some((arg) => typeof arg === 'string' && arg.includes('same key'))
      )
      expect(keyWarnings).toEqual([])
    } finally {
      consoleError.mockRestore()
    }
  })

  it('Spec#93 追加対応: 言語を切り替えても詳細を取り直さない', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_DETAIL,
    })

    renderWithRoute()

    expect(await screen.findByText('deleted@example.com')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    try {
      await act(async () => {
        await i18n.changeLanguage('en')
      })
      expect(screen.getByText('Deleted User Details')).toBeInTheDocument()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    } finally {
      await act(async () => {
        await i18n.changeLanguage('ja')
      })
    }
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
