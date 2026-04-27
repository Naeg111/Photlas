/**
 * フィールド別エラーメッセージの i18n フックヘルパー
 * Issue#98 4.10.2: A1 方式の混在環境対応
 *
 * バックエンドが `errors.` プレフィックス付きの i18n キーを返した場合は `t()` を通し、
 * それ以外（既存の固定日本語メッセージ）はそのまま返す。
 * Issue#98 移行期に「username だけ i18n キー、その他は固定日本語」が混在しても
 * 安全に処理できる。
 */

import type { TFunction } from 'i18next'

/**
 * フィールド別エラーメッセージを i18n フックで翻訳する。
 *
 * Red 段階のスケルトン: 常に Error を投げてすべてのテストを失敗させる。
 * Green 段階で本実装する。
 */
export function localizeFieldError(message: string, t: TFunction): string {
  throw new Error('Issue#98 Red phase: not yet implemented')
}
