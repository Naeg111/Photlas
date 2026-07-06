/**
 * アプリケーション設定
 * Issue#25: SplashScreen関連の定数
 */

/** SplashScreen表示時間（ミリ秒）＝最低表示時間 */
export const SPLASH_SCREEN_DURATION_MS = 2000

/**
 * Issue#156: スプラッシュ裏の初回ピン取得を待つ上限（ミリ秒）。
 * スプラッシュはピン取得完了まで待つが、取得が遅い/固まった場合でもこの時間で
 * 「ピン待ち」を打ち切ってスプラッシュを解除する（地図ロード完了は別途必須）。
 * 結果としてスプラッシュ表示は最短 SPLASH_SCREEN_DURATION_MS 〜最長この値になる。
 */
export const INITIAL_SPOTS_SPLASH_TIMEOUT_MS = 10000

/**
 * Issue#144: OAuth ログイン操作が「今」完了したことを示す sessionStorage フラグのキー。
 *
 * <p>OAuthCallbackPage がログイン完了時にセットし、App.tsx（MainContent）の
 * /users/me チェックが読んで消費する。受動的な起動（再訪）と「OAuth ログイン操作直後」を
 * 区別し、後者でのみ「ログインしました」トーストを出すために使う。
 * sessionStorage は同一タブのページセッションが続く限り保持され、iOS PWA の
 * viewport-bounce 再読み込みをまたいでも残る。 */
export const OAUTH_LOGIN_TOAST_FLAG_KEY = 'photlas_oauth_login_just_completed'
