// Issue#148: CloudWatch Synthetics canary 本体（Synthetics ランタイムで実行される handler）。
//
// 本番 photlas.jp の /tags（SSR）・/photo-viewer（個別 OGP）を 30 分おきに外形監視する。
// 検証ロジックは checks.mjs（単体テスト済み）に委譲し、ここは「sitemap から監視対象を選ぶ →
// HTTP 取得 → checks に渡す → 失敗があれば throw」だけの薄いラッパー。
// Synthetics ランタイム（Synthetics/SyntheticsLogger）依存のため単体テスト対象外。
//
// 設計（documents/04_Issues/Issue#148.md §3 / §4.2）:
//   - リダイレクトは追わず、canonical な ?lang=ja を叩く（/tags の 1 ホップ 301 を回避）
//   - sitemap が「壊れている」なら fail、「正常だが空」ならその URL をスキップ（ハイブリッド）

const log = require('SyntheticsLogger');
const https = require('node:https');

const SITE_ORIGIN = 'https://photlas.jp';
const REQUEST_TIMEOUT_MS = 15000;

/**
 * リダイレクトを追わずに 1 回だけ GET し、status / headers / body を返す。
 * @param {string} url
 * @returns {Promise<{status:number, headers:object, contentType:string, body:string}>}
 */
function fetchOnce(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        contentType: res.headers['content-type'] || '',
        body,
      }));
    });
    req.on('timeout', () => req.destroy(new Error(`request timed out: ${url}`)));
    req.on('error', reject);
  });
}

const handler = async () => {
  // ESM の純粋ロジックを動的 import（Synthetics ランタイムは CommonJS handler）。
  const checks = await import('./checks.mjs');
  const failures = [];

  // ---- /tags（SSR ランディング） ----
  const tagsSitemap = await fetchOnce(`${SITE_ORIGIN}/api/v1/sitemap-tags.xml`);
  const tagSel = checks.selectTagSlug(tagsSitemap);
  log.info(`/tags target selection: ${tagSel.action} (${tagSel.reason})`);
  if (tagSel.action === 'fail') {
    failures.push(`/tags sitemap delivery broken: ${tagSel.reason}`);
  } else if (tagSel.action === 'check') {
    const res = await fetchOnce(`${SITE_ORIGIN}/tags/${encodeURIComponent(tagSel.slug)}?lang=ja`);
    const result = checks.checkTagsPage(res, { slug: tagSel.slug });
    if (!result.passed) {
      failures.push(...result.failures.map((f) => `/tags/${tagSel.slug}: ${f}`));
    }
  }

  // ---- /photo-viewer（個別 OGP） ----
  const photosSitemap = await fetchOnce(`${SITE_ORIGIN}/api/v1/sitemap-photos-0.xml`);
  const photoSel = checks.selectPhotoId(photosSitemap);
  log.info(`/photo-viewer target selection: ${photoSel.action} (${photoSel.reason})`);
  if (photoSel.action === 'fail') {
    failures.push(`/photo-viewer sitemap delivery broken: ${photoSel.reason}`);
  } else if (photoSel.action === 'check') {
    const res = await fetchOnce(`${SITE_ORIGIN}/photo-viewer/${photoSel.id}`);
    const result = checks.checkPhotoViewerPage(res, { id: photoSel.id });
    if (!result.passed) {
      failures.push(...result.failures.map((f) => `/photo-viewer/${photoSel.id}: ${f}`));
    }
  }

  if (failures.length > 0) {
    // throw すると Synthetics は当該実行を Failed として記録 → SuccessPercent < 100 → アラーム。
    throw new Error(`SEO canary detected ${failures.length} problem(s):\n- ${failures.join('\n- ')}`);
  }
  log.info('SEO canary passed: /tags and /photo-viewer are serving SSR/OGP correctly.');
};

exports.handler = handler;
