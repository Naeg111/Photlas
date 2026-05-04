import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignUpDialog } from './SignUpDialog'
import { PLATFORM_TWITTER } from '../utils/codeConstants'

/**
 * SignUpDialog コンポーネントのテスト
 * Issue#26: 認証機能のモーダルベース移行
 */

// sonner (toast) のモック
vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

// ProfileImageCropperのモック: レンダリング時にonCropCompleteを自動で呼び出す
vi.mock('./ProfileImageCropper', () => ({
  default: ({ onCropComplete }: { onCropComplete: (blob: Blob) => void }) => {
    // トリミング完了を即座にシミュレート
    setTimeout(() => {
      onCropComplete(new Blob(['cropped'], { type: 'image/jpeg' }))
    }, 0)
    return <div data-testid="cropper-modal">Cropper Mock</div>
  },
}))

// fetch APIのモック
const mockFetch = vi.fn()
global.fetch = mockFetch

// URL.createObjectURLのモック
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test-image')
global.URL.revokeObjectURL = vi.fn()

describe('SignUpDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onShowTerms: vi.fn(),
    onShowPrivacyPolicy: vi.fn(),
    onShowLogin: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements - UI要素', () => {
    it('renders dialog when open prop is true', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('アカウントを新規登録')).toBeInTheDocument()
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

      expect(screen.getByLabelText(/^パスワード（必須）/)).toBeInTheDocument()
    })

    it('renders password confirmation input field with toggle', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByLabelText(/パスワード（確認用・必須）/)).toBeInTheDocument()
    })

    it('パスワード入力の maxLength 属性が 20 である', () => {
      render(<SignUpDialog {...defaultProps} />)
      const passwordInput = screen.getByLabelText(/^パスワード（必須）/)
      expect(passwordInput).toHaveAttribute('maxLength', '20')
    })

    it('パスワード（確認用）入力の maxLength 属性が 20 である', () => {
      render(<SignUpDialog {...defaultProps} />)
      const confirmInput = screen.getByLabelText(/パスワード（確認用・必須）/)
      expect(confirmInput).toHaveAttribute('maxLength', '20')
    })

    it('renders SNS links section', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByText('SNSリンク（任意）')).toBeInTheDocument()
    })

    it('renders terms of service section with checkbox', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByRole('link', { name: '利用規約' })).toBeInTheDocument()
      // Issue#104: プライバシーポリシーのチェックボックスも追加されたため、両方の「に同意する」が存在する
      expect(screen.getAllByText('に同意する').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('link', { name: 'プライバシーポリシー' })).toBeInTheDocument()
    })

    it('renders cancel button', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: '戻る' })).toBeInTheDocument()
    })

    it('renders register button', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
    })

    it('renders OAuth signup notice with link to login', () => {
      render(<SignUpDialog {...defaultProps} />)

      // 「Google、LINEアカウントで登録される方は こちら」リンク
      expect(screen.getByText(/Google、LINEアカウントで登録される方は/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'こちら' })).toBeInTheDocument()
    })

    it('renders terms link in checkbox label', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByRole('link', { name: '利用規約' })).toBeInTheDocument()
    })
  })

  describe('Password Strength Indicator - パスワード強度インジケーター', () => {
    it('shows "弱" when password is less than 8 characters', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Abc1234')

      expect(screen.getByText('弱')).toBeInTheDocument()
    })

    it('shows "中" when password has some requirements met', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Abcd1234')

      expect(screen.getByText('中')).toBeInTheDocument()
    })

    it('shows "強" when password is 12+ chars with all requirements', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Abcdefgh1234')

      expect(screen.getByText('強')).toBeInTheDocument()
    })
  })

  describe('Validation - バリデーション', () => {
    it('disables register button when display name is empty', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      // 表示名以外のフィールドを埋める
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))

      // 登録ボタンがdisabledであることを確認
      expect(screen.getByRole('button', { name: '登録する' })).toBeDisabled()
    })

    it('disables register button when email is empty', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))

      // 登録ボタンがdisabledであることを確認
      expect(screen.getByRole('button', { name: '登録する' })).toBeDisabled()
    })

    it.each([
      ['invalid-email', '@なし'],
      ['@', '@のみ'],
      ['user@', 'ドメインなし'],
      ['@example.com', 'ローカル部なし'],
      ['user@example', 'ドットなしドメイン'],
      ['user @example.com', 'スペース含み'],
      ['user@@example.com', '@が複数'],
    ])('shows error when email format is invalid (%s - %s)', async (invalidEmail) => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), invalidEmail)
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('正しいメールアドレスの形式で入力してください')).toBeInTheDocument()
    })

    it('shows error when password is less than 8 characters', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Pass1')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Pass1')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードは8文字以上20文字以内で入力してください')).toBeInTheDocument()
    })

    it('20 文字を超えるパスワードはブラウザ側で 20 文字に切り詰められる（maxLength 属性の効果）', async () => {
      // maxLength={20} を入力に付与したため、ブラウザが 21 文字目以降の入力を物理的に拒否する。
      // 旧来の「21 文字を入力するとフロント JS バリデーションでエラー表示」テストは、
      // この物理ガードによって 21 文字以上が入力できなくなったため、別の検証に置き換える。
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      const passwordInput = screen.getByLabelText(/^パスワード（必須）/) as HTMLInputElement
      await user.type(passwordInput, 'Password123456789012345') // 23 文字

      // maxLength=20 によって 20 文字までしか入力されない
      expect(passwordInput.value).toHaveLength(20)
      expect(passwordInput.value).toBe('Password123456789012')
    })

    it('shows error when password does not contain number', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'PasswordAbc')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'PasswordAbc')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードには数字を1文字以上含めてください')).toBeInTheDocument()
    })

    it('shows error when password does not contain lowercase', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'PASSWORD123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'PASSWORD123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードにはローマ字小文字を1文字以上含めてください')).toBeInTheDocument()
    })

    it('shows error when password does not contain uppercase', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードにはローマ字大文字を1文字以上含めてください')).toBeInTheDocument()
    })

    it('shows error when password contains special characters', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password@123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password@123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードに記号を含めることはできません')).toBeInTheDocument()
    })

    it('shows error when password confirmation does not match', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password456')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument()
    })

    it('disables register button when terms are not agreed', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      // 利用規約に同意しない

      // 登録ボタンがdisabledであることを確認
      expect(screen.getByRole('button', { name: '登録する' })).toBeDisabled()
    })
  })

  describe('API Integration - API連携', () => {
    it('calls register API with form data on submit', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 1, username: 'テストユーザー', email: 'test@example.com' },
            token: 'test-jwt-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/register'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              username: 'テストユーザー',
              email: 'test@example.com',
              password: 'Password123',
              // Issue#109: 利用規約・プライバシー・年齢確認の同意フィールド
              agreedToTerms: true,
              agreedToPrivacy: true,
              ageConfirmed: true,
            }),
          })
        )
      })
    })

    it('shows toast and closes dialog on successful registration', async () => {
      const { toast } = await import('sonner')
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ user: { id: 1 }, token: 'test-jwt-token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith('確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。', { duration: 8000 })
        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('uploads profile image after successful registration', async () => {
      const user = userEvent.setup()
      // 1) Registration API response
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 1, username: 'テストユーザー', email: 'test@example.com' },
            token: 'test-jwt-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      // 2) Presigned URL response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          uploadUrl: 'https://s3.example.com/upload',
          objectKey: 'profile-images/1/test.png',
        }),
      })
      // 3) S3 upload response
      mockFetch.mockResolvedValueOnce({ ok: true })
      // 4) Register S3 key response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profileImageUrl: 'https://cdn.example.com/profile-images/1/test.png' }),
      })

      render(<SignUpDialog {...defaultProps} />)

      // プロフィール画像を選択（クロッパーモックが自動でトリミング完了する）
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(fileInput, file)

      // クロッパーモックのsetTimeoutが完了するのを待つ
      await waitFor(() => {
        expect(screen.getByAltText('')).toBeInTheDocument()
      }, { timeout: 1000 }).catch(() => {
        // プレビュー画像がない場合も続行
      })

      // フォームを入力して送信
      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        // Presigned URL取得にJWTトークンが使われていること
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/users/me/profile-image/presigned-url'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-jwt-token',
            }),
          })
        )
        // S3キー登録が呼ばれていること
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/users/me/profile-image'),
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-jwt-token',
            }),
          })
        )
      })
    })

    it('registration succeeds even if profile image upload fails', async () => {
      const { toast } = await import('sonner')
      const user = userEvent.setup()
      // 1) Registration API response
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 1, username: 'テストユーザー', email: 'test@example.com' },
            token: 'test-jwt-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      // 2) Presigned URL request fails
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

      render(<SignUpDialog {...defaultProps} />)

      // プロフィール画像を選択（クロッパーモックが自動でトリミング完了する）
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await user.upload(fileInput, file)

      // クロッパーモックのsetTimeoutが完了するのを待つ
      await waitFor(() => {
        expect(screen.getByAltText('')).toBeInTheDocument()
      }, { timeout: 1000 }).catch(() => {
        // プレビュー画像がない場合も続行
      })

      // フォームを入力して送信
      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      // 画像アップロードが失敗しても登録自体は成功する
      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith('確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。', { duration: 8000 })
        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('shows error when email is already in use (409)', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce(
        new Response('', { status: 409 })
      )

      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'existing@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
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
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(screen.getByText('登録に失敗しました。再度お試しください。')).toBeInTheDocument()
      })
    })
  })

  describe('Issue#109 - 年齢確認チェックボックス', () => {
    it('年齢確認チェックボックス（13歳以上）が表示される', () => {
      render(<SignUpDialog {...defaultProps} />)

      expect(screen.getByRole('checkbox', { name: /13歳以上/ })).toBeInTheDocument()
    })

    it('年齢確認チェックボックスが未チェックでは登録ボタンが無効化される', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      // 規約・プライバシーはチェックするが、年齢確認は意図的にクリックしない
      const termsCheckbox = screen.getByRole('checkbox', { name: /利用規約/ })
      await user.click(termsCheckbox)
      const privacyCheckbox = screen.getByRole('checkbox', { name: /プライバシーポリシー/ })
      await user.click(privacyCheckbox)

      expect(screen.getByRole('button', { name: '登録する' })).toBeDisabled()
    })

    it('3 つすべてチェックすると登録ボタンが有効化される', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))

      expect(screen.getByRole('button', { name: '登録する' })).toBeEnabled()
    })

    it('register API リクエストボディに 3 つの同意フィールドが含まれる', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 1, username: 'テストユーザー', email: 'test@example.com' },
            token: 'test-jwt-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      render(<SignUpDialog {...defaultProps} />)

      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/register'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              username: 'テストユーザー',
              email: 'test@example.com',
              password: 'Password123',
              agreedToTerms: true,
              agreedToPrivacy: true,
              ageConfirmed: true,
            }),
          })
        )
      })
    })
  })

  describe('Dialog Transitions - ダイアログ遷移', () => {
    it('calls onShowLogin when OAuth signup notice link is clicked', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'こちら' }))

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
      expect(defaultProps.onShowLogin).toHaveBeenCalled()
    })

    it('calls onShowTerms when terms link is clicked', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.click(screen.getByRole('link', { name: '利用規約' }))

      expect(defaultProps.onShowTerms).toHaveBeenCalled()
    })

    it('closes dialog when cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: '戻る' }))

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('SNS Links - SNSリンク', () => {
    it('renders SNS link add button', () => {
      render(<SignUpDialog {...defaultProps} />)

      // SNSリンク追加ボタンがある
      expect(screen.getByRole('button', { name: 'SNSリンクを追加' })).toBeInTheDocument()
    })

    it('opens SNS link edit dialog when add button is clicked', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      // SNSリンク追加ボタンをクリック
      await user.click(screen.getByRole('button', { name: 'SNSリンクを追加' }))

      // Issue#102: 固定3行UI（Instagram/Threads/X）が表示される
      await waitFor(() => {
        expect(screen.getByTestId('sns-link-edit-dialog')).toBeInTheDocument()
      })
      expect(screen.getByTestId('sns-url-input-instagram')).toBeInTheDocument()
      expect(screen.getByTestId('sns-url-input-threads')).toBeInTheDocument()
      expect(screen.getByTestId('sns-url-input-x')).toBeInTheDocument()
    })

    it('sends SNS links to server after successful registration', async () => {
      const user = userEvent.setup()
      // 1) Registration API response
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 1, username: 'テストユーザー', email: 'test@example.com' },
            token: 'test-jwt-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      // 2) SNS links API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snsLinks: [] }),
      })

      render(<SignUpDialog {...defaultProps} />)

      // SNSリンク編集ダイアログを開いてリンクを入力
      await user.click(screen.getByRole('button', { name: 'SNSリンクを追加' }))

      await waitFor(() => {
        expect(screen.getByTestId('sns-link-edit-dialog')).toBeInTheDocument()
      })

      // X 欄に URL を入力
      const urlInput = screen.getByTestId('sns-url-input-x')
      await user.type(urlInput, 'https://x.com/testuser')

      // ダイアログ内の保存ボタンをクリック
      await user.click(screen.getByRole('button', { name: '保存' }))

      // ダイアログが閉じるのを待つ
      await waitFor(() => {
        expect(screen.queryByTestId('sns-link-edit-dialog')).not.toBeInTheDocument()
      })

      // フォームを入力して送信
      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        // SNSリンクAPIが呼ばれていること
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/users/me/sns-links'),
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-jwt-token',
            }),
            body: JSON.stringify({
              snsLinks: [{ platform: PLATFORM_TWITTER, url: 'https://x.com/testuser' }],
            }),
          })
        )
      })
    })

    it('does not send empty SNS links to server', async () => {
      const { toast } = await import('sonner')
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 1, username: 'テストユーザー', email: 'test@example.com' },
            token: 'test-jwt-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      render(<SignUpDialog {...defaultProps} />)

      // SNSリンクは入力しない（空のまま）

      // フォームを入力して送信
      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith('確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。', { duration: 8000 })
      })

      // SNSリンクAPIが呼ばれていないこと
      const snsCalls = mockFetch.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('/sns-links')
      )
      expect(snsCalls).toHaveLength(0)
    })
  })

  // ============================================================
  // 利用規約表示の改善
  // ============================================================

  describe('利用規約表示', () => {
    it('利用規約の冒頭テキストがダイアログ内に表示されない', () => {
      render(<SignUpDialog {...defaultProps} />)

      // 利用規約の全文表示リンクがない（冒頭表示がない）
      expect(screen.queryByText('利用規約の全文を表示')).not.toBeInTheDocument()
    })

    it('利用規約のチェックボックスラベルにリンクが含まれる', () => {
      render(<SignUpDialog {...defaultProps} />)

      // 「利用規約」がリンクとして存在する
      expect(screen.getByRole('link', { name: '利用規約' })).toBeInTheDocument()
    })
  })

  // Issue#96 PR2a: 429 レート制限ハンドリング（パターンA: フォーム送信系）
  describe('Rate Limit (429) - レート制限', () => {
    const fillRequiredFields = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByLabelText(/表示名/), 'テストユーザー')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.type(screen.getByLabelText(/^パスワード（必須）/), 'Password123')
      await user.type(screen.getByLabelText(/パスワード（確認用・必須）/), 'Password123')
      await user.click(screen.getByRole('checkbox', { name: /利用規約/ }))
      await user.click(screen.getByRole('checkbox', { name: /プライバシーポリシー/ }))
      // Issue#109: 年齢確認も同時にチェック
      await user.click(screen.getByRole('checkbox', { name: /13歳以上/ }))
    }

    it('登録で429を受信したらレート制限メッセージをインライン表示する', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce(
        new Response('Too many requests', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Retry-After': '60' },
        })
      )

      render(<SignUpDialog {...defaultProps} />)
      await fillRequiredFields(user)
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(
          screen.getByText('リクエストが多すぎます。60 秒後に再度お試しください。')
        ).toBeInTheDocument()
      })
    })

    it('登録で429を受信したら登録ボタンがクールダウン表示で無効化される', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce(
        new Response('Too many requests', {
          status: 429,
          headers: { 'Retry-After': '60' },
        })
      )

      render(<SignUpDialog {...defaultProps} />)
      await fillRequiredFields(user)
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /送信（あと 60 秒）/ })
        expect(button).toBeDisabled()
      })
    })

    it('Retry-Afterヘッダが欠落していてもデフォルト60秒でクールダウンする', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce(
        new Response('Too many requests', {
          status: 429,
        })
      )

      render(<SignUpDialog {...defaultProps} />)
      await fillRequiredFields(user)
      await user.click(screen.getByRole('button', { name: '登録する' }))

      await waitFor(() => {
        expect(
          screen.getByText('リクエストが多すぎます。60 秒後に再度お試しください。')
        ).toBeInTheDocument()
      })
    })
  })

  // ---------- Phase 8e: OAuth ボタン削除 + onBack props ----------

  describe('Phase 8e/8r-2 - OAuth ボタン削除 + 「戻る」で Method Dialog に戻る', () => {
    it('OAuthButtons（SNS登録ボタン）が表示されない', () => {
      render(<SignUpDialog {...defaultProps} />)
      expect(screen.queryByRole('button', { name: 'Google で新規登録' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'LINE で新規登録' })).not.toBeInTheDocument()
    })

    it('OAuth の「または」区切り線も表示されない', () => {
      render(<SignUpDialog {...defaultProps} />)
      expect(screen.queryByText('または')).not.toBeInTheDocument()
    })

    it('onBack prop があるとき、戻るボタンクリックで onBack が呼ばれる', async () => {
      const user = userEvent.setup()
      const onBack = vi.fn()
      render(<SignUpDialog {...defaultProps} onBack={onBack} />)

      await user.click(screen.getByRole('button', { name: '戻る' }))

      expect(onBack).toHaveBeenCalled()
      // onBack 優先時は onOpenChange(false) は呼ばない（親で dialog 切替を制御）
      expect(defaultProps.onOpenChange).not.toHaveBeenCalledWith(false)
    })

    it('onBack prop が無いとき（既存挙動）は従来通り onOpenChange(false) が呼ばれる', async () => {
      const user = userEvent.setup()
      render(<SignUpDialog {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: '戻る' }))

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
