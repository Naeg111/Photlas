// === React Hooks インポート ===
import { useState, useCallback } from 'react'

// === 子コンポーネント インポート ===
import ProfileImageUploader from '../components/ProfileImageUploader'  // プロフィール画像アップロード機能
import SNSLinksInput from '../components/SNSLinksInput'                // SNSリンク動的入力機能

/**
 * RegisterPage コンポーネント
 * Issue#2: ユーザー登録機能 (UI) - メインページ
 * 
 * 【目的】
 * - 新規ユーザーのアカウント登録フォームを提供
 * - 詳細なバリデーション機能付きの入力フォーム
 * - Issue#2要件に基づく完全なUI実装
 * 
 * 【主要機能】
 * - プロフィール画像アップロード（ファイル選択・プレビュー）
 * - 基本情報入力（表示名、メール、パスワード）
 * - SNSリンク動的入力（最大3件）
 * - リアルタイムバリデーション
 * - エラー表示・ユーザビリティ向上
 * 
 * 【技術的特徴】
 * - Controlled Components パターン
 * - useState による状態管理
 * - useCallback によるパフォーマンス最適化
 * - TypeScript による型安全性
 * 
 * 【ルーティング】
 * - アクセスパス: /register
 * - 成功時遷移: /register/success
 * 
 * 【TDD実装状況】
 * Green段階: テストを通すための最小実装（現在の状態）
 * - フォームUI実装完了
 * - バリデーション機能実装完了
 * - API連携は Issue#3 で実装予定
 */
