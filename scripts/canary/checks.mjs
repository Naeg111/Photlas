// Issue#148: 死活監視 canary の検証ロジック（純粋関数）。
//
// 本番 photlas.jp の /tags（SSR ランディング）・/photo-viewer（個別 OGP）を外形監視し、
// 「CloudFront 経路漏れで S3 の SPA 殻が無言で返る」「X-Robots-Tag: noindex 誤付与」等の
// 退化を継続検知する。ここはネットワーク・AWS Synthetics ランタイムに依存しない純粋関数のみ
// （実際の HTTP 取得・Synthetics 連携は seo-canary.js）。
//
// Source of truth: documents/04_Issues/Issue#148.md §3 / §4.1 / §4.2

/** SSR の証拠とみなす hreflang の最小個数（§3。SSR は 5 言語 + x-default、S3 殻は 0）。 */
export const HREFLANG_MIN_COUNT = 5;

/** 本番サイトのオリジン（canonical / og:url の絶対 URL 前提＝§3）。 */
export const SITE_ORIGIN = 'https://photlas.jp';

/** 個別 OGP が未注入のときに残る汎用 og:image（§3。これが残る＝差し込み失敗）。 */
export const GENERIC_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

// ---- 抽出系 -----------------------------------------------------------------

/**
 * 本文中の `hreflang=` の出現回数を数える。
 * @param {string} body レスポンス本文
 * @returns {number}
 */
export function countHreflang(body) {
  if (!body) {
    return 0;
  }
  const matches = body.match(/hreflang=/g);
  return matches ? matches.length : 0;
}

/**
 * `<link rel="canonical" href="...">` の href を取り出す（属性順は問わない）。
 * @param {string} body レスポンス本文
 * @returns {string|null} 見つからなければ null
 */
export function extractCanonical(body) {
  if (!body) {
    return null;
  }
  const linkTags = body.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    if (/\brel=["']canonical["']/i.test(tag)) {
      const href = tag.match(/\bhref=["']([^"']*)["']/i);
      return href ? href[1] : null;
    }
  }
  return null;
}

/**
 * `<meta property|name="ATTR" content="...">` の content を取り出す（属性順は問わない）。
 * @param {string} body レスポンス本文
 * @param {string} attr property/name の値（例: og:url）
 * @returns {string|null} 見つからなければ null
 */
export function extractMetaContent(body, attr) {
  if (!body) {
    return null;
  }
  const metaTags = body.match(/<meta\b[^>]*>/gi) || [];
  const attrPattern = new RegExp(`\\b(?:property|name)=["']${escapeRegExp(attr)}["']`, 'i');
  for (const tag of metaTags) {
    if (attrPattern.test(tag)) {
      const content = tag.match(/\bcontent=["']([^"']*)["']/i);
      return content ? content[1] : null;
    }
  }
  return null;
}

/**
 * ヘッダ値に noindex が含まれるか（大文字小文字を無視）。
 * @param {string|null|undefined} value X-Robots-Tag の値
 * @returns {boolean}
 */
export function hasNoindex(value) {
  return typeof value === 'string' && /noindex/i.test(value);
}

/**
 * ヘッダオブジェクトからキー名を大文字小文字無視で取得する。
 * @param {Record<string,string>} headers
 * @param {string} name
 * @returns {string|undefined}
 */
export function getHeader(headers, name) {
  if (!headers) {
    return undefined;
  }
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      return headers[key];
    }
  }
  return undefined;
}

// ---- ページ単位のチェック（§3） ---------------------------------------------

/**
 * /tags/{slug}?lang=ja の SSR が退化していないか検証する。
 * @param {{status:number, headers:Record<string,string>, body:string}} response
 * @param {{slug:string}} _ctx 監視対象 slug（メッセージ用）
 * @returns {{passed:boolean, failures:string[]}}
 */
export function checkTagsPage(response, { slug } = {}) {
  const failures = [];
  const { status, headers, body } = response;

  if (status !== 200) {
    failures.push(`HTTP status ${status} (expected 200) for /tags/${slug}`);
  }
  const hreflangCount = countHreflang(body);
  if (hreflangCount < HREFLANG_MIN_COUNT) {
    failures.push(`hreflang count ${hreflangCount} < ${HREFLANG_MIN_COUNT} (SSR not served? S3 shell?)`);
  }
  const canonical = extractCanonical(body);
  if (!canonical || !canonical.startsWith(`${SITE_ORIGIN}/`)) {
    failures.push(`canonical is not an absolute ${SITE_ORIGIN} URL: ${canonical}`);
  }
  const xRobotsTag = getHeader(headers, 'x-robots-tag');
  if (hasNoindex(xRobotsTag)) {
    failures.push(`X-Robots-Tag noindex present: ${xRobotsTag}`);
  }
  return { passed: failures.length === 0, failures };
}

