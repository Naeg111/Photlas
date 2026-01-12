// React Testing Libraryから必要な関数をインポート（コンポーネントのレンダリング、要素の検索、イベントの発火、非同期処理の待機、クリーンアップを行うため）
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
// Vitestのテスト関数とモック機能をインポート（テストの記述とモックオブジェクトの作成に使用）
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// React Routerから必要なコンポーネントをインポート（MemoryRouterはテスト用のルーター、URLをシミュレートするため）
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
// テスト対象のResetPasswordPageコンポーネントをインポート
import ResetPasswordPage from './ResetPasswordPage'

/**
 * Issue#6: パスワードリセット機能 - パスワード再設定ページ UI テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - URLパラメータからトークンを取得
 * - 新しいパスワード入力欄
 * - 新しいパスワード（確認用）入力欄
 * - 「再設定」ボタン
 * - トークン無効時のエラーメッセージ表示
 * - 成功時のメッセージ表示とログインページへのリダイレクト
 */

// グローバルなfetch関数をVitestのモック関数で置き換え（API呼び出しをシミュレートするため）
global.fetch = vi.fn()

// useNavigateフックのモック関数を作成（ページ遷移をテストするため）
const mockNavigate = vi.fn()
// react-router-domモジュール全体をモック化
vi.mock('react-router-dom', async () => {
  // 実際のreact-router-domモジュールをインポート（他の機能は実際のものを使用するため）
  const actual = await vi.importActual('react-router-dom')
  return {
    // 実際のモジュールの全機能をスプレッド演算子で展開
    ...actual,
    // useNavigateフックのみをモック関数に置き換え
    useNavigate: () => mockNavigate,
  }
})

