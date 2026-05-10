/**
 * Issue#129: Service Worker による写真画像キャッシュの設定
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

/**
 * LRU で保持するエントリ件数の上限。
 *
 * Workbox の `expiration.maxEntries` はバイト数ではなく **件数** で制御する。
 * HEIC は 1 枚 5〜15MB になりうるため、件数を絞らないと最悪数 GB に膨れる可能性がある。
 * モバイルストレージ枯渇を防ぐため、安全側で 200 件に設定。
 *
 * 200 件 × 平均 1MB（webp サムネ中心の想定）≒ 約 200MB が現実的な期待上限。
 */
export const PHOTO_CACHE_MAX_ENTRIES = 200

/** 1 日の秒数（マジックナンバー回避用）。 */
const SECONDS_PER_DAY = 60 * 60 * 24

/** キャッシュエントリの最大保持期間（秒）。30 日。 */
export const PHOTO_CACHE_MAX_AGE_SECONDS = SECONDS_PER_DAY * 30

/**
 * キャッシュ可能と見なす HTTP ステータスコード。
 *
 * - 0: opaque レスポンス（CORS 無し fetch、`<img>` の no-cors 取得など）
 * - 200: 通常の成功レスポンス
 *
 * `<img src>` 経由で取得される写真は no-cors なので opaque になる。
 * 一方、PhotoLightbox の `fetch()` 経由では CORS が設定済み (Issue#88) のため 200 になる。
 * どちらも許容する。
 */
export const PHOTO_CACHEABLE_STATUSES: readonly number[] = [0, 200]
