// === React Hooks インポート ===
import { useState, useRef } from 'react'

// === Props インターフェース定義 ===
/**
 * ProfileImageUploader コンポーネントのProps
 * 
 * @interface ProfileImageUploaderProps
 * @property {function} onImageSelect - 画像選択時のコールバック関数
 */
interface ProfileImageUploaderProps {
  onImageSelect: (file: File) => void  // 選択されたファイルを親コンポーネントに通知
}

/**
 * ProfileImageUploader コンポーネント
 * Issue#2: ユーザー登録機能 (UI) - プロフィール画像アップロード機能
 * 
 * 【目的】
 * - ユーザーのプロフィール画像選択・プレビュー機能を提供
 * - ファイル選択の UX向上（ドラッグ&ドロップ風のボタンUI）
 * - 画像ファイルの検証・エラーハンドリング
 * 
 * 【主要機能】
 * - ファイル選択ダイアログの表示
 * - 選択画像のプレビュー表示（円形トリミング）
 * - ファイル形式・サイズの検証
 * - エラーメッセージの表示
 * 
 * 【技術的特徴】
 * - FileReader API による画像プレビュー
 * - useRef による隠しファイル入力の制御
 * - TypeScript による型安全なファイル操作
 * 
 * 【バリデーション仕様】
 * - 対応ファイル形式: image/* (jpeg, png, gif, webp など)
 * - 最大ファイルサイズ: 5MB
 * - プレビュー形式: 円形（64px x 64px）
 * 
 * 【TDD実装状況】
 * Green段階: テストを通すための最小実装（現在の状態）
 */
