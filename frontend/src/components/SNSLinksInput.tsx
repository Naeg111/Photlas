// === React Hooks インポート ===
import { useState } from 'react'

// === Props インターフェース定義 ===
/**
 * SNSLinksInput コンポーネントのProps
 * 
 * @interface SNSLinksInputProps
 * @property {string[]} links - SNSリンクの配列（親コンポーネントから渡される）
 * @property {function} onLinksChange - リンク配列変更時のコールバック関数
 */
interface SNSLinksInputProps {
  links: string[]                        // 現在のSNSリンクの配列
  onLinksChange: (links: string[]) => void  // リンク更新時に親コンポーネントに通知
}

/**
 * SNSLinksInput コンポーネント
 * Issue#2: ユーザー登録機能 (UI) - SNSリンク動的入力欄
 * 
 * 【目的】
 * - ユーザーのSNSリンク（Twitter、Instagram等）を動的に入力できる機能
 * - 使いやすさを重視した段階的な入力欄表示
 * - リアルタイムURLバリデーション
 * 
 * 【主要機能】
 * - 動的入力欄追加（最大3件まで）
 * - URL形式のリアルタイム検証
 * - 空欄の自動整理
 * - エラーメッセージ表示
 * 
 * 【技術的特徴】
 * - Controlled Components パターン（完全に親が状態管理）
 * - URL検証にWeb API標準のURLオブジェクトを使用
 * - アクセシビリティ対応（aria-label、aria-describedby）
 * 
 * 【UXデザイン】
 * - 入力時に次の欄が自動表示（Progressive Disclosure）
 * - 不要な空欄は自動削除（クリーンなUI）
 * - エラー表示はフィールド単位（具体的なフィードバック）
 * 
 * 【TDD実装状況】
 * Green段階: テストを通すための最小実装（現在の状態）
 */
