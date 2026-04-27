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

/**
 * ユーザー名を軽量検証する。問題なければ null を返す。
 *
 * Red 段階のスケルトン: 常に Error を投げてすべてのテストを失敗させる。
 * Green 段階で本実装する。
 */
export function validateUsername(
  username: string | null | undefined
): UsernameErrorKey | null {
  throw new Error('Issue#98 Red phase: not yet implemented')
}