function ProfileImageUploader({ onImageSelect }: ProfileImageUploaderProps) {
  // === 画像プレビューの状態管理 ===
  // Base64エンコードされた画像データURL、または null（未選択状態）
  const [preview, setPreview] = useState<string | null>(null)
  
  // === エラーメッセージの状態管理 ===
  // ファイルバリデーションエラー時に表示するメッセージ
  const [error, setError] = useState<string>('')
  
  // === 隠しファイル入力への参照 ===
  // useRef を使用してDOM要素に直接アクセス
  // ボタンクリック時にプログラマティックにファイル選択ダイアログを開くため
  const fileInputRef = useRef<HTMLInputElement>(null)

  // === ファイル選択ボタンクリックハンドラー ===
  /**
   * 「画像を選択」ボタンがクリックされた時の処理
   * 隠しファイル入力要素のクリックイベントを発火させる
   * 
   * 【UIパターン】
   * - ネイティブのfile inputは見た目のカスタマイズが困難
   * - カスタムボタン + 隠しinput の組み合わせで解決
   * - アクセシビリティを維持しつつデザインの自由度を確保
   */
  const handleButtonClick = () => {
    // Optional chaining (?.) でnullチェック
    // fileInputRef.current が存在する場合のみ click() を実行
    fileInputRef.current?.click()
  }

  // === ファイル選択時のハンドラー ===
  /**
   * ファイル入力の値が変更された時の処理
   * 
   * 【処理フロー】
   * 1. 選択されたファイルを取得
   * 2. ファイル形式・サイズの検証
   * 3. 検証通過時: プレビュー生成 + 親コンポーネントに通知
   * 4. 検証失敗時: エラーメッセージ表示
   * 
   * @param {React.ChangeEvent<HTMLInputElement>} event - ファイル入力変更イベント
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // ファイル配列の最初の要素を取得（single file selection）
    const file = event.target.files?.[0]
    
    // ファイルが選択されていない場合は早期リターン
    // （ユーザーがキャンセルした場合など）
    if (!file) return

    // 前回のエラーメッセージをクリア
    setError('')

    // === ファイル形式の検証 ===
    // MIMEタイプの確認: image/ で始まるかチェック
    // 対応形式例: image/jpeg, image/png, image/gif, image/webp など
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください')
      return  // 検証失敗時は早期リターン
    }

    // === ファイルサイズの検証 ===
    // 制限: 5MB以下（5 * 1024 * 1024 bytes）
    // 理由: サーバー負荷軽減、アップロード時間短縮、UX向上
    if (file.size > 5 * 1024 * 1024) {
      setError('ファイルサイズは5MB以下にしてください')
      return  // 検証失敗時は早期リターン
    }

    // === プレビュー画像の生成 ===
    // FileReader API を使用してファイルをBase64データURLに変換
    // これにより、選択した画像をブラウザでプレビュー表示可能
    const reader = new FileReader()
    
    // === ファイル読み込み完了時のコールバック設定 ===
    reader.onload = (e) => {
      // 読み込み結果の存在確認（Optional chaining）
      if (e.target?.result) {
        // 結果をstring型としてキャストしてプレビュー状態に設定
        // e.target.result は string | ArrayBuffer | null の型なので型アサーションが必要
        setPreview(e.target.result as string)
      }
    }
    
    // === ファイルの読み込み開始 ===
    // readAsDataURL: ファイルをBase64エンコードされたData URLとして読み込み
    // 結果例: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
    reader.readAsDataURL(file)

    // === 親コンポーネントへの通知 ===
    // 選択されたファイルオブジェクトを親コンポーネント（RegisterPage）に渡す
    // 親側でformDataのprofileImageフィールドに格納される
    onImageSelect(file)
  }

  return (
    <div className={
      "flex items-center space-x-4"  // Flexbox: 要素を横並び + 垂直中央揃え + 16px間隔
    }>
      
      {/* === 隠しファイル入力要素 === */}
      {/* 
        実際のfile inputはhiddenで非表示にし、カスタムボタンから制御
        UIデザインパターン: ネイティブinputのスタイリング制限を回避
      */}
      <input
        ref={fileInputRef}              // useRefでDOM参照を取得（プログラマティック制御用）
        type="file"                     // ファイル選択input
        accept="image/*"                // 受け入れファイル形式: 画像のみ
        onChange={handleFileChange}     // ファイル選択時のイベントハンドラー
        className="hidden"              // 完全に非表示（display: none）
        data-testid="image-file-input"  // テスト用識別子: E2Eテストでの要素特定
      />

      {/* === カスタム画像選択ボタン === */}
      <button
        type="button"                   // フォーム送信を防ぐ（type="submit"ではない）
        onClick={handleButtonClick}     // クリック時に隠しinputのクリックを発火
        className={
          // === ベーススタイル ===
          "bg-white " +                 // 背景色: 白
          "border border-gray-300 " +   // ボーダー: 1px solid グレー
          "rounded-md " +               // 角の丸み: 6px
          
          // === 内側の余白 ===
          "px-4 py-2 " +                // パディング: 左右16px、上下8px
          
          // === テキストスタイル ===
          "text-sm font-medium " +      // フォント: 14px、ミディアム太さ
          "text-gray-700 " +            // 文字色: ダークグレー
          
          // === インタラクションスタイル ===
          "hover:bg-gray-50 " +         // ホバー時: 薄いグレー背景
          
          // === フォーカススタイル（アクセシビリティ） ===
          "focus:outline-none " +       // デフォルトのアウトライン無効化
          "focus:ring-2 " +             // フォーカス時: リング表示
          "focus:ring-offset-2 " +      // リングのオフセット: 2px
          "focus:ring-blue-500"         // リング色: 青色（ブランドカラー）
        }
      >
        {/* ボタンテキスト: 機能が明確に分かるラベル */}
        画像を選択
      </button>

      {/* === プレビュー画像表示 === */}
      {/* 
        条件付きレンダリング: previewが存在する場合のみ表示
        && 演算子: preview が truthy な場合に右側を評価・表示
      */}
      {preview && (
        <div className="flex-shrink-0">  {/* flex-shrink-0: サイズ縮小を防ぐ */}
          <img
            src={preview}                              // Base64データURL（FileReaderで生成）
            alt="プロフィール画像プレビュー"              // スクリーンリーダー用代替テキスト
            className={
              "w-16 h-16 " +                          // サイズ: 64px x 64px（固定）
              "rounded-full " +                       // 形状: 完全な円形
              "object-cover " +                       // 画像フィット: アスペクト比保持してトリミング
              "border-2 border-gray-200"              // ボーダー: 2px solid 薄いグレー
            }
          />
        </div>
      )}

      {/* === エラーメッセージ表示 === */}
      {/* 
        条件付きレンダリング: error状態が存在する場合のみ表示
        バリデーションエラー時にユーザーフレンドリーなメッセージを提供
      */}
      {error && (
        <p className={
          "text-sm " +                                // フォントサイズ: 14px
          "text-red-500"                              // 文字色: 赤色（エラーを示す）
        }>
          {/* エラーメッセージ文字列をそのまま表示 */}
          {error}
        </p>
      )}
    </div>
  )
}

// ES6 モジュールとしてエクスポート
// RegisterPage コンポーネントからインポートして使用
export default ProfileImageUploader


