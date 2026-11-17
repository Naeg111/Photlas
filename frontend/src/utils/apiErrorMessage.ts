/**
 * Issue#93: バックエンドのエラーコードを表示言語の文言にするヘルパー
 *
 * バックエンドはエラーレスポンスに `code` を付けて返す（Spec#93 2.3 方式 B）。
 * フロントは `errors.<code>` の翻訳を表示し、`message`（日本語）は画面に出さない。
 */

import type { TFunction } from 'i18next'

/**
 * バックエンドのエラーコードの形（英大文字とアンダースコア）。
 * サーバー応答は信頼境界の外なので、`.` や `:`（i18next のキー区切り）を含むものは翻訳キーに使わない。
 */
const ERROR_CODE_PATTERN = /^[A-Z][A-Z_]*$/

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
 * - コードが無い、翻訳が無いコード（VALIDATION_ERROR・BAD_REQUEST・INTERNAL_ERROR など）、
 *   またはコードの形（英大文字とアンダースコア）でないものは `fallbackKey`（その画面の汎用の文言）
 */
export function translateErrorCode(
  code: string | undefined,
  t: TFunction,
  fallbackKey: string
): string {
  if (!code || !ERROR_CODE_PATTERN.test(code)) return t(fallbackKey)
  return t([`errors.${code}`, fallbackKey])
}
