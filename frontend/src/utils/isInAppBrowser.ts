/**
 * Issue#110: アプリ内ブラウザ（Gmail / LINE / Instagram 等）かどうかを判定する。
 * これらのブラウザはメインブラウザと localStorage を共有しないため、
 * 認証完了後の動線（リンク表示・タブ間連携）を変える必要がある。
 *
 * 完全な網羅は困難だが、主要なアプリ内ブラウザをカバーする。
 * 未検出のアプリ内ブラウザは通常ブラウザと同じ動作になるが、
 * リンクをタップしてもアプリ内ブラウザ版の Photlas が開くだけなので大きな問題にはならない。
 */
export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || ''
  return /Line\//i.test(ua)      // LINE
    || /FBAN|FBAV/i.test(ua)     // Facebook
    || /Instagram/i.test(ua)     // Instagram
    || /Twitter/i.test(ua)       // X (Twitter)
    || /GoogleApp/i.test(ua)     // Gmail アプリ
    || /\bwv\b/i.test(ua)        // Android WebView (汎用)
}
