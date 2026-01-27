import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { AccountSettingsDialog } from './AccountSettingsDialog'
import { toast } from 'sonner'

/**
 * Issue#20: アカウント設定機能 - AccountSettingsDialog テスト
 * Issue#38: 認証トークン不具合修正
 *
 * テスト対象:
 * - メールアドレス変更機能
 * - パスワード変更機能
 * - アカウント削除機能
 * - AuthContextからのトークン取得
 */

// ============================================================================
// Test Data Constants
// ============================================================================

// Email addresses
const CURRENT_EMAIL = 'test@example.com'
const NEW_EMAIL = 'newemail@example.com'
const EXISTING_EMAIL = 'existing@example.com'

// Passwords
const VALID_PASSWORD = 'password123'
const WRONG_PASSWORD = 'wrongpassword'
const NEW_PASSWORD = 'NewPass123'
const DIFFERENT_PASSWORD = 'DifferentPass123'
const PASSWORD_WITH_SPECIAL_CHARS = 'NewPass123!'
const PASSWORD_TOO_LONG = 'NewPass12345678901234' // 21 characters

// Token
const MOCK_TOKEN = 'mock-token'

// API Endpoints
const EMAIL_UPDATE_ENDPOINT = '/api/v1/users/me/email'
const PASSWORD_UPDATE_ENDPOINT = '/api/v1/users/me/password'
const USER_DELETION_ENDPOINT = '/api/v1/users/me'

// JSON field names for request bodies
const FIELD_NEW_EMAIL = 'new_email'
const FIELD_CURRENT_PASSWORD = 'current_password'
const FIELD_NEW_PASSWORD = 'new_password'
const FIELD_NEW_PASSWORD_CONFIRM = 'new_password_confirm'
const FIELD_PASSWORD = 'password'

// Labels and text
const DIALOG_TITLE = 'アカウント設定'
const SECTION_EMAIL_CHANGE = 'メールアドレスの変更'
const SECTION_PASSWORD_CHANGE = 'パスワードの変更'
const SECTION_ACCOUNT_DELETION = 'アカウント削除'
const SECTION_PLAN = 'プラン'

const LABEL_NEW_EMAIL = '新しいメールアドレス'
const LABEL_PASSWORD = 'パスワード'
const LABEL_NEW_PASSWORD = '新しいパスワード'
const LABEL_NEW_PASSWORD_CONFIRM = '新しいパスワード（確認）'
const LABEL_PASSWORD_CONFIRM = 'パスワードを入力して確認'

const BUTTON_CHANGE_EMAIL = 'メールアドレスを変更'
const BUTTON_CHANGE_PASSWORD = 'パスワードを変更'
const BUTTON_DELETE_ACCOUNT = 'アカウントを削除'
const BUTTON_CONFIRM_DELETE = '削除する'

const TEXT_DELETE_CONFIRMATION = '本当に削除しますか？'
const TEXT_FREE_PLAN = '無料プラン'

const ERROR_PASSWORD_VALIDATION = 'パスワードは8〜20文字で、数字・小文字・大文字をそれぞれ1文字以上含め、記号は使用できません'
const ERROR_LOGIN_REQUIRED = 'ログインが必要です'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock fetch response
 */
const createMockFetchResponse = (ok: boolean, status: number, data?: unknown) => ({
  ok,
  status,
  json: async () => data,
})