// ResetPasswordPageコンポーネントに関するテストをグループ化
describe('ResetPasswordPage', () => {
  // 各テストケースの実行前に実行される処理（テストの独立性を保つため）
  beforeEach(() => {
    // すべてのモック関数の呼び出し履歴と状態をクリア
    vi.clearAllMocks()
  })

  // 各テストケースの実行後に実行される処理（メモリリークを防ぐため）
  afterEach(() => {
    // レンダリングされたコンポーネントをDOMから削除
    cleanup()
  })

  // UI要素の表示に関するテストをグループ化
  describe('UI Elements', () => {
    // ページタイトルが表示されることを検証
    it('renders page title', () => {
      // MemoryRouterを使用してURLパラメータ付きでページをレンダリング（/reset-password?token=valid-tokenをシミュレート）
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // 「パスワード再設定」という見出しが表示されることを検証
      expect(screen.getByRole('heading', { name: 'パスワード再設定' })).toBeInTheDocument()
    })

    // 新しいパスワード入力フィールドが表示されることを検証
    it('renders new password input field', () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // 「新しいパスワード」というラベルの入力フィールドが存在することを検証
      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
      // その入力フィールドのtype属性が'password'であることを検証（パスワードを隠すため）
      expect(screen.getByLabelText('新しいパスワード')).toHaveAttribute('type', 'password')
    })

    // 確認用パスワード入力フィールドが表示されることを検証
    it('renders confirm password input field', () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // 「新しいパスワード（確認用）」というラベルの入力フィールドが存在することを検証
      expect(screen.getByLabelText('新しいパスワード（確認用）')).toBeInTheDocument()
      // その入力フィールドのtype属性が'password'であることを検証
      expect(screen.getByLabelText('新しいパスワード（確認用）')).toHaveAttribute('type', 'password')
    })

    // 再設定ボタンが表示されることを検証
    it('renders submit button', () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // 「再設定」という名前のボタンが存在することを検証
      expect(screen.getByRole('button', { name: '再設定' })).toBeInTheDocument()
    })
  })

  // トークンのバリデーションに関するテストをグループ化
  describe('Token Validation', () => {
    // URLパラメータにトークンが含まれていない場合にエラーメッセージが表示されることを検証
    it('displays error message when token is missing', () => {
      // トークンなしでページをレンダリング（/reset-passwordのみ）
      render(
        <MemoryRouter initialEntries={['/reset-password']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // トークン不正のエラーメッセージが表示されることを検証
      expect(screen.getByText('このリンクは無効です。再度パスワードリセットをリクエストしてください。')).toBeInTheDocument()
    })

    // 無効なトークンで送信した場合にエラーメッセージが表示されることを検証
    it('displays error message when token is invalid', async () => {
      // fetchのモックを取得
      const mockFetch = vi.mocked(fetch)
      // fetchが400エラーレスポンスを返すように設定（トークンが無効な場合）
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'トークンが無効または期限切れです'
        })
      } as Response)

      // 無効なトークンでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=invalid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // パスワード入力フィールドと再設定ボタンを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      // 新しいパスワードを入力
      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      // 確認用パスワードを入力
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      // 再設定ボタンをクリック
      fireEvent.click(submitButton)

      // トークン無効のエラーメッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('トークンが無効または期限切れです')).toBeInTheDocument()
      })
    })

    // トークンがない場合は入力フォームが非表示になり、エラーメッセージのみ表示されることを検証
    it('hides form inputs when token is missing, shows only error message', () => {
      // トークンなしでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // 新しいパスワード入力フィールドが表示されていないことを検証（queryByはnullを返す）
      expect(screen.queryByLabelText('新しいパスワード')).not.toBeInTheDocument()
      // 確認用パスワード入力フィールドが表示されていないことを検証
      expect(screen.queryByLabelText('新しいパスワード（確認用）')).not.toBeInTheDocument()
      // 再設定ボタンが表示されていないことを検証
      expect(screen.queryByRole('button', { name: '再設定' })).not.toBeInTheDocument()
    })
  })

  // フォームのバリデーション機能に関するテストをグループ化
  describe('Form Validation', () => {
    // 新しいパスワードが空の状態で送信した場合に必須エラーが表示されることを検証
    it('shows required error for empty new password', async () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // 再設定ボタンを取得
      const submitButton = screen.getByRole('button', { name: '再設定' })
      // パスワードを入力せずに再設定ボタンをクリック
      fireEvent.click(submitButton)

      // 「新しいパスワードは必須です」というエラーメッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('新しいパスワードは必須です')).toBeInTheDocument()
      })
    })

    // 確認用パスワードが空の状態で送信した場合に必須エラーが表示されることを検証
    it('shows required error for empty confirm password', async () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // 再設定ボタンを取得
      const submitButton = screen.getByRole('button', { name: '再設定' })
      // パスワードを入力せずに再設定ボタンをクリック
      fireEvent.click(submitButton)

      // 「確認用パスワードは必須です」というエラーメッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('確認用パスワードは必須です')).toBeInTheDocument()
      })
    })

    // 新しいパスワードと確認用パスワードが一致しない場合にエラーが表示されることを検証
    it('shows error when passwords do not match', async () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // パスワード入力フィールドと再設定ボタンを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      // 新しいパスワードを入力
      fireEvent.change(newPasswordInput, { target: { value: 'Password123' } })
      // 異なる確認用パスワードを入力
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPassword123' } })
      // 再設定ボタンをクリック
      fireEvent.click(submitButton)

      // 「パスワードが一致しません」というエラーメッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument()
      })
    })

    // パスワードが8文字未満の場合にエラーが表示されることを検証
    it('shows error for password less than 8 characters', async () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // パスワード入力フィールドと再設定ボタンを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      // 5文字のパスワードを入力（8文字未満）
      fireEvent.change(newPasswordInput, { target: { value: 'Pass1' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'Pass1' } })
      // 再設定ボタンをクリック
      fireEvent.click(submitButton)

      // 「パスワードは8文字以上で入力してください」というエラーメッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('パスワードは8文字以上で入力してください')).toBeInTheDocument()
      })
    })

    // パスワードに大文字が含まれていない場合にエラーが表示されることを検証
    it('shows error for password without uppercase letter', async () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // パスワード入力フィールドと再設定ボタンを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      // 小文字と数字のみのパスワードを入力（大文字なし）
      fireEvent.change(newPasswordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
      // 再設定ボタンをクリック
      fireEvent.click(submitButton)

      // パスワード複雑さ要件のエラーメッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('パスワードは大文字、小文字、数字を含む必要があります')).toBeInTheDocument()
      })
    })

    // パスワードに小文字が含まれていない場合にエラーが表示されることを検証
    it('shows error for password without lowercase letter', async () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // パスワード入力フィールドと再設定ボタンを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      // 大文字と数字のみのパスワードを入力（小文字なし）
      fireEvent.change(newPasswordInput, { target: { value: 'PASSWORD123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'PASSWORD123' } })
      // 再設定ボタンをクリック
      fireEvent.click(submitButton)

      // パスワード複雑さ要件のエラーメッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('パスワードは大文字、小文字、数字を含む必要があります')).toBeInTheDocument()
      })
    })

    // パスワードに数字が含まれていない場合にエラーが表示されることを検証
    it('shows error for password without number', async () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // パスワード入力フィールドと再設定ボタンを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      // 大文字と小文字のみのパスワードを入力（数字なし）
      fireEvent.change(newPasswordInput, { target: { value: 'PasswordOnly' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'PasswordOnly' } })
      // 再設定ボタンをクリック
      fireEvent.click(submitButton)

      // パスワード複雑さ要件のエラーメッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('パスワードは大文字、小文字、数字を含む必要があります')).toBeInTheDocument()
      })
    })
  })

  // パスワード再設定処理に関するテストをグループ化
  describe('Password Reset Process', () => {
    // フォーム送信時に正しいエンドポイントにPOSTリクエストが送信されることを検証
    it('sends POST request to /api/v1/auth/reset-password on form submission', async () => {
      // fetchのモックを取得
      const mockFetch = vi.mocked(fetch)
      // fetchが成功レスポンスを返すように設定
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successful' })
      } as Response)

      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // パスワード入力フィールドと再設定ボタンを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      // 新しいパスワードを入力
      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      // 確認用パスワードを入力
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      // 再設定ボタンをクリック
      fireEvent.click(submitButton)

      // fetchが正しいURL、メソッド、ヘッダー、ボディ（トークン、新しいパスワード、確認用パスワード）で呼び出されることを検証
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: 'valid-token',
            newPassword: 'NewPassword123',
            confirmPassword: 'NewPassword123'
          })
        })
      })
    })

    // パスワード再設定が成功した場合に成功メッセージが表示されることを検証
    it('displays success message after successful password reset', async () => {
      // fetchのモックを成功レスポンスを返すように設定
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successful' })
      } as Response)

      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // パスワード入力フィールドと再設定ボタンを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      // パスワードを入力して送信
      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.click(submitButton)

      // 「パスワードが再設定されました。」という成功メッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('パスワードが再設定されました。')).toBeInTheDocument()
      })
    })

    // パスワード再設定成功後にログインページにリダイレクトされることを検証
    it('redirects to login page after successful password reset', async () => {
      // fetchのモックを成功レスポンスを返すように設定
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successful' })
      } as Response)

      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // パスワード入力フィールドと再設定ボタンを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      // パスワードを入力して送信
      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.click(submitButton)

      // navigate関数が'/login'パスで呼び出されることを検証（タイムアウト5秒で待機）
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login')
      }, { timeout: 5000 })
    })

    // リクエスト送信中は再設定ボタンが無効化されることを検証（二重送信防止のため）
    it('disables submit button during request', async () => {
      // fetchのモックを取得
      const mockFetch = vi.mocked(fetch)
      // レスポンスが返るまでに100ms遅延するように設定（リクエスト中の状態をシミュレート）
      mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)))

      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // パスワード入力フィールドと再設定ボタンを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      // パスワードを入力して送信
      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.click(submitButton)

      // 再設定ボタンが無効化されていることを検証（disabled属性がtrueになっている）
      expect(submitButton).toBeDisabled()
    })

    // APIがエラーを返した場合にエラーメッセージが表示されることを検証
    it('shows error message when API returns error', async () => {
      // fetchのモックを取得
      const mockFetch = vi.mocked(fetch)
      // fetchが失敗レスポンス（ok: false）を返すように設定
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: 'パスワードの要件を満たしていません'
        })
      } as Response)

      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // パスワード入力フィールドと再設定ボタンを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      const submitButton = screen.getByRole('button', { name: '再設定' })

      // パスワードを入力して送信
      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123' } })
      fireEvent.click(submitButton)

      // サーバーから返されたエラーメッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('パスワードの要件を満たしていません')).toBeInTheDocument()
      })
    })
  })

  // パスワードの表示/非表示切り替え機能に関するテストをグループ化
  describe('Password Visibility Toggle', () => {
    // 新しいパスワードの表示/非表示を切り替えられることを検証
    it('toggles new password visibility when eye icon is clicked', () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // 新しいパスワード入力フィールドを取得
      const newPasswordInput = screen.getByLabelText('新しいパスワード')
      // 初期状態ではtype属性が'password'であることを検証（パスワードが隠されている）
      expect(newPasswordInput).toHaveAttribute('type', 'password')

      // 表示切り替えボタンを取得（show/hide/表示のいずれかの名前を持つボタンの1つ目）
      const toggleButton = screen.getAllByRole('button', { name: /show|hide|表示/i })[0]
      // 切り替えボタンをクリック
      fireEvent.click(toggleButton)

      // type属性が'text'に変わることを検証（パスワードが表示される）
      expect(newPasswordInput).toHaveAttribute('type', 'text')

      // もう一度切り替えボタンをクリック
      fireEvent.click(toggleButton)
      // type属性が'password'に戻ることを検証（パスワードが再び隠される）
      expect(newPasswordInput).toHaveAttribute('type', 'password')
    })

    // 確認用パスワードの表示/非表示を切り替えられることを検証
    it('toggles confirm password visibility when eye icon is clicked', () => {
      // URLパラメータ付きでページをレンダリング
      render(
        <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      )

      // 確認用パスワード入力フィールドを取得
      const confirmPasswordInput = screen.getByLabelText('新しいパスワード（確認用）')
      // 初期状態ではtype属性が'password'であることを検証
      expect(confirmPasswordInput).toHaveAttribute('type', 'password')

      // すべての表示切り替えボタンを取得
      const toggleButtons = screen.getAllByRole('button', { name: /show|hide|表示/i })
      // 2つ目のボタン（確認用パスワード用）を取得
      const confirmToggleButton = toggleButtons[1]
      // 切り替えボタンをクリック
      fireEvent.click(confirmToggleButton)

      // type属性が'text'に変わることを検証（パスワードが表示される）
      expect(confirmPasswordInput).toHaveAttribute('type', 'text')

      // もう一度切り替えボタンをクリック
      fireEvent.click(confirmToggleButton)
      // type属性が'password'に戻ることを検証（パスワードが再び隠される）
      expect(confirmPasswordInput).toHaveAttribute('type', 'password')
    })
  })
})
