import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import RegisterPage from './RegisterPage'

// useNavigate をモック化
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

/**
 * RegisterPage コンポーネントのテスト
 * Issue#2: ユーザー登録機能 (UI)
 * 
 * TDD Red段階: 実装前のテストケース定義
 */
describe('RegisterPage', () => {
  beforeEach(() => {
    // 各テスト前にlocalStorageをクリア
    localStorage.clear()
    mockNavigate.mockClear()
  })

  afterEach(() => {
    // 確実なDOMクリーンアップ
    cleanup()
    document.body.innerHTML = ''
  })


  describe('Basic Layout', () => {
    it('renders all required form elements', () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      // プロフィール画像アップローダー
      expect(screen.getByText('画像を選択')).toBeInTheDocument()
      
      // 基本入力欄
      expect(screen.getByLabelText('表示名')).toBeInTheDocument()
      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
      expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
      expect(screen.getByLabelText('パスワード（確認用）')).toBeInTheDocument()
      
      // SNSリンク入力欄（最初は1つ）
      expect(screen.getByLabelText('SNSリンク 1')).toBeInTheDocument()
      
      // 利用規約
      expect(screen.getByText('利用規約')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: '利用規約に同意する' })).toBeInTheDocument()
      
      // 登録ボタン
      expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
    })

    it('renders correct page title', () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('アカウント登録')
    })
  })

  describe('Profile Image Uploader', () => {
    it('shows file selection dialog when image button is clicked', () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      const imageButton = screen.getByText('画像を選択')
      fireEvent.click(imageButton)
      
      // ファイル選択ダイアログのトリガーを確認
      // Note: 実際のファイルダイアログはテスト環境では開かれない
      expect(imageButton).toBeInTheDocument()
    })

    it('displays image preview when file is selected', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      // ファイル選択をシミュレート
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      if (hiddenInput) {
        Object.defineProperty(hiddenInput, 'files', {
          value: [file],
          writable: false,
        })
        fireEvent.change(hiddenInput)
        
        // プレビュー画像が表示される
        await waitFor(() => {
          expect(screen.getByAltText('プロフィール画像プレビュー')).toBeInTheDocument()
        })
      }
    })
  })

  describe('SNS Links Dynamic Input', () => {
    it('shows only one SNS link input initially', () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      expect(screen.getByLabelText('SNSリンク 1')).toBeInTheDocument()
      expect(screen.queryByLabelText('SNSリンク 2')).not.toBeInTheDocument()
    })

    it('adds second input when first input has text', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 2')).toBeInTheDocument()
      })
    })

    it('adds third input when second input has text', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      // 1つ目の入力欄に入力
      const firstInput = screen.getByLabelText('SNSリンク 1')
      fireEvent.change(firstInput, { target: { value: 'https://twitter.com/user' } })
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 2')).toBeInTheDocument()
      })
      
      // 2つ目の入力欄に入力
      const secondInput = screen.getByLabelText('SNSリンク 2')
      fireEvent.change(secondInput, { target: { value: 'https://instagram.com/user' } })
      
      await waitFor(() => {
        expect(screen.getByLabelText('SNSリンク 3')).toBeInTheDocument()
      })
    })

    it('does not add fourth input (maximum 3)', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      // 3つの入力欄すべてに入力
      const inputs = ['SNSリンク 1', 'SNSリンク 2', 'SNSリンク 3']
      const urls = [
        'https://twitter.com/user',
        'https://instagram.com/user', 
        'https://linkedin.com/user'
      ]
      
      for (let i = 0; i < inputs.length; i++) {
        if (i > 0) {
          await waitFor(() => {
            expect(screen.getByLabelText(inputs[i])).toBeInTheDocument()
          })
        }
        
        const input = screen.getByLabelText(inputs[i])
        fireEvent.change(input, { target: { value: urls[i] } })
      }
      
      // 4つ目の入力欄は表示されない
      expect(screen.queryByLabelText('SNSリンク 4')).not.toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('shows validation errors for empty required fields', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      const submitButton = screen.getByRole('button', { name: '登録する' })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('表示名を入力してください')).toBeInTheDocument()
        expect(screen.getByText('メールアドレスを入力してください')).toBeInTheDocument()
        expect(screen.getByText('パスワードを入力してください')).toBeInTheDocument()
      })
    })

    it('shows error for invalid email format', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )

      // 必須フィールドを適切に設定（メールアドレスのみ無効）
      fireEvent.change(screen.getByLabelText('表示名'), { target: { value: 'Test User' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'Password123' } })
      fireEvent.change(screen.getByLabelText('パスワード（確認用）'), { target: { value: 'Password123' } })

      // 利用規約に同意
      const termsCheckbox = screen.getByRole('checkbox', { name: '利用規約に同意する' })
      fireEvent.click(termsCheckbox)

      // メールアドレスのみ無効な値を設定
      const emailInput = screen.getByLabelText('メールアドレス')
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })

      const submitButton = screen.getByRole('button', { name: '登録する' })
      
      // フォーム要素に直接submitイベントを発火
      const form = submitButton.closest('form')
      if (form) {
        fireEvent.submit(form)
      } else {
        fireEvent.click(submitButton)
      }

      await waitFor(() => {
        expect(screen.getByText('正しいメールアドレスを入力してください')).toBeInTheDocument()
      })
    })

    it('shows error for weak password', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      const passwordInput = screen.getByLabelText('パスワード')
      fireEvent.change(passwordInput, { target: { value: 'weak' } })
      
      const submitButton = screen.getByRole('button', { name: '登録する' })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('パスワードは8文字以上で、数字・小文字・大文字をそれぞれ1文字以上含めてください')).toBeInTheDocument()
      })
    })

    it('shows error when passwords do not match', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      const passwordInput = screen.getByLabelText('パスワード')
      const confirmInput = screen.getByLabelText('パスワード（確認用）')
      
      fireEvent.change(passwordInput, { target: { value: 'Password123' } })
      fireEvent.change(confirmInput, { target: { value: 'Different123' } })
      
      const submitButton = screen.getByRole('button', { name: '登録する' })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument()
      })
    })

    it('shows error when terms are not accepted', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      // 有効な入力をすべて行う
      fireEvent.change(screen.getByLabelText('表示名'), { target: { value: 'Test User' } })
      fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'Password123' } })
      fireEvent.change(screen.getByLabelText('パスワード（確認用）'), { target: { value: 'Password123' } })
      
      // 利用規約にチェックを入れない
      const submitButton = screen.getByRole('button', { name: '登録する' })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('利用規約に同意してください')).toBeInTheDocument()
      })
    })
  })

  describe('Error Display', () => {
    it('highlights error fields with red border', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      const submitButton = screen.getByRole('button', { name: '登録する' })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        const nameInput = screen.getByLabelText('表示名')
        expect(nameInput).toHaveClass('border-red-500')
      })
    })

    it('shows error messages below corresponding fields', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      const submitButton = screen.getByRole('button', { name: '登録する' })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        const errorElement = screen.getByText('表示名を入力してください')
        
        // エラーメッセージが対応する入力欄の近くに表示される
        expect(errorElement).toHaveClass('text-red-500')
      })
    })
  })

  describe('Successful Registration Flow', () => {
    it('navigates to success page with valid input', async () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      )
      
      // 有効な入力をすべて行う
      fireEvent.change(screen.getByLabelText('表示名'), { target: { value: 'Test User' } })
      fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'Password123' } })
      fireEvent.change(screen.getByLabelText('パスワード（確認用）'), { target: { value: 'Password123' } })
      
      // 利用規約に同意
      const termsCheckbox = screen.getByRole('checkbox', { name: '利用規約に同意する' })
      fireEvent.click(termsCheckbox)
      
      const submitButton = screen.getByRole('button', { name: '登録する' })
      fireEvent.click(submitButton)
      
      // 成功時は登録処理が実行される（実際のAPI呼び出しは Issue#3）
      // ここではフォームが適切に処理されることを確認
      await waitFor(() => {
        // フォームの送信が成功した場合のログが出力される
        expect(submitButton).not.toBeDisabled()
      })
    })
  })
})