/**
 * /photo-viewer/{id} の個別 OGP が差し込まれているか検証する。
 * @param {{status:number, headers:Record<string,string>, body:string}} response
 * @param {{id:string}} ctx 監視対象 id
 * @returns {{passed:boolean, failures:string[]}}
 */
export function checkPhotoViewerPage(response, { id } = {}) {
  const failures = [];
  const { status, headers, body } = response;

  if (status !== 200) {
    failures.push(`HTTP status ${status} (expected 200) for /photo-viewer/${id}`);
  }
  const expectedOgUrl = `${SITE_ORIGIN}/photo-viewer/${id}`;
  const ogUrl = extractMetaContent(body, 'og:url');
  if (ogUrl !== expectedOgUrl) {
    failures.push(`og:url is ${ogUrl} (expected ${expectedOgUrl}; 個別OGP未注入? S3 shell?)`);
  }
  const ogImage = extractMetaContent(body, 'og:image');
  if (!ogImage) {
    failures.push('og:image is missing');
  } else if (ogImage === GENERIC_OG_IMAGE || ogImage.endsWith('/og-image.png')) {
    failures.push(`og:image is the generic fallback (${ogImage}); per-photo thumbnail not injected`);
  } else if (!/^https:\/\//i.test(ogImage)) {
    failures.push(`og:image is not an absolute https URL: ${ogImage}`);
  }
  const xRobotsTag = getHeader(headers, 'x-robots-tag');
  if (hasNoindex(xRobotsTag)) {
    failures.push(`X-Robots-Tag noindex present: ${xRobotsTag}`);
  }
  return { passed: failures.length === 0, failures };
}

// ---- sitemap からの監視対象選択（ハイブリッド：壊れてる=fail / 空=skip）§4.2 -----

/**
 * sitemap レスポンスが「正常な XML」かを判定する補助。
 * @param {{status:number, contentType:string}} res
 * @returns {boolean}
 */
function looksLikeXml(contentType) {
  return typeof contentType === 'string' && /xml/i.test(contentType);
}

/**
 * sitemap-tags.xml から監視対象 slug を 1 件選ぶ（ハイブリッド）。
 * - 配信障害（非 200 / XML でない）→ fail
 * - 正常だが対象 0 件 → skip
 * - 正常 + slug あり → check
 * @param {{status:number, contentType:string, body:string}} res
 * @returns {{action:'check'|'skip'|'fail', slug?:string, reason:string}}
 */
export function selectTagSlug(res) {
  const { status, contentType, body } = res;
  if (status !== 200) {
    return { action: 'fail', reason: `sitemap-tags.xml returned HTTP ${status}` };
  }
  if (!looksLikeXml(contentType)) {
    return { action: 'fail', reason: `sitemap-tags.xml is not XML (content-type: ${contentType}; SPA shell?)` };
  }
  const slug = firstMatch(body, /\/tags\/([^?<]+)/);
  if (slug) {
    return { action: 'check', slug, reason: 'tag slug selected' };
  }
  return { action: 'skip', reason: 'no indexable tags in sitemap (empty catalog)' };
}

/**
 * sitemap-photos-0.xml から監視対象 id を 1 件選ぶ（ハイブリッド）。
 * - 404 → skip（公開写真なし。backend が notFound() を返す仕様）
 * - その他の非 200 / XML でない → fail
 * - 正常 + id あり → check
 * @param {{status:number, contentType:string, body:string}} res
 * @returns {{action:'check'|'skip'|'fail', id?:string, reason:string}}
 */
export function selectPhotoId(res) {
  const { status, contentType, body } = res;
  if (status === 404) {
    return { action: 'skip', reason: 'no published photos (sitemap-photos returns 404)' };
  }
  if (status !== 200) {
    return { action: 'fail', reason: `sitemap-photos-0.xml returned HTTP ${status}` };
  }
  if (!looksLikeXml(contentType)) {
    return { action: 'fail', reason: `sitemap-photos-0.xml is not XML (content-type: ${contentType}; SPA shell?)` };
  }
  const id = firstMatch(body, /\/photo-viewer\/(\d+)/);
  if (id) {
    return { action: 'check', id, reason: 'photo id selected' };
  }
  return { action: 'skip', reason: 'empty photos sitemap' };
}

// ---- 内部ヘルパー -----------------------------------------------------------

function firstMatch(text, regex) {
  if (!text) {
    return null;
  }
  const m = text.match(regex);
  return m ? m[1] : null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
