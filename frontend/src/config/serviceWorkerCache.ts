/**
 * Issue#129: Service Worker による写真画像キャッシュの URL パターン定義
 *
 * vite.config.ts の VitePWA `runtimeCaching` から参照される。
 * 別モジュールに切り出すことで Vitest からテスト可能にしている
 * （`vite.config.ts` 自体は Vitest 環境では実行されないため）。
 *
 * キャッシュ対象（CacheFirst 戦略）:
 * - 本番 CDN: https://cdn.photlas.jp/uploads/* | /thumbnails/*
 * - ステージング CDN: https://test-cdn.photlas.jp/uploads/* | /thumbnails/*
 *
 * 構造的にキャッシュ対象外（urlPattern が物理的にマッチしない）:
 * - profile-images/ 配下: 可変リソースのためキャッシュ不適
 * - 同一オリジン /api/v1/*: Issue#127 の `_t=` バイパス機構を壊さないため
 * - Mapbox 系: 利用規約で恒久キャッシュ禁止
 *
 * バグ防止メモ:
 * 旧版の `[^.]+-cdn\.photlas\.jp` は本番ドメイン `cdn.photlas.jp` にマッチしなかった
 * （`XXX-cdn` の `XXX` 部分が必須になるため）。`(?:test-)?cdn` で本番にも確実にマッチさせる。
 */
export const PHOTO_CACHE_URL_PATTERN =
  /^https:\/\/(?:test-)?cdn\.photlas\.jp\/(uploads|thumbnails)\/.*\.(webp|jpg|jpeg|png|heic)$/i

/**
 * Service Worker のキャッシュ名。
 * 写真フォーマット変更等で全ユーザーのキャッシュを破棄したい場合は
 * v1 → v2 に bump する（CHANGELOG / コミットメッセージにその旨を記載）。
 */
export const PHOTO_CACHE_NAME = 'photlas-photos-v1'
