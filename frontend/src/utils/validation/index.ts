/**
 * バリデーションユーティリティ
 * Issue#21: パスワードバリデーション統一
 * Issue#26: 認証ダイアログ用バリデーション
 */

/** パスワード最小文字数 */
export const PASSWORD_MIN_LENGTH = 8

/** パスワード最大文字数 */
export const PASSWORD_MAX_LENGTH = 20

/** 強いパスワードの最小文字数 */
export const PASSWORD_STRONG_MIN_LENGTH = 12

/** SNSリンク最大数 (Issue#102: 将来の5サービス対応用) */
export const MAX_SNS_LINKS = 5

/**
 * Issue#21: パスワードバリデーション統一
 * 8〜20文字、数字・小文字・大文字をそれぞれ1文字以上、記号は使用不可
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z0-9]{8,20}$/

/** メールアドレスの簡易バリデーション正規表現 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** パスワード強度 */
export type PasswordStrength = 'weak' | 'medium' | 'strong'

/**
 * パスワード強度を計算
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return 'weak'

  const hasNumber = /\d/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)

  const conditions = [hasNumber, hasLower, hasUpper].filter(Boolean).length

  if (conditions === 3 && password.length >= PASSWORD_STRONG_MIN_LENGTH) return 'strong'
  if (conditions >= 2) return 'medium'
  return 'weak'
}

/**
 * パスワード・メールアドレスのエラーの種類（i18n の errors.* のキー）
 * Spec#93 追加対応: 文言は表示する側で t(errorKey, errorParams) に通して、表示言語に合わせる。
 */
export type ValidationErrorKey =
  | 'errors.PASSWORD_REQUIRED'
  | 'errors.PASSWORD_LENGTH_INVALID'
  | 'errors.PASSWORD_MISSING_DIGIT'
  | 'errors.PASSWORD_MISSING_LOWERCASE'
  | 'errors.PASSWORD_MISSING_UPPERCASE'
  | 'errors.PASSWORD_CONTAINS_SYMBOL'
  | 'errors.EMAIL_REQUIRED'
  | 'errors.EMAIL_INVALID_FORMAT'

/**
 * バリデーション結果
 */
export interface ValidationResult {
  isValid: boolean
  /** エラー文言の i18n キー。問題がなければ null */
  errorKey: ValidationErrorKey | null
  /** errorKey の文言に差し込む値（{{min}} など） */
  errorParams?: Record<string, number>
}

function invalid(errorKey: ValidationErrorKey, errorParams?: Record<string, number>): ValidationResult {
  return { isValid: false, errorKey, errorParams }
}

const VALID: ValidationResult = { isValid: true, errorKey: null }

/**
 * パスワードをバリデーション（Issue#21統一要件）
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return invalid('errors.PASSWORD_REQUIRED')
  }

  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return invalid('errors.PASSWORD_LENGTH_INVALID', {
      min: PASSWORD_MIN_LENGTH,
      max: PASSWORD_MAX_LENGTH,
    })
  }

  if (!/\d/.test(password)) {
    return invalid('errors.PASSWORD_MISSING_DIGIT')
  }

  if (!/[a-z]/.test(password)) {
    return invalid('errors.PASSWORD_MISSING_LOWERCASE')
  }

  if (!/[A-Z]/.test(password)) {
    return invalid('errors.PASSWORD_MISSING_UPPERCASE')
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    return invalid('errors.PASSWORD_CONTAINS_SYMBOL')
  }

  return VALID
}

/**
 * メールアドレスをバリデーション
 */
export function validateEmail(email: string): ValidationResult {
  if (!email.trim()) {
    return invalid('errors.EMAIL_REQUIRED')
  }

  if (!EMAIL_REGEX.test(email)) {
    return invalid('errors.EMAIL_INVALID_FORMAT')
  }

  return VALID
}