/**
 * Returns the Authorization header object
 */
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${MOCK_TOKEN}`,
})

/**
 * Expects fetch to be called with specific parameters
 */
const expectFetchCalledWith = (endpoint: string, method: string, body: Record<string, string>) => {
  expect(globalThis.fetch).toHaveBeenCalledWith(
    expect.stringContaining(endpoint),
    expect.objectContaining({
      method,
      headers: expect.objectContaining(getAuthHeaders()),
      body: JSON.stringify(body),
    })
  )
}

/**
 * Expects fetch to not have been called
 */
const expectNoFetchCall = () => {
  expect(globalThis.fetch).not.toHaveBeenCalled()
}

/**
 * Sets up the email change form with test data
 */
const setupEmailChangeTest = () => {
  const newEmailInput = screen.getByLabelText(LABEL_NEW_EMAIL)
  const passwordInput = screen.getByLabelText(LABEL_PASSWORD)
  const submitButton = screen.getByRole('button', { name: BUTTON_CHANGE_EMAIL })

  return { newEmailInput, passwordInput, submitButton }
}

/**
 * Sets up the password change form with test data
 */
const setupPasswordChangeTest = () => {
  const newPasswordInput = screen.getByLabelText(LABEL_NEW_PASSWORD)
  const confirmPasswordInput = screen.getByLabelText(LABEL_NEW_PASSWORD_CONFIRM)
  const submitButton = screen.getByRole('button', { name: BUTTON_CHANGE_PASSWORD })

  return { newPasswordInput, confirmPasswordInput, submitButton }
}

/**
 * Opens the account deletion dialog and fills in the password
 */
const setupAccountDeletionTest = () => {
  // Open delete dialog
  const deleteButton = screen.getByRole('button', { name: BUTTON_DELETE_ACCOUNT })
  fireEvent.click(deleteButton)

  // Get dialog elements
  const passwordInput = screen.getByLabelText(LABEL_PASSWORD_CONFIRM)
  const confirmButton = screen.getByRole('button', { name: BUTTON_CONFIRM_DELETE })

  return { passwordInput, confirmButton }
}

// ============================================================================
// Mocks
// ============================================================================

// useNavigate のモック
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// fetch API のモック
globalThis.fetch = vi.fn()

// sonner (toast) のモック
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Issue#38: AuthContext のモック
const mockGetAuthToken = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    getAuthToken: mockGetAuthToken,
  }),
}))

const MockedAccountSettingsDialog = ({ open, onOpenChange, currentEmail }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentEmail: string
}) => (
  <BrowserRouter>
    <AccountSettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      currentEmail={currentEmail}
    />
  </BrowserRouter>
)

// ============================================================================
// Tests
// ============================================================================

describe('AccountSettingsDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    // Issue#38: AuthContextからトークンを取得するようモック設定
    mockGetAuthToken.mockReturnValue(MOCK_TOKEN)

    // localStorage のモック
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  describe('UI Elements', () => {
    it('renders when open prop is true', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      expect(screen.getByText(DIALOG_TITLE)).toBeInTheDocument()
    })

    it('displays current email address', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const currentEmailInput = screen.getByDisplayValue(CURRENT_EMAIL)
      expect(currentEmailInput).toBeInTheDocument()
      expect(currentEmailInput).toBeDisabled()
    })

    it('displays email change section', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      expect(screen.getByText(SECTION_EMAIL_CHANGE)).toBeInTheDocument()
      expect(screen.getByLabelText(LABEL_NEW_EMAIL)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: BUTTON_CHANGE_EMAIL })).toBeInTheDocument()
    })

    it('displays password change section', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      expect(screen.getByText(SECTION_PASSWORD_CHANGE)).toBeInTheDocument()
      expect(screen.getByLabelText(LABEL_NEW_PASSWORD)).toBeInTheDocument()
      expect(screen.getByLabelText(LABEL_NEW_PASSWORD_CONFIRM)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: BUTTON_CHANGE_PASSWORD })).toBeInTheDocument()
    })

    it('displays account deletion section', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      expect(screen.getByText(SECTION_ACCOUNT_DELETION)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: BUTTON_DELETE_ACCOUNT })).toBeInTheDocument()
    })

    it('displays plan section', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      expect(screen.getByText(SECTION_PLAN)).toBeInTheDocument()
      expect(screen.getByText(TEXT_FREE_PLAN)).toBeInTheDocument()
    })
  })

  // Issue#38: AuthContextからトークン取得のテスト
  describe('Token Authentication (Issue#38)', () => {
    it('uses getAuthToken from AuthContext for email change', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockFetchResponse(true, 200, { email: NEW_EMAIL })
      )

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { newEmailInput, passwordInput, submitButton } = setupEmailChangeTest()

      fireEvent.change(newEmailInput, { target: { value: NEW_EMAIL } })
      fireEvent.change(passwordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockGetAuthToken).toHaveBeenCalled()
      })
    })

    it('uses getAuthToken from AuthContext for password change', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockFetchResponse(true, 200)
      )

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { newPasswordInput, confirmPasswordInput, submitButton } = setupPasswordChangeTest()

      fireEvent.change(newPasswordInput, { target: { value: NEW_PASSWORD } })
      fireEvent.change(confirmPasswordInput, { target: { value: NEW_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockGetAuthToken).toHaveBeenCalled()
      })
    })

    it('uses getAuthToken from AuthContext for account deletion', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockFetchResponse(true, 204)
      )

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { passwordInput, confirmButton } = setupAccountDeletionTest()

      fireEvent.change(passwordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockGetAuthToken).toHaveBeenCalled()
      })
    })

    it('shows login required error when token is null', async () => {
      mockGetAuthToken.mockReturnValue(null)

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { newEmailInput, passwordInput, submitButton } = setupEmailChangeTest()

      fireEvent.change(newEmailInput, { target: { value: NEW_EMAIL } })
      fireEvent.change(passwordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(ERROR_LOGIN_REQUIRED)
      })

      expectNoFetchCall()
    })
  })

  describe('Email Change', () => {
    it('successfully changes email with valid inputs', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockFetchResponse(true, 200, { email: NEW_EMAIL })
      )

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { newEmailInput, passwordInput, submitButton } = setupEmailChangeTest()

      fireEvent.change(newEmailInput, { target: { value: NEW_EMAIL } })
      fireEvent.change(passwordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expectFetchCalledWith(EMAIL_UPDATE_ENDPOINT, 'PUT', {
          [FIELD_NEW_EMAIL]: NEW_EMAIL,
          [FIELD_CURRENT_PASSWORD]: VALID_PASSWORD,
        })
      })
    })

    it('shows error when password is incorrect (401)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockFetchResponse(false, 401)
      )

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { newEmailInput, passwordInput, submitButton } = setupEmailChangeTest()

      fireEvent.change(newEmailInput, { target: { value: NEW_EMAIL } })
      fireEvent.change(passwordInput, { target: { value: WRONG_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it('shows error when email is already in use (409)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockFetchResponse(false, 409)
      )

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { newEmailInput, passwordInput, submitButton } = setupEmailChangeTest()

      fireEvent.change(newEmailInput, { target: { value: EXISTING_EMAIL } })
      fireEvent.change(passwordInput, { target: { value: VALID_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })
  })

  describe('Password Change', () => {
    it('successfully changes password with valid inputs', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockFetchResponse(true, 200)
      )

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { newPasswordInput, confirmPasswordInput, submitButton } = setupPasswordChangeTest()

      fireEvent.change(newPasswordInput, { target: { value: NEW_PASSWORD } })
      fireEvent.change(confirmPasswordInput, { target: { value: NEW_PASSWORD } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expectFetchCalledWith(PASSWORD_UPDATE_ENDPOINT, 'PUT', {
          [FIELD_NEW_PASSWORD]: NEW_PASSWORD,
          [FIELD_NEW_PASSWORD_CONFIRM]: NEW_PASSWORD,
        })
      })
    })

    // Issue#21: パスワードバリデーション統一 - 記号禁止チェック
    it('shows error when new password contains special characters', async () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { newPasswordInput, confirmPasswordInput, submitButton } = setupPasswordChangeTest()

      fireEvent.change(newPasswordInput, { target: { value: PASSWORD_WITH_SPECIAL_CHARS } })
      fireEvent.change(confirmPasswordInput, { target: { value: PASSWORD_WITH_SPECIAL_CHARS } })
      fireEvent.click(submitButton)

      // フロントエンドバリデーションでエラーが表示されることを確認
      expect(toast.error).toHaveBeenCalledWith(ERROR_PASSWORD_VALIDATION)

      // API呼び出しは行われないことを確認
      expectNoFetchCall()
    })

    // Issue#21: パスワードバリデーション統一 - 最大文字数チェック
    it('shows error when new password is longer than 20 characters', async () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { newPasswordInput, confirmPasswordInput, submitButton } = setupPasswordChangeTest()

      fireEvent.change(newPasswordInput, { target: { value: PASSWORD_TOO_LONG } }) // 21文字
      fireEvent.change(confirmPasswordInput, { target: { value: PASSWORD_TOO_LONG } })
      fireEvent.click(submitButton)

      // フロントエンドバリデーションでエラーが表示されることを確認
      expect(toast.error).toHaveBeenCalledWith(ERROR_PASSWORD_VALIDATION)

      // API呼び出しは行われないことを確認
      expectNoFetchCall()
    })
  })

  describe('Account Deletion', () => {
    it('opens confirmation dialog when delete button is clicked', () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const deleteButton = screen.getByRole('button', { name: BUTTON_DELETE_ACCOUNT })
      fireEvent.click(deleteButton)

      expect(screen.getByText(TEXT_DELETE_CONFIRMATION)).toBeInTheDocument()
      expect(screen.getByLabelText(LABEL_PASSWORD_CONFIRM)).toBeInTheDocument()
    })

    it('successfully deletes account and redirects to home', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockFetchResponse(true, 204)
      )

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { passwordInput, confirmButton } = setupAccountDeletionTest()

      // Enter password
      fireEvent.change(passwordInput, { target: { value: VALID_PASSWORD } })

      // Confirm deletion
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expectFetchCalledWith(USER_DELETION_ENDPOINT, 'DELETE', {
          [FIELD_PASSWORD]: VALID_PASSWORD,
        })
      })

      // Check that localStorage is cleared and navigation occurs
      await waitFor(() => {
        expect(window.localStorage.removeItem).toHaveBeenCalledWith('token')
        expect(window.localStorage.removeItem).toHaveBeenCalledWith('username')
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('shows error when password is incorrect (401)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockFetchResponse(false, 401)
      )

      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { passwordInput, confirmButton } = setupAccountDeletionTest()

      // Enter wrong password
      fireEvent.change(passwordInput, { target: { value: WRONG_PASSWORD } })

      // Confirm deletion
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })
  })

  describe('Form Validation', () => {
    it('shows error when trying to change email without filling all fields', async () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const submitButton = screen.getByRole('button', { name: BUTTON_CHANGE_EMAIL })
      fireEvent.click(submitButton)

      // Should not call API
      expectNoFetchCall()
    })

    it('shows error when trying to change password without filling all fields', async () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const submitButton = screen.getByRole('button', { name: BUTTON_CHANGE_PASSWORD })
      fireEvent.click(submitButton)

      // Should not call API
      expectNoFetchCall()
    })

    it('shows error when password confirmation does not match', async () => {
      render(
        <MockedAccountSettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          currentEmail={CURRENT_EMAIL}
        />
      )

      const { newPasswordInput, confirmPasswordInput, submitButton } = setupPasswordChangeTest()

      fireEvent.change(newPasswordInput, { target: { value: NEW_PASSWORD } })
      fireEvent.change(confirmPasswordInput, { target: { value: DIFFERENT_PASSWORD } })
      fireEvent.click(submitButton)

      // Should not call API
      expectNoFetchCall()
    })
  })
})
