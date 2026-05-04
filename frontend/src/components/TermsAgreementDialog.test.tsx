import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TermsAgreementDialog from './TermsAgreementDialog'

/**
 * TermsAgreementDialog コンポーネントのテスト
 * Issue#109 で年齢確認チェックボックス追加に伴い、新規作成。
 */

// sonner (toast) のモック
vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

// useAuth のモック（getAuthToken / logout を返す）
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    getAuthToken: () => 'test-token',
    logout: vi.fn(),
  }),
}))

// fetch APIのモック
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('TermsAgreementDialog', () => {
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

  describe('Issue#109 - 年齢確認チェックボックス', () => {
    it('年齢確認チェックボックス（13歳以上）が表示される', () => {
      render(<TermsAgreementDialog {...defaultProps} />)

      expect(screen.getByRole('checkbox', { name: /13歳以上/ })).toBeInTheDocument()
    })

    it('年齢確認チェックボックスが未チェックでは「利用を開始する」ボタンが無効化される', async () => {
      const user = userEvent.setup()
      render(<TermsAgreementDialog {...defaultProps} />)

      // 規約・プライバシーはチェックするが、年齢確認は意図的にクリックしない
      const termsCheckbox = screen.getByRole('checkbox', { name: /利用規約/ })
      await user.click(termsCheckbox)
      const privacyCheckbox = screen.getByRole('checkbox', { name: /プライバシーポリシー/ })
      await user.click(privacyCheckbox)

      expect(screen.getByRole('button', { name: '利用を開始する' })).toBeDisabled()
    })

    it('3 つすべてチェックすると「利用を開始する」ボタンが有効化される', async () => {
      const user = userEvent.setup()
      render(<TermsAgreementDialog {...defaultProps} />)

      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))

      expect(screen.getByRole('button', { name: '利用を開始する' })).toBeEnabled()
    })
  })
})
