/**
 * Issue#93: バックエンドのエラーコードを表示言語の文言にするヘルパー
 *
 * バックエンドはエラーレスポンスに `code` を付けて返す（Spec#93 2.3 方式 B）。
 * フロントは `errors.<code>` の翻訳を表示し、`message`（日本語）は画面に出さない。
 */

import type { TFunction } from 'i18next'

/**
 * エラーレスポンスの本文から `code` を取り出す。
 * 本文がオブジェクトでない、または `code` が文字列でない場合は undefined。
 */
export function getErrorCode(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const code = (data as { code?: unknown }).code
  return typeof code === 'string' && code !== '' ? code : undefined
}

/**
 * エラーコードを表示言語の文言にする。
 *
 * - `errors.<code>` の翻訳があればその文言
 * - コードが無い、または翻訳が無いコード（VALIDATION_ERROR・BAD_REQUEST・INTERNAL_ERROR など）は
 *   `fallbackKey`（その画面の汎用の文言）
 */
export function translateErrorCode(
  code: string | undefined,
  t: TFunction,
  fallbackKey: string
): string {
  if (!code) return t(fallbackKey)
  return t([`errors.${code}`, fallbackKey])
}
