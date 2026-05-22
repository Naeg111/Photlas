import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from 'sonner'
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

  describe('Issue#144 - 規約同意では「ログインしました」トーストを出さない', () => {
    it('「利用を開始する」押下で onAgreed は呼ぶが「ログインしました」トーストは出さない', async () => {
      const user = userEvent.setup()
      const onAgreed = vi.fn()
      mockFetch.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve({}) })

      render(<TermsAgreementDialog {...defaultProps} onAgreed={onAgreed} />)

      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '利用を開始する' }))

      // 同意完了コールバックは呼ばれる（発火責務は App.tsx の coordinator に移譲）
      await waitFor(() => expect(onAgreed).toHaveBeenCalled())
      // 「ログインしました」トーストはこのダイアログからは出さない
      expect(toast).not.toHaveBeenCalledWith('ログインしました')
    })
  })
})
