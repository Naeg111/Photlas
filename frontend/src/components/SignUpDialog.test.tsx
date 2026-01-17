import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignUpDialog } from './SignUpDialog'

/**
 * SignUpDialog コンポーネントのテスト
 * Issue#26: 認証機能のモーダルベース移行
 */

// sonner (toast) のモック
vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

// fetch APIのモック
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SignUpDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onShowTerms: vi.fn(),
    onShowLogin: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements - UI要素', () => {
    it('renders dialog when open prop is true', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('アカウント作成')).toBeInTheDocument()
    })

    it('does not render dialog when open prop is false', () => {
      render(<SignUpDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders profile image upload section', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByText('プロフィール画像（任意）')).toBeInTheDocument()
      expect(screen.getByText('画像を選択')).toBeInTheDocument()
    })

    it('renders display name input field', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByLabelText(/表示名/)).toBeInTheDocument()
    })

    it('renders email input field', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByLabelText(/メールアドレス/)).toBeInTheDocument()
    })

    it('renders password input field with toggle', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByLabelText(/^パスワード \*/)).toBeInTheDocument()
    })

    it('renders password confirmation input field with toggle', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByLabelText(/パスワード（確認用）/)).toBeInTheDocument()
    })

    it('renders SNS links section', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByText('SNSリンク（任意）')).toBeInTheDocument()
    })

    it('renders terms of service section with checkbox', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByText('利用規約')).toBeInTheDocument()
      expect(screen.getByLabelText('利用規約に同意します')).toBeInTheDocument()
    })

    it('renders cancel button', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
    })

    it('renders register button', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
    })

    it('renders login link for existing users', () => {
      render(<SignUpDialog {...defaultProps} />)

      // Issue#26: "すでにアカウントをお持ちの方はログイン"リンクを追加
      expect(screen.getByText('ログイン')).toBeInTheDocument()
    })

    it('renders terms full text link', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByText('利用規約の全文を表示')).toBeInTheDocument()
    })
  })

  describe('Password Strength Indicator - パスワード強度インジケーター', () => {
    it('shows "弱" when password is less than 8 characters', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/^パスワード \*/), 'Abc1234')

      expect(screen.getByText('弱')).toBeInTheDocument()
    })

    it('shows "中" when password has some requirements met', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/^パスワード \*/), 'Abcd1234')

      expect(screen.getByText('中')).toBeInTheDocument()
    })

    it('shows "強" when password is 12+ chars with all requirements', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/^パスワード \*/), 'Abcdefgh1234')

      expect(screen.getByText('強')).toBeInTheDocument()
    })
  })

  describe('Validation - バリデーション', () => {
    it('disables register button when display name is empty', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      // 表示名以外のフィールドを埋める
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Password123')
      await user.click(screen.getByLabelText('利用規約に同意します'))

      // 登録ボタンがdisabledであることを確認
      expect(screen.getByRole('button', { name: '登録する' })).toBeDisabled()
    })

    it('disables register button when email is empty', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Password123')
      await user.click(screen.getByLabelText('利用規約に同意します'))

      // 登録ボタンがdisabledであることを確認
      expect(screen.getByRole('button', { name: '登録する' })).toBeDisabled()
    })

    it('shows error when email format is invalid', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'invalid-email')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Password123')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('正しいメールアドレスの形式で入力してください')).toBeInTheDocument()
    })

    it('shows error when password is less than 8 characters', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Pass1')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Pass1')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードは8文字以上20文字以内で入力してください')).toBeInTheDocument()
    })

    it('shows error when password is more than 20 characters', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Password123456789012345')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Password123456789012345')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードは8文字以上20文字以内で入力してください')).toBeInTheDocument()
    })

    it('shows error when password does not contain number', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'PasswordAbc')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'PasswordAbc')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードには数字を1文字以上含めてください')).toBeInTheDocument()
    })

    it('shows error when password does not contain lowercase', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'PASSWORD123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'PASSWORD123')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードにはローマ字小文字を1文字以上含めてください')).toBeInTheDocument()
    })

    it('shows error when password does not contain uppercase', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'password123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'password123')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードにはローマ字大文字を1文字以上含めてください')).toBeInTheDocument()
    })

    it('shows error when password contains special characters', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Password@123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Password@123')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードに記号を含めることはできません')).toBeInTheDocument()
    })

    it('shows error when password confirmation does not match', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Password456')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument()
    })

    it('disables register button when terms are not agreed', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Password123')
      // 利用規約に同意しない

      // 登録ボタンがdisabledであることを確認
      expect(screen.getByRole('button', { name: '登録する' })).toBeDisabled()
    })
  })

  describe('API Integration - API連携', () => {
    it('calls register API with form data on submit', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, username: 'テストユーザー', email: 'test@example.com' }),
      })

      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Password123')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/register'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'テストユーザー',
              email: 'test@example.com',
              password: 'Password123',
            }),
          })
        )
      })
    })

    it('shows toast and closes dialog on successful registration', async () => {
      const { toast } = await import('sonner')
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      })

      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Password123')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith('アカウント登録が完了しました')
        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('shows error when email is already in use (409)', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
      })

      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'existing@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Password123')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(screen.getByText('このメールアドレスは既に登録されています')).toBeInTheDocument()
      })
    })

    it('shows generic error when registration fails', async () => {
      const user = userEvent.setup()
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード \*/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用）/), 'Password123')
      await user.click(screen.getByLabelText('利用規約に同意します'))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(screen.getByText('登録に失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('Dialog Transitions - ダイアログ遷移', () => {
    it('calls onShowLogin when login link is clicked', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.click(screen.getByText('ログイン'))

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
      expect(defaultProps.onShowLogin).toHaveBeenCalled()
    })

    it('calls onShowTerms when terms full text link is clicked', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.click(screen.getByText('利用規約の全文を表示'))

      expect(defaultProps.onShowTerms).toHaveBeenCalled()
    })

    it('closes dialog when cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'キャンセル' }))

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('SNS Links - SNSリンク', () => {
    it('allows adding up to 3 SNS links', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      // 最初は1つのSNSリンク入力欄がある
      expect(screen.getAllByPlaceholderText('https://twitter.com/username')).toHaveLength(1)

      // SNSリンクを追加ボタンをクリック
      await user.click(screen.getByRole('button', { name: 'SNSリンクを追加' }))
      expect(screen.getAllByPlaceholderText('https://twitter.com/username')).toHaveLength(2)

      await user.click(screen.getByRole('button', { name: 'SNSリンクを追加' }))
      expect(screen.getAllByPlaceholderText('https://twitter.com/username')).toHaveLength(3)

      // 3つに達したら追加ボタンが非表示
      expect(screen.queryByRole('button', { name: 'SNSリンクを追加' })).not.toBeInTheDocument()
    })
  })
})
