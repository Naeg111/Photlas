import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n'
import { LoginDialog } from './LoginDialog'
import { TopMenuPanel } from './TopMenuPanel'
import TermsAgreementDialog from './TermsAgreementDialog'

/**
 * Issue#104: 新規登録フロー簡素化 & 利用規約同意ダイアログのテスト
 *
 * <p>Phase A (Red) 段階：実装前のテスト。Phase B (Green) で本実装後にすべて成功する想定。
 */

// AuthContext のモック
const mockLogin = vi.fn()
const mockLogout = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    logout: mockLogout,
    isAuthenticated: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// sonner (toast) のモック
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  }),
}))

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

describe('Issue#104: LoginDialog OAuth ボタン文言変更', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onShowSignUp: vi.fn(),
    onShowPasswordReset: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('OAuth ボタンが「Google で続ける」と表示される', () => {
    renderWithI18n(<LoginDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Google で続ける/ })).toBeInTheDocument()
  })

  it('OAuth ボタンが「LINE で続ける」と表示される', () => {
    renderWithI18n(<LoginDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: /LINE で続ける/ })).toBeInTheDocument()
  })

  it('OAuth ボタン下に注記テキスト「選択することで、利用規約とプライバシーポリシーに同意したものとみなします」が表示される', () => {
    renderWithI18n(<LoginDialog {...defaultProps} />)
    expect(
      screen.getByText('選択することで、利用規約とプライバシーポリシーに同意したものとみなします')
    ).toBeInTheDocument()
  })
})

describe('Issue#104: TopMenuPanel から「新規アカウント作成」ボタンを削除', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    isLoggedIn: false,
    onMyPageClick: vi.fn(),
    onFavoritesClick: vi.fn(),
    onAccountSettingsClick: vi.fn(),
    onAboutClick: vi.fn(),
    onTermsClick: vi.fn(),
    onPrivacyClick: vi.fn(),
    onLoginClick: vi.fn(),
    onLogout: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未ログイン時のメニューに「新規アカウント作成」ボタンが存在しない', () => {
    renderWithI18n(<TopMenuPanel {...defaultProps} />)
    expect(screen.queryByText(/新規アカウント作成/)).not.toBeInTheDocument()
  })

  it('未ログイン時のメニューに「ログイン」ボタンは引き続き存在する', () => {
    renderWithI18n(<TopMenuPanel {...defaultProps} />)
    expect(screen.getByText(/ログイン/)).toBeInTheDocument()
  })
})

describe('Issue#104: TermsAgreementDialog', () => {
  const defaultProps = {
    open: true,
    onAgreed: vi.fn(),
    onCancelled: vi.fn(),
    onShowTerms: vi.fn(),
    onShowPrivacyPolicy: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('open=true でダイアログが表示される', () => {
    renderWithI18n(<TermsAgreementDialog {...defaultProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('タイトル「ご利用にあたって」が表示される', () => {
    renderWithI18n(<TermsAgreementDialog {...defaultProps} />)
    expect(screen.getByText('ご利用にあたって')).toBeInTheDocument()
  })

  it('「利用を開始する」ボタンと「キャンセル」ボタンが表示される', () => {
    renderWithI18n(<TermsAgreementDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: '利用を開始する' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
  })

  it('チェックボックスを両方チェックするまで「利用を開始する」ボタンが非活性', () => {
    renderWithI18n(<TermsAgreementDialog {...defaultProps} />)
    const startButton = screen.getByRole('button', { name: '利用を開始する' })
    expect(startButton).toBeDisabled()
  })

  it('チェックボックス 2 つを両方チェックすると「利用を開始する」ボタンが活性化', async () => {
    const user = userEvent.setup()
    renderWithI18n(<TermsAgreementDialog {...defaultProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)

    await user.click(checkboxes[0])
    await user.click(checkboxes[1])

    const startButton = screen.getByRole('button', { name: '利用を開始する' })
    expect(startButton).not.toBeDisabled()
  })

  it('「キャンセル」押下で onCancelled が呼ばれる', async () => {
    const user = userEvent.setup()
    const onCancelled = vi.fn()
    renderWithI18n(<TermsAgreementDialog {...defaultProps} onCancelled={onCancelled} />)
    const cancelButton = screen.getByRole('button', { name: 'キャンセル' })
    await user.click(cancelButton)
    expect(onCancelled).toHaveBeenCalled()
  })
})
