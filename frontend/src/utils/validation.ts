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

/** SNSリンク最大数 */
export const MAX_SNS_LINKS = 3

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

  const hasNumber = /[0-9]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)

  const conditions = [hasNumber, hasLower, hasUpper].filter(Boolean).length

  if (conditions === 3 && password.length >= PASSWORD_STRONG_MIN_LENGTH) return 'strong'
  if (conditions >= 2) return 'medium'
  return 'weak'
}

/**
 * パスワードバリデーション結果
 */
export interface PasswordValidationResult {
  isValid: boolean
  errorMessage: string | null
}

/**
 * パスワードをバリデーション（Issue#21統一要件）
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password) {
    return { isValid: false, errorMessage: 'パスワードを入力してください' }
  }

  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return {
      isValid: false,
      errorMessage: `パスワードは${PASSWORD_MIN_LENGTH}文字以上${PASSWORD_MAX_LENGTH}文字以内で入力してください`,
    }
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, errorMessage: 'パスワードには数字を1文字以上含めてください' }
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, errorMessage: 'パスワードにはローマ字小文字を1文字以上含めてください' }
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, errorMessage: 'パスワードにはローマ字大文字を1文字以上含めてください' }
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    return { isValid: false, errorMessage: 'パスワードに記号を含めることはできません' }
  }

  return { isValid: true, errorMessage: null }
}

/**
 * メールアドレスをバリデーション
 */
export function validateEmail(email: string): PasswordValidationResult {
  if (!email.trim()) {
    return { isValid: false, errorMessage: 'メールアドレスを入力してください' }
  }

  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, errorMessage: '正しいメールアドレスの形式で入力してください' }
  }

  return { isValid: true, errorMessage: null }
}