function SNSLinksInput({ links, onLinksChange }: SNSLinksInputProps) {
  // === エラー状態の管理 ===
  // key: 入力欄のインデックス番号、value: エラーメッセージ文字列
  // 各入力欄で個別にエラー状態を管理
  const [errors, setErrors] = useState<{ [key: number]: string }>({})

  // === 表示用リンク配列の計算 ===
  // 親から渡されたlinksが空の場合、最低1つの空文字列を表示
  // これにより、常に最低1つの入力欄が表示される
  const displayLinks = links.length === 0 ? [''] : links

  // === URL バリデーション関数 ===
  /**
   * URL形式の妥当性を検証
   * 
   * 【検証ルール】
   * 1. 空文字列は有効（任意入力のため）
   * 2. URLオブジェクトで構文解析可能
   * 3. プロトコルがhttp://またはhttps://
   * 
   * @param {string} url - 検証対象のURL文字列
   * @returns {boolean} true: 有効、false: 無効
   */
  const validateURL = (url: string): boolean => {
    // 空文字列（トリム後）は有効とする
    // SNSリンクは任意入力項目のため
    if (!url.trim()) return true
    
    try {
      // Web API標準のURLコンストラクタで検証
      // 無効なURL形式の場合、例外がスローされる
      const urlObj = new URL(url)
      
      // プロトコルの確認: セキュリティ上、http/httpsのみ許可
      // javascript: data: などの危険なプロトコルを除外
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      // URLコンストラクタで例外が発生した場合は無効なURL
      return false
    }
  }

  // === 入力値変更ハンドラー ===
  /**
   * 入力欄の値が変更された時の処理
   * 
   * 【機能】
   * 1. 入力値を配列に反映
   * 2. 動的入力欄の追加（Progressive Disclosure）
   * 3. 空欄の自動削除（UI整理）
   * 4. エラーメッセージのクリア
   * 
   * @param {number} index - 変更された入力欄のインデックス
   * @param {string} value - 新しい入力値
   */
  const handleInputChange = (index: number, value: string) => {
    // イミューダブルな配列操作: 元の配列を変更せず新しい配列を作成
    const newLinks = [...displayLinks]
    newLinks[index] = value

    // === 動的入力欄追加ロジック ===
    // 条件:
    // 1. 入力値が空でない（value.trim()）
    // 2. 最後の入力欄での入力（index === newLinks.length - 1）
    // 3. 最大数に達していない（newLinks.length < 3）
    if (value.trim() && index === newLinks.length - 1 && newLinks.length < 3) {
      newLinks.push('')  // 新しい空の入力欄を追加
    }

    // === 空欄削除ロジック ===
    // 中間の入力欄が空になった場合、後続の入力欄を削除
    // ただし、最低1つの入力欄は保持
    if (!value.trim() && index < newLinks.length - 1) {
      // 現在の位置まで（index + 1個）を保持
      const filteredLinks = newLinks.slice(0, index + 1)
      
      // 配列が完全に空になることを防ぐ
      if (filteredLinks.length === 0) {
        filteredLinks.push('')
      }
      
      // 削除された配列で親コンポーネントに通知
      onLinksChange(filteredLinks)
    } else {
      // 通常の更新: 現在の配列で親コンポーネントに通知
      onLinksChange(newLinks)
    }

    // === エラー状態のクリア ===
    // 入力値が変更された際、そのフィールドのエラーをクリア
    // UX向上: ユーザーが修正動作を開始した時点でエラー消去
    if (errors[index]) {
      const newErrors = { ...errors }  // イミューダブルなオブジェクト操作
      delete newErrors[index]          // 該当インデックスのエラーを削除
      setErrors(newErrors)
    }
  }

  // === フォーカスアウト時のバリデーション ===
  /**
   * 入力欄からフォーカスが外れた時のURL検証
   * 
   * 【タイミング】
   * - ユーザーが入力を完了してフィールドを離れた時
   * - リアルタイム過ぎない適度なタイミングでバリデーション実行
   * 
   * 【検証ロジック】
   * - 空欄は検証スキップ（任意項目のため）
   * - 入力がある場合のみURL形式を検証
   * 
   * @param {number} index - フォーカスアウトした入力欄のインデックス
   * @param {string} value - 現在の入力値
   */
  const handleBlur = (index: number, value: string) => {
    // 入力値が存在し、かつURL形式が無効な場合のみエラー設定
    if (value.trim() && !validateURL(value)) {
      setErrors(prev => ({
        ...prev,                                    // 既存のエラーを保持
        [index]: '正しいURLを入力してください'        // 該当インデックスにエラー追加
      }))
    }
    // 空欄または有効なURLの場合は何もしない（エラーを設定しない）
  }

  return (
    <div className="space-y-4">  {/* 垂直方向に16pxの間隔で入力欄を配置 */}
      
      {/* === 動的入力欄の生成 === */}
      {/* 
        配列のmapメソッドで各SNSリンク入力欄を動的生成
        displayLinksの要素数に応じて入力欄の数が決まる
      */}
      {displayLinks.map((link, index) => (
        <div key={index}>  {/* React key: 各入力欄を一意に識別 */}
          
          {/* === ラベル要素 === */}
          <label 
            htmlFor={`sns-link-${index}`}        // 対応するinput要素との関連付け
            className={
              "block " +                         // ブロック要素として表示
              "text-sm font-medium " +           // フォント: 14px、ミディアム太さ
              "text-gray-700"                    // 文字色: ダークグレー
            }
          >
            {/* ラベルテキスト: 入力欄番号を表示（1から開始） */}
            SNSリンク {index + 1}
          </label>
          
          {/* === URL入力フィールド === */}
          <input
            type="url"                          // HTML5 URL input: ブラウザ標準のURL検証
            id={`sns-link-${index}`}            // 一意のID: ラベルとの関連付け用
            
            // === アクセシビリティ属性 ===
            aria-label={`SNSリンク ${index + 1}`}  // スクリーンリーダー用ラベル
            aria-describedby={errors[index] ? `sns-link-error-${index}` : undefined}  // エラー要素との関連付け
            
            // === Controlled Component ===
            value={link}                        // 親コンポーネントから受け取った値
            onChange={(e) => handleInputChange(index, e.target.value)}  // 入力値変更時の処理
            onBlur={(e) => handleBlur(index, e.target.value)}          // フォーカスアウト時のバリデーション
            
            // === UX向上 ===
            placeholder="https://twitter.com/username など"  // 入力例の表示
            
            // === スタイリング ===
            className={
              // === ベーススタイル ===
              "mt-1 block w-full " +             // マージン上1、ブロック要素、幅100%
              "px-3 py-2 " +                     // パディング: 左右12px、上下8px
              "border rounded-md shadow-sm " +   // ボーダー、角丸、影
              
              // === フォーカススタイル ===
              "focus:outline-none " +            // デフォルトアウトライン無効化
              "focus:ring-blue-500 " +           // フォーカス時リング: 青色
              "focus:border-blue-500 " +         // フォーカス時ボーダー: 青色
              
              // === エラー状態による条件付きスタイル ===
              // エラーがある場合は赤いボーダー、ない場合は通常のグレー
              (errors[index] ? 'border-red-500' : 'border-gray-300')
            }
          />
          
          {/* === エラーメッセージ表示 === */}
          {/* 
            条件付きレンダリング: 該当インデックスにエラーがある場合のみ表示
            && 演算子: 左側がtruthyの場合に右側を評価・レンダリング
          */}
          {errors[index] && (
            <p 
              id={`sns-link-error-${index}`}    // aria-describedbyとの関連付け用ID
              className={
                "mt-1 " +                       // マージン上: 4px
                "text-sm " +                    // フォントサイズ: 14px
                "text-red-500"                  // 文字色: 赤色（エラーを示す）
              }
            >
              {/* エラーメッセージ文字列をそのまま表示 */}
              {errors[index]}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ES6 モジュールとしてエクスポート
// RegisterPage コンポーネントからインポートして使用
export default SNSLinksInput