function RegisterPage() {
  // === フォームデータの状態管理 ===
  // Controlled Components パターン: 全ての入力値をReact state で管理
  const [formData, setFormData] = useState({
    displayName: '',                        // 表示名: ユーザーの公開表示名
    email: '',                             // メールアドレス: ログイン時に使用
    password: '',                          // パスワード: ログイン認証用
    confirmPassword: '',                   // パスワード確認: 入力ミス防止
    profileImage: null as File | null,     // プロフィール画像: ファイルオブジェクト
    snsLinks: [''] as string[],           // SNSリンク配列: 最低1つの空文字から開始
    termsAccepted: false                   // 利用規約同意: 必須チェック項目
  })

  // === エラーメッセージの状態管理 ===
  // バリデーション結果を格納するオブジェクト
  // key: フィールド名、value: エラーメッセージ文字列
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  // === フォームバリデーション関数 ===
  /**
   * 全フィールドの入力値を検証し、エラーメッセージを生成
   * 
   * 【バリデーション方針】
   * - クライアントサイドバリデーション（UX向上）
   * - サーバーサイドでも同様の検証を実施予定（セキュリティ）
   * - ユーザーフレンドリーなエラーメッセージ
   * 
   * @returns {Object} エラーオブジェクト（key: フィールド名, value: エラーメッセージ）
   */
  const validateForm = () => {
    // エラーメッセージを格納するオブジェクトを初期化
    const newErrors: { [key: string]: string } = {}

    // === 表示名バリデーション ===
    // trim()で前後の空白を除去してからチェック
    if (!formData.displayName.trim()) {
      newErrors.displayName = '表示名を入力してください'
    }
    // TODO: 将来的に文字数制限（例：2-20文字）や不適切語句チェックを追加

    // === メールアドレスバリデーション ===
    if (!formData.email.trim()) {
      // 必須チェック: 空文字チェック
      newErrors.email = 'メールアドレスを入力してください'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      // 形式チェック: 正規表現による基本的なメール形式検証
      // パターン説明: 
      // - ^[^\s@]+ : 開始から空白・@以外の文字が1文字以上
      // - @ : アットマーク必須
      // - [^\s@]+ : 空白・@以外の文字が1文字以上（ドメイン名）
      // - \. : ドット必須
      // - [^\s@]+$ : 空白・@以外の文字が1文字以上で終了（TLD）
      newErrors.email = '正しいメールアドレスを入力してください'
    }
    // TODO: Issue#3でメールアドレスの重複チェック（API連携）を実装

    // === パスワードバリデーション ===
    if (!formData.password) {
      // 必須チェック: パスワード未入力
      newErrors.password = 'パスワードを入力してください'
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z0-9]{8,20}$/.test(formData.password)) {
      // 複雑性チェック: セキュリティ要件に基づくパスワード強度検証
      // Issue#21: パスワードバリデーション統一
      // 正規表現パターン説明:
      // - (?=.*[a-z]) : 先読み（小文字が含まれることを確認）
      // - (?=.*[A-Z]) : 先読み（大文字が含まれることを確認）
      // - (?=.*\d) : 先読み（数字が含まれることを確認）
      // - [A-Za-z0-9]{8,20} : 英数字のみ8〜20文字（記号を除外）
      newErrors.password = 'パスワードは8〜20文字で、数字・小文字・大文字をそれぞれ1文字以上含め、記号は使用できません'
    }

    // === パスワード確認バリデーション ===
    // 入力ミス防止: パスワードとパスワード確認の一致チェック
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'パスワードが一致しません'
    }

    // === 利用規約同意バリデーション ===
    // 法的要件: 利用規約への明示的な同意が必要
    if (!formData.termsAccepted) {
      newErrors.terms = '利用規約に同意してください'
    }

    // バリデーション結果のエラーオブジェクトを返却
    return newErrors
  }

  // === フォーム送信ハンドラー ===
  /**
   * フォーム送信時の処理
   * 
   * 【処理フロー】
   * 1. デフォルトのフォーム送信を防止
   * 2. バリデーション実行
   * 3. エラーがなければ登録処理実行（現在はログ出力のみ）
   * 
   * @param {React.FormEvent} e - フォーム送信イベント
   */
  const handleSubmit = (e: React.FormEvent) => {
    // ブラウザのデフォルトフォーム送信を防止
    // （ページリロードを防ぎ、JavaScriptで制御）
    e.preventDefault()
    
    // フォーム全体のバリデーション実行
    const newErrors = validateForm()
    
    // エラー状態を更新（UIに反映される）
    setErrors(newErrors)

    // エラーがない場合のみ登録処理を実行
    if (Object.keys(newErrors).length === 0) {
      // バリデーション通過
      // TODO: API呼び出し実装予定
    }
  }

  // === 汎用入力フィールド変更ハンドラー ===
  /**
   * フォーム内の各入力フィールドの値変更を処理
   * 
   * 【対象フィールド】
   * - displayName: 表示名
   * - email: メールアドレス  
   * - password: パスワード
   * - confirmPassword: パスワード確認
   * - termsAccepted: 利用規約同意（boolean）
   * 
   * 【UX改善機能】
   * - 入力開始時に該当フィールドのエラーメッセージを即座にクリア
   * - リアルタイムフィードバックでユーザビリティ向上
   * 
   * @param {string} field - 更新対象のフィールド名
   * @param {string | boolean} value - 新しい値（文字列またはboolean）
   */
  const handleInputChange = (field: string, value: string | boolean) => {
    // イミューダブルな状態更新: 既存データを保持しつつ指定フィールドのみ更新
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // === エラー状態のクリア ===
    // ユーザーが入力を開始した時点で、該当フィールドのエラーを削除
    // UX原則: エラー修正の意図を示したタイミングでフィードバック改善
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }  // 既存エラーを保持
        delete newErrors[field]        // 該当フィールドのエラーのみ削除
        return newErrors
      })
    }
  }

  // === プロフィール画像選択ハンドラー ===
  /**
   * ProfileImageUploader コンポーネントからのファイル選択通知を処理
   * 
   * 【処理内容】
   * - 選択されたファイルオブジェクトをformDataに格納
   * - ファイルの実際のアップロードは登録API呼び出し時に実行（Issue#3）
   * 
   * @param {File} file - 選択された画像ファイル
   */
  const handleImageSelect = (file: File) => {
    // profileImageフィールドにFileオブジェクトを設定
    setFormData(prev => ({ ...prev, profileImage: file }))
  }

  // === SNSリンク配列変更ハンドラー ===
  /**
   * SNSLinksInput コンポーネントからのリンク配列更新通知を処理
   * 
   * 【useCallback使用理由】
   * - SNSLinksInputは依存配列にこの関数を含める可能性がある
   * - 不要な再レンダリングを防ぐためメモ化が必要
   * - 空の依存配列: この関数は他の状態に依存せず変更不要
   * 
   * @param {string[]} links - 更新されたSNSリンクの配列
   */
  const handleSNSLinksChange = useCallback((links: string[]) => {
    // snsLinksフィールドに新しい配列を設定
    setFormData(prev => ({ ...prev, snsLinks: links }))
  }, [])  // 空の依存配列: 関数の内容が他の値に依存しないため

  // ボタンは常に有効にして、送信時にバリデーションを行う
  // const validationErrors = useMemo(() => validateForm(), [formData])
  // const isFormValid = useMemo(() => Object.keys(validationErrors).length === 0, [validationErrors])

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">アカウント登録</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* プロフィール画像アップローダー */}
          <div>
            <ProfileImageUploader onImageSelect={handleImageSelect} />
          </div>

          {/* 表示名 */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
              表示名
            </label>
            <input
              type="text"
              id="displayName"
              value={formData.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                errors.displayName ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.displayName && (
              <p className="mt-1 text-sm text-red-500">{errors.displayName}</p>
            )}
          </div>

          {/* メールアドレス */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email}</p>
            )}
          </div>

          {/* パスワード */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password}</p>
            )}
          </div>

          {/* パスワード（確認用） */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              パスワード（確認用）
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
            )}
          </div>

          {/* SNSリンク入力欄 */}
          <div>
            <SNSLinksInput links={formData.snsLinks} onLinksChange={handleSNSLinksChange} />
          </div>

          {/* 利用規約 */}
          <div>
            <div className="border rounded-md p-4 h-32 overflow-y-auto bg-gray-50 mb-4">
              <h3 className="font-bold mb-2">利用規約</h3>
              <p className="text-sm text-gray-600">
                本サービスを利用する際は、以下の利用規約に同意いただく必要があります。
                利用規約の詳細な内容がここに表示されます。
              </p>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.termsAccepted}
                onChange={(e) => handleInputChange('termsAccepted', e.target.checked)}
                className="mr-2"
                aria-label="利用規約に同意する"
              />
              <span className="text-sm">利用規約に同意する</span>
            </label>
            {errors.terms && (
              <p className="mt-1 text-sm text-red-500">{errors.terms}</p>
            )}
          </div>

          {/* 登録ボタン */}
          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              登録する
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegisterPage
