/**
 * API設定
 *
 * 開発環境: Viteプロキシ経由（相対URL）
 * 本番環境: 環境変数 VITE_API_URL を使用
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
export const API_V1_URL = `${API_BASE_URL}/api/v1`;
