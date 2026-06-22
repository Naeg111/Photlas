// Issue#148: 死活監視 canary の検証ロジック（純粋関数）のテスト。
//
// scripts/canary/checks.mjs は、本番 photlas.jp の /tags・/photo-viewer を
// 外形監視するために「レスポンス本文・ヘッダから §3 の条件を満たすか」を
// 判定する純粋関数群。ネットワークや AWS Synthetics ランタイムに依存しないため、
// ここで単体テストして退化を防ぐ（実際の HTTP 取得・Synthetics 連携は
// seo-canary.js 側＝ランタイム依存のため本テスト対象外）。
//
// Source of truth: documents/04_Issues/Issue#148.md §3 / §4.1 / §4.2

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const MODULE_PATH = path.resolve(__dirname, '..', 'checks.mjs');

async function load() {
  return import(MODULE_PATH);
}

// ---- フィクスチャ -----------------------------------------------------------

// SSR が効いた /tags ページ（5 言語 + x-default = hreflang 6 個、絶対 canonical）。
const TAGS_SSR_BODY = `<!DOCTYPE html><html lang="ja"><head>
<link rel="canonical" href="https://photlas.jp/tags/sakura?lang=ja" />
<link rel="alternate" hreflang="ja" href="https://photlas.jp/tags/sakura?lang=ja" />
<link rel="alternate" hreflang="en" href="https://photlas.jp/tags/sakura?lang=en" />
<link rel="alternate" hreflang="zh" href="https://photlas.jp/tags/sakura?lang=zh" />
<link rel="alternate" hreflang="ko" href="https://photlas.jp/tags/sakura?lang=ko" />
<link rel="alternate" hreflang="es" href="https://photlas.jp/tags/sakura?lang=es" />
<link rel="alternate" hreflang="x-default" href="https://photlas.jp/tags/sakura?lang=ja" />
</head><body>...</body></html>`;

// S3 の SPA 殻（SSR されていない＝事故時に返る HTML。hreflang 0・canonical は site root）。
const SPA_SHELL_BODY = `<!DOCTYPE html><html lang="ja"><head>
<link rel="canonical" href="https://photlas.jp/" />
<meta property="og:url" content="https://photlas.jp/" />
<meta property="og:image" content="https://photlas.jp/og-image.png" />
</head><body><div id="root"></div></body></html>`;

// 個別 OGP が差し込まれた /photo-viewer ページ。
const PHOTO_INJECTED_BODY = `<!DOCTYPE html><html lang="ja"><head>
<meta property="og:url" content="https://photlas.jp/photo-viewer/123" />
<meta property="og:image" content="https://d111111abcdef8.cloudfront.net/thumbnails/abc.jpg" />
</head><body><div id="root"></div></body></html>`;

const SITEMAP_TAGS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://photlas.jp/tags/sakura?lang=ja</loc></url>
<url><loc>https://photlas.jp/tags/mountain?lang=ja</loc></url>
</urlset>`;

const SITEMAP_TAGS_EMPTY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

const SITEMAP_PHOTOS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://photlas.jp/photo-viewer/123</loc></url>
<url><loc>https://photlas.jp/photo-viewer/456</loc></url>
</urlset>`;

// =====================================================================
// 抽出系の純粋関数
// =====================================================================

test('countHreflang: SSR ページは 5 以上', async () => {
  const { countHreflang } = await load();
  assert.ok(countHreflang(TAGS_SSR_BODY) >= 5);
});

test('countHreflang: SPA 殻は 0', async () => {
  const { countHreflang } = await load();
  assert.equal(countHreflang(SPA_SHELL_BODY), 0);
});

test('extractCanonical: href を取り出す', async () => {
  const { extractCanonical } = await load();
  assert.equal(extractCanonical(TAGS_SSR_BODY), 'https://photlas.jp/tags/sakura?lang=ja');
});

test('extractCanonical: 無ければ null', async () => {
  const { extractCanonical } = await load();
  assert.equal(extractCanonical('<html><head></head></html>'), null);
});

test('extractMetaContent: og:url を取り出す', async () => {
  const { extractMetaContent } = await load();
  assert.equal(
    extractMetaContent(PHOTO_INJECTED_BODY, 'og:url'),
    'https://photlas.jp/photo-viewer/123',
  );
});

test('extractMetaContent: og:image を取り出す', async () => {
  const { extractMetaContent } = await load();
  assert.equal(
    extractMetaContent(PHOTO_INJECTED_BODY, 'og:image'),
    'https://d111111abcdef8.cloudfront.net/thumbnails/abc.jpg',
  );
});

test('hasNoindex: noindex を含むヘッダ値は true', async () => {
  const { hasNoindex } = await load();
  assert.equal(hasNoindex('noindex, nofollow'), true);
  assert.equal(hasNoindex('NOINDEX'), true);
});

test('hasNoindex: 未設定や index は false', async () => {
  const { hasNoindex } = await load();
  assert.equal(hasNoindex(undefined), false);
  assert.equal(hasNoindex(null), false);
  assert.equal(hasNoindex('index, follow'), false);
});

test('getHeader: 大文字小文字を無視して取得', async () => {
  const { getHeader } = await load();
  assert.equal(getHeader({ 'x-robots-tag': 'noindex' }, 'X-Robots-Tag'), 'noindex');
  assert.equal(getHeader({ 'X-Robots-Tag': 'noindex' }, 'x-robots-tag'), 'noindex');
  assert.equal(getHeader({}, 'x-robots-tag'), undefined);
});

// =====================================================================
// /tags ページのチェック（§3）
// =====================================================================

