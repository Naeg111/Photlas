// React Testing Libraryから必要な関数をインポート（コンポーネントのレンダリング、要素の検索、イベントの発火、非同期処理の待機、クリーンアップを行うため）
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
// Vitestのテスト関数とモック機能をインポート（テストの記述とモックオブジェクトの作成に使用）
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// テスト対象のPasswordResetRequestModalコンポーネントをインポート
import PasswordResetRequestModal from './PasswordResetRequestModal'

/**
 * Issue#6: パスワードリセット機能 - パスワードリセットリクエストモーダル UI テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - モーダルウィンドウの表示/非表示
 * - 説明文：「登録メールアドレスを入力してください。」
 * - メールアドレス入力欄
 * - 説明文：「入力したら送信ボタンを押してください。」
 * - 「送信」ボタン
 * - 送信後の確認メッセージ：「パスワード再設定用のメールを送信しました。受信トレイをご確認ください。」
 */

// グローバルなfetch関数をVitestのモック関数で置き換え（API呼び出しをシミュレートするため）
global.fetch = vi.fn()

// PasswordResetRequestModalコンポーネントに関するテストをグループ化
describe('PasswordResetRequestModal', () => {
  // モーダルを閉じるコールバック関数のモックを作成（onCloseプロパティに渡すため）
  const mockOnClose = vi.fn()

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
    // openプロパティがtrueの場合にモーダルが表示されることを検証
    it('renders modal when open prop is true', () => {
      // PasswordResetRequestModalをopen=trueでレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // 「パスワードリセット」というテキストがドキュメント内に存在することを検証
      expect(screen.getByText('パスワードリセット')).toBeInTheDocument()
    })

    // openプロパティがfalseの場合にモーダルが表示されないことを検証
    it('does not render modal when open prop is false', () => {
      // PasswordResetRequestModalをopen=falseでレンダリング
      render(<PasswordResetRequestModal open={false} onClose={mockOnClose} />)

      // 「パスワードリセット」というテキストがドキュメント内に存在しないことを検証（queryByは要素がない場合nullを返す）
      expect(screen.queryByText('パスワードリセット')).not.toBeInTheDocument()
    })

    // メールアドレス入力欄の説明文が表示されることを検証
    it('renders instruction text for email input', () => {
      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // 「登録メールアドレスを入力してください。」という説明文が表示されていることを検証
      expect(screen.getByText('登録メールアドレスを入力してください。')).toBeInTheDocument()
    })

    // メールアドレス入力フィールドが正しく表示されることを検証
    it('renders email input field', () => {
      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // 「メールアドレス」というラベルに関連付けられた入力フィールドが存在することを検証
      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
      // その入力フィールドのtype属性が'email'であることを検証（HTML5のメール入力として機能するため）
      expect(screen.getByRole('textbox', { name: 'メールアドレス' })).toHaveAttribute('type', 'email')
    })

    // 送信ボタンの説明文が表示されることを検証
    it('renders instruction text for submit button', () => {
      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // 「入力したら送信ボタンを押してください。」という説明文が表示されていることを検証
      expect(screen.getByText('入力したら送信ボタンを押してください。')).toBeInTheDocument()
    })

    // 送信ボタンが表示されることを検証
    it('renders submit button', () => {
      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // 「送信」という名前のボタンが存在することを検証
      expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
    })
  })

  // フォームのバリデーション機能に関するテストをグループ化
  describe('Form Validation', () => {
    // メールアドレスが空の状態で送信した場合に必須エラーが表示されることを検証
    it('shows required error for empty email', async () => {
      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // 送信ボタンを取得
      const submitButton = screen.getByRole('button', { name: '送信' })
      // メールアドレスを入力せずに送信ボタンをクリック
      fireEvent.click(submitButton)

      // 非同期でエラーメッセージが表示されるのを待機（バリデーションは非同期処理の可能性があるため）
      await waitFor(() => {
        // 「メールアドレスは必須です」というエラーメッセージが表示されることを検証
        expect(screen.getByText('メールアドレスは必須です')).toBeInTheDocument()
      })
    })

    // 不正な形式のメールアドレスを入力した場合にフォーマットエラーが表示されることを検証
    it('shows invalid email format error', async () => {
      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // メールアドレス入力フィールドを取得
      const emailInput = screen.getByLabelText('メールアドレス')
      // 不正な形式（@を含まない）のメールアドレスを入力
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })

      // 送信ボタンを取得してクリック
      const submitButton = screen.getByRole('button', { name: '送信' })
      fireEvent.click(submitButton)

      // 非同期でエラーメッセージが表示されるのを待機
      await waitFor(() => {
        // 「正しいメールアドレス形式で入力してください」というエラーメッセージが表示されることを検証
        expect(screen.getByText('正しいメールアドレス形式で入力してください')).toBeInTheDocument()
      })
    })
  })

  // パスワードリセットリクエストの送信処理に関するテストをグループ化
  describe('Password Reset Request Process', () => {
    // フォーム送信時に正しいエンドポイントにPOSTリクエストが送信されることを検証
    it('sends POST request to /api/v1/auth/password-reset-request on form submission', async () => {
      // グローバルなfetchモックを取得
      const mockFetch = vi.mocked(fetch)
      // fetchが成功レスポンス（200 OK）を返すようにモックを設定
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset email sent' })
      } as Response)

      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // メールアドレス入力フィールドと送信ボタンを取得
      const emailInput = screen.getByLabelText('メールアドレス')
      const submitButton = screen.getByRole('button', { name: '送信' })

      // 有効なメールアドレスを入力（changeイベントを発火）
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      // 送信ボタンをクリック
      fireEvent.click(submitButton)

      // fetchが正しいURL、メソッド、ヘッダー、ボディで呼び出されることを検証
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/password-reset-request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'test@example.com'
          })
        })
      })
    })

    // リクエストが成功した場合に成功メッセージが表示されることを検証
    it('displays success message after successful request', async () => {
      // fetchのモックを取得
      const mockFetch = vi.mocked(fetch)
      // 成功レスポンスを返すように設定
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset email sent' })
      } as Response)

      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // メールアドレス入力フィールドと送信ボタンを取得
      const emailInput = screen.getByLabelText('メールアドレス')
      const submitButton = screen.getByRole('button', { name: '送信' })

      // メールアドレスを入力して送信
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)

      // 成功メッセージが表示されることを検証（非同期処理を待機）
      await waitFor(() => {
        expect(screen.getByText('パスワード再設定用のメールを送信しました。受信トレイをご確認ください。')).toBeInTheDocument()
      })
    })

    // リクエストが失敗した場合にエラーメッセージが表示されることを検証
    it('shows error message on request failure', async () => {
      // fetchのモックを取得
      const mockFetch = vi.mocked(fetch)
      // 失敗レスポンス（ok: false）を返すように設定
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: 'メールアドレスが見つかりません'
        })
      } as Response)

      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // メールアドレス入力フィールドと送信ボタンを取得
      const emailInput = screen.getByLabelText('メールアドレス')
      const submitButton = screen.getByRole('button', { name: '送信' })

      // 存在しないメールアドレスを入力して送信
      fireEvent.change(emailInput, { target: { value: 'notfound@example.com' } })
      fireEvent.click(submitButton)

      // サーバーから返されたエラーメッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('メールアドレスが見つかりません')).toBeInTheDocument()
      })
    })

    // リクエスト送信中は送信ボタンが無効化されることを検証（二重送信防止のため）
    it('disables submit button during request', async () => {
      // fetchのモックを取得
      const mockFetch = vi.mocked(fetch)
      // レスポンスが返るまでに100ms遅延するように設定（リクエスト中の状態をシミュレート）
      mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)))

      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // メールアドレス入力フィールドと送信ボタンを取得
      const emailInput = screen.getByLabelText('メールアドレス')
      const submitButton = screen.getByRole('button', { name: '送信' })

      // メールアドレスを入力して送信
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)

      // 送信ボタンが無効化されていることを検証（disabled属性がtrueになっている）
      expect(submitButton).toBeDisabled()
    })

    // 送信成功後は入力フィールドと送信ボタンが非表示になり、成功メッセージのみ表示されることを検証
    it('hides email input and submit button after success, shows only success message', async () => {
      // fetchのモックを成功レスポンスを返すように設定
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset email sent' })
      } as Response)

      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // メールアドレス入力フィールドと送信ボタンを取得
      const emailInput = screen.getByLabelText('メールアドレス')
      const submitButton = screen.getByRole('button', { name: '送信' })

      // メールアドレスを入力して送信
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)

      // 成功メッセージが表示されることを検証
      await waitFor(() => {
        expect(screen.getByText('パスワード再設定用のメールを送信しました。受信トレイをご確認ください。')).toBeInTheDocument()
      })

      // 成功後、メールアドレス入力フィールドがDOMから削除されていることを検証（queryByはnullを返す）
      expect(screen.queryByLabelText('メールアドレス')).not.toBeInTheDocument()
      // 成功後、送信ボタンがDOMから削除されていることを検証
      expect(screen.queryByRole('button', { name: '送信' })).not.toBeInTheDocument()
    })
  })

  // モーダルの開閉や状態リセットなどの操作に関するテストをグループ化
  describe('Modal Interaction', () => {
    // モーダルを閉じたときにonCloseコールバックが呼び出されることを検証
    it('calls onClose when modal is dismissed', () => {
      // モーダルをレンダリング
      render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // 閉じるボタンを取得（「close」または「閉じる」という名前のボタンを検索）
      // 注: この実装は実際のコンポーネントの実装に依存する
      const closeButton = screen.getByRole('button', { name: /close|閉じる/i })
      // 閉じるボタンをクリック
      fireEvent.click(closeButton)

      // onClose関数が呼び出されたことを検証
      expect(mockOnClose).toHaveBeenCalled()
    })

    // モーダルを閉じて再度開いたときにフォームの状態がリセットされることを検証
    it('resets form state when modal is reopened', async () => {
      // モーダルをレンダリングし、rerenderメソッドを取得（コンポーネントの再レンダリングに使用）
      const { rerender } = render(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // メールアドレス入力フィールドを取得
      const emailInput = screen.getByLabelText('メールアドレス')
      // メールアドレスを入力
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

      // モーダルを閉じる（open=falseで再レンダリング）
      rerender(<PasswordResetRequestModal open={false} onClose={mockOnClose} />)
      // モーダルを再度開く（open=trueで再レンダリング）
      rerender(<PasswordResetRequestModal open={true} onClose={mockOnClose} />)

      // メールアドレス入力フィールドの値が空文字列にリセットされていることを検証
      expect(screen.getByLabelText('メールアドレス')).toHaveValue('')
    })
  })
})
