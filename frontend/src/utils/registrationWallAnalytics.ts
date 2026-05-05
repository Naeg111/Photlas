/**
 * Issue#118: 登録壁の GA4 イベント送信ユーティリティ。
 *
 * GA4 + Consent Mode（CookieConsentBanner.tsx 参照）が既に組み込まれている前提で、
 * 登録壁の表示・操作・コンバージョンを計測する。
 *
 * gtag 未定義時もクラッシュしないようガードしている（CookieConsentBanner と同じパターン）。
 */

export type RegistrationWallEvent =
  | 'registration_wall_shown'
  | 'registration_wall_signup_click'
  | 'registration_wall_login_click'
  | 'registration_wall_about_click'
  | 'registration_wall_signup_success'
  | 'registration_wall_login_success'

export function trackRegistrationWallEvent(eventName: RegistrationWallEvent): void {
  if (typeof gtag === 'function') {
    gtag('event', eventName)
  }
}