test('checkTagsPage: 正常な SSR ページは合格', async () => {
  const { checkTagsPage } = await load();
  const result = checkTagsPage(
    { status: 200, headers: {}, body: TAGS_SSR_BODY },
    { slug: 'sakura' },
  );
  assert.equal(result.passed, true, JSON.stringify(result.failures));
  assert.equal(result.failures.length, 0);
});

test('checkTagsPage: SPA 殻（hreflang 0・canonical が site root）は不合格', async () => {
  const { checkTagsPage } = await load();
  const result = checkTagsPage(
    { status: 200, headers: {}, body: SPA_SHELL_BODY },
    { slug: 'sakura' },
  );
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => /hreflang/i.test(f)));
});

test('checkTagsPage: X-Robots-Tag noindex が付いていたら不合格', async () => {
  const { checkTagsPage } = await load();
  const result = checkTagsPage(
    { status: 200, headers: { 'x-robots-tag': 'noindex, nofollow' }, body: TAGS_SSR_BODY },
    { slug: 'sakura' },
  );
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => /robots|noindex/i.test(f)));
});

test('checkTagsPage: HTTP 200 でなければ不合格', async () => {
  const { checkTagsPage } = await load();
  const result = checkTagsPage(
    { status: 301, headers: {}, body: '' },
    { slug: 'sakura' },
  );
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => /200|status/i.test(f)));
});

// =====================================================================
// /photo-viewer ページのチェック（§3）
// =====================================================================

test('checkPhotoViewerPage: 個別 OGP 差し込み済みは合格', async () => {
  const { checkPhotoViewerPage } = await load();
  const result = checkPhotoViewerPage(
    { status: 200, headers: {}, body: PHOTO_INJECTED_BODY },
    { id: '123' },
  );
  assert.equal(result.passed, true, JSON.stringify(result.failures));
  assert.equal(result.failures.length, 0);
});

test('checkPhotoViewerPage: og:url が site root（未注入）は不合格', async () => {
  const { checkPhotoViewerPage } = await load();
  const result = checkPhotoViewerPage(
    { status: 200, headers: {}, body: SPA_SHELL_BODY },
    { id: '123' },
  );
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => /og:url/i.test(f)));
});

test('checkPhotoViewerPage: og:image が汎用 og-image.png は不合格', async () => {
  const { checkPhotoViewerPage } = await load();
  // og:url は正しいが og:image だけ汎用にフォールバックしているケース
  const body = `<meta property="og:url" content="https://photlas.jp/photo-viewer/123" />
<meta property="og:image" content="https://photlas.jp/og-image.png" />`;
  const result = checkPhotoViewerPage(
    { status: 200, headers: {}, body },
    { id: '123' },
  );
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => /og:image/i.test(f)));
});

test('checkPhotoViewerPage: X-Robots-Tag noindex は不合格', async () => {
  const { checkPhotoViewerPage } = await load();
  const result = checkPhotoViewerPage(
    { status: 200, headers: { 'X-Robots-Tag': 'noindex, nofollow' }, body: PHOTO_INJECTED_BODY },
    { id: '123' },
  );
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => /robots|noindex/i.test(f)));
});

// =====================================================================
// sitemap からの対象選択（ハイブリッド：壊れてる=fail / 空=skip）§4.2
// =====================================================================

test('selectTagSlug: 200 + slug あり → check', async () => {
  const { selectTagSlug } = await load();
  const r = selectTagSlug({ status: 200, contentType: 'application/xml', body: SITEMAP_TAGS_XML });
  assert.equal(r.action, 'check');
  assert.equal(r.slug, 'sakura');
});

test('selectTagSlug: 200 + 空 urlset → skip', async () => {
  const { selectTagSlug } = await load();
  const r = selectTagSlug({ status: 200, contentType: 'application/xml', body: SITEMAP_TAGS_EMPTY_XML });
  assert.equal(r.action, 'skip');
});

test('selectTagSlug: 200 だが SPA 殻 HTML が返る → fail（配信障害）', async () => {
  const { selectTagSlug } = await load();
  const r = selectTagSlug({ status: 200, contentType: 'text/html', body: SPA_SHELL_BODY });
  assert.equal(r.action, 'fail');
});

test('selectTagSlug: 5xx → fail', async () => {
  const { selectTagSlug } = await load();
  const r = selectTagSlug({ status: 503, contentType: 'text/html', body: 'err' });
  assert.equal(r.action, 'fail');
});

test('selectPhotoId: 200 + id あり → check', async () => {
  const { selectPhotoId } = await load();
  const r = selectPhotoId({ status: 200, contentType: 'application/xml', body: SITEMAP_PHOTOS_XML });
  assert.equal(r.action, 'check');
  assert.equal(r.id, '123');
});

test('selectPhotoId: 404（公開写真なし）→ skip', async () => {
  const { selectPhotoId } = await load();
  const r = selectPhotoId({ status: 404, contentType: 'application/json', body: '' });
  assert.equal(r.action, 'skip');
});

test('selectPhotoId: 500 → fail', async () => {
  const { selectPhotoId } = await load();
  const r = selectPhotoId({ status: 500, contentType: 'text/html', body: 'err' });
  assert.equal(r.action, 'fail');
});

test('selectPhotoId: 200 だが HTML 殻 → fail（配信障害）', async () => {
  const { selectPhotoId } = await load();
  const r = selectPhotoId({ status: 200, contentType: 'text/html', body: SPA_SHELL_BODY });
  assert.equal(r.action, 'fail');
});
