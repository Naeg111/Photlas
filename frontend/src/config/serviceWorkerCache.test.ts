/**
 * Issue#129: Service Worker による写真画像キャッシュ URL パターンのテスト
 *
 * vite.config.ts の VitePWA runtimeCaching から参照される正規表現の振る舞いを保証する。
 * 特に「本番ドメイン cdn.photlas.jp が確実にマッチすること」を恒久的に守ることが目的。
 * （旧版の `[^.]+-cdn\.photlas\.jp` は本番ドメインにマッチしないバグがあった）
 */
import { describe, it, expect } from 'vitest'
import { PHOTO_CACHE_URL_PATTERN } from './serviceWorkerCache'

describe('PHOTO_CACHE_URL_PATTERN', () => {
  describe('Issue#129 - マッチすべきURL（キャッシュ対象）', () => {
    it.each([
      ['本番 uploads jpg', 'https://cdn.photlas.jp/uploads/123/abc.jpg'],
      ['本番 uploads jpeg', 'https://cdn.photlas.jp/uploads/123/abc.jpeg'],
      ['本番 uploads png', 'https://cdn.photlas.jp/uploads/123/abc.png'],
      ['本番 uploads webp', 'https://cdn.photlas.jp/uploads/123/abc.webp'],
      ['本番 uploads heic', 'https://cdn.photlas.jp/uploads/123/abc.heic'],
      ['本番 thumbnails webp', 'https://cdn.photlas.jp/thumbnails/123/abc.webp'],
      ['ステージング uploads jpg', 'https://test-cdn.photlas.jp/uploads/123/abc.jpg'],
      ['ステージング thumbnails webp', 'https://test-cdn.photlas.jp/thumbnails/123/abc.webp'],
      ['大文字拡張子 JPG', 'https://cdn.photlas.jp/uploads/123/abc.JPG'],
      ['大文字拡張子 WEBP', 'https://cdn.photlas.jp/thumbnails/456/xyz.WEBP'],
    ])('%s: %s', (_label, url) => {
      expect(PHOTO_CACHE_URL_PATTERN.test(url)).toBe(true)
    })
  })

  describe('Issue#129 - マッチすべきでないURL（キャッシュ対象外）', () => {
    it.each([
      // 3.1 決定事項: profile-images はキャッシュしない（可変リソース）
      ['本番のプロフィール画像', 'https://cdn.photlas.jp/profile-images/123/abc.jpg'],
      ['ステージングのプロフィール画像', 'https://test-cdn.photlas.jp/profile-images/123/abc.jpg'],
      // 3.1 重要: API は絶対にキャッシュしない（Issue#127 の _t= バイパス機構を壊さないため）
      ['同一オリジン API', 'https://photlas.jp/api/v1/spots'],
      ['同一オリジン API _t= 付き', 'https://photlas.jp/api/v1/spots?_t=12345'],
      ['ステージング API', 'https://test.photlas.jp/api/v1/spots'],
      // 4.3 Mapbox 利用規約準拠: タイル画像はキャッシュ禁止
      ['Mapbox API', 'https://api.mapbox.com/styles/v1/mapbox/streets-v11'],
      ['Mapbox tile', 'https://tile.mapbox.com/abc.png'],
      // セキュリティ: HTTPS のみ対象
      ['HTTP（非HTTPS）', 'http://cdn.photlas.jp/uploads/123/abc.jpg'],
      // 未対応拡張子（4.2 の根拠: バックエンド ALLOWED_IMAGE_EXTENSIONS に含まれない）
      ['未対応拡張子 gif', 'https://cdn.photlas.jp/uploads/123/abc.gif'],
      ['未対応拡張子 svg', 'https://cdn.photlas.jp/uploads/123/abc.svg'],
      ['未対応拡張子 avif', 'https://cdn.photlas.jp/uploads/123/abc.avif'],
      // CDN 以外のサブドメイン
      ['異なるサブドメイン www', 'https://www.photlas.jp/uploads/123/abc.jpg'],
      ['CDN 以外のホスト', 'https://example.com/uploads/123/abc.jpg'],
      // 拡張子なし
      ['拡張子なし', 'https://cdn.photlas.jp/uploads/123/abc'],
    ])('%s: %s', (_label, url) => {
      expect(PHOTO_CACHE_URL_PATTERN.test(url)).toBe(false)
    })
  })

  describe('Issue#129 - 旧版バグの再発防止（致命的）', () => {
    it('本番ドメイン cdn.photlas.jp に必ずマッチすること（旧 [^.]+-cdn では本番がマッチせず、本番でキャッシュが全く効かなかった）', () => {
      const productionUrl = 'https://cdn.photlas.jp/uploads/1/test.jpg'
      expect(PHOTO_CACHE_URL_PATTERN.test(productionUrl)).toBe(true)
    })

    it('ステージングドメイン test-cdn.photlas.jp にもマッチすること', () => {
      const stagingUrl = 'https://test-cdn.photlas.jp/uploads/1/test.jpg'
      expect(PHOTO_CACHE_URL_PATTERN.test(stagingUrl)).toBe(true)
    })
  })
})
