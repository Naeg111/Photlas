/**
 * Issue#81 Phase 8g - OAuth 機能の有効判定ユーティリティ。
 *
 * <p>ビルド時の {@code VITE_OAUTH_ENABLED} 環境変数を評価する。
 * {@code OAuthButtons} や {@code App.tsx} の新規登録分岐など、
 * 複数箇所から共通で利用する。
 *
 * <p>テストでは {@code vi.stubEnv('VITE_OAUTH_ENABLED', 'true')} でスタブ可能。
 */
export function isOAuthEnabled(): boolean {
  const value = (import.meta.env as Record<string, unknown>).VITE_OAUTH_ENABLED
  return value === 'true' || value === true
}
