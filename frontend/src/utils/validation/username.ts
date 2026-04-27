/**
 * ユーザー名軽量バリデーション
 * Issue#98: フロント側で「明らかに NG」な入力ミスのみ即時フィードバック
 *
 * サーバー側 (UsernameValidator.java) と同じ優先順位で最初に該当した
 * エラーキーを返す。問題なければ null を返す。
 *
 * 注意: 予約語チェック・NFKC 正規化・ゼロ幅文字検出はサーバー側に委ねる。
 *       フロントは「明らかに NG」な入力ミスのみ即時フィードバックする目的。
 *
 * 仕様変更時はサーバー側 (UsernameValidator.java) と本ファイルを **両方** 更新する必要がある。
 */

/**
 * クライアント側軽量バリデーションのエラーキー（バックエンドと共通）
 */
export type UsernameErrorKey =
  | 'USERNAME_REQUIRED'
  | 'USERNAME_LENGTH_INVALID'
  | 'USERNAME_INVALID_CHARACTER_SYMBOL'
  | 'USERNAME_INVALID_CHARACTER_EMOJI'
  | 'USERNAME_INVALID_CHARACTER_FULLWIDTH'
  | 'USERNAME_INVALID_CHARACTER_HALFWIDTH_KATAKANA'

const MIN_LENGTH = 2
const MAX_LENGTH = 12

/**
 * ユーザー名を軽量検証する。問題なければ null を返す。
 */
export function validateUsername(
  username: string | null | undefined
): UsernameErrorKey | null {
  // 1. 必須チェック（trim ベース。サーバー側 isBlank と同等）
  if (username == null || username.trim() === '') {
    return 'USERNAME_REQUIRED'
  }

  // 2. 長さチェック（UTF-16 単位、Java String.length() と一致）
  if (username.length < MIN_LENGTH || username.length > MAX_LENGTH) {
    return 'USERNAME_LENGTH_INVALID'
  }

  // 3. 記号
  if (containsSymbol(username)) {
    return 'USERNAME_INVALID_CHARACTER_SYMBOL'
  }

  // 4. 絵文字
  if (containsEmoji(username)) {
    return 'USERNAME_INVALID_CHARACTER_EMOJI'
  }

  // 5. 全角英数字
  if (containsFullwidthAlphanumeric(username)) {
    return 'USERNAME_INVALID_CHARACTER_FULLWIDTH'
  }

  // 6. 半角カタカナ
  if (containsHalfwidthKatakana(username)) {
    return 'USERNAME_INVALID_CHARACTER_HALFWIDTH_KATAKANA'
  }

  // 7-10 はサーバー側に委ねる（OTHER, FIRST_CHARACTER, RESERVED, ZERO_WIDTH）
  return null
}

/**
 * 記号判定: ASCII printable (0x21-0x7E) のうち、英数字・`_`・`-` 以外。
 */
function containsSymbol(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const cp = s.charCodeAt(i)
    if (cp >= 0x30 && cp <= 0x39) continue // 0-9
    if (cp >= 0x41 && cp <= 0x5A) continue // A-Z
    if (cp >= 0x61 && cp <= 0x7A) continue // a-z
    if (cp === 0x5F || cp === 0x2D) continue // _, -
    if (cp >= 0x21 && cp <= 0x7E) return true
  }
  return false
}

/**
 * 絵文字判定: 主要な絵文字ブロックの code point を含むか。
 */
function containsEmoji(s: string): boolean {
  for (const ch of s) {
    const cp = ch.codePointAt(0)
    if (cp === undefined) continue
    if (cp >= 0x2600 && cp <= 0x26FF) return true // Misc Symbols
    if (cp >= 0x2700 && cp <= 0x27BF) return true // Dingbats
    if (cp >= 0x1F1E6 && cp <= 0x1F1FF) return true // Regional Indicator
    if (cp >= 0x1F300 && cp <= 0x1F5FF) return true
    if (cp >= 0x1F600 && cp <= 0x1F64F) return true // Emoticons
    if (cp >= 0x1F680 && cp <= 0x1F6FF) return true
    if (cp >= 0x1F900 && cp <= 0x1F9FF) return true
    if (cp >= 0x1FA70 && cp <= 0x1FAFF) return true
  }
  return false
}

/**
 * 全角英数字判定（ホモグラフ攻撃対策）。`Ａ-Ｚ`, `ａ-ｚ`, `０-９` のみ。
 */
function containsFullwidthAlphanumeric(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const cp = s.charCodeAt(i)
    if (cp >= 0xff10 && cp <= 0xff19) return true // ０-９
    if (cp >= 0xff21 && cp <= 0xff3a) return true // Ａ-Ｚ
    if (cp >= 0xff41 && cp <= 0xff5a) return true // ａ-ｚ
  }
  return false
}

/**
 * 半角カタカナ判定。Halfwidth Katakana ブロック (U+FF65-U+FF9F)。
 */
function containsHalfwidthKatakana(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const cp = s.charCodeAt(i)
    if (cp >= 0xff65 && cp <= 0xff9f) return true
  }
  return false
}
