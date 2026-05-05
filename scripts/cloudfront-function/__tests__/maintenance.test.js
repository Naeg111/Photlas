// Issue#117: maintenance.js（メンテナンス時の CloudFront Function コード）の単体テスト
//
// maintenance.js は build-maintenance-function.sh が
// scripts/maintenance.html を埋め込んで生成する成果物。
// テスト前にビルドを実行してから生成物を検証する。

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadHandler, buildViewerRequestEvent, FUNCTION_DIR } = require('./test-utils');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BUILD_SCRIPT = path.join(REPO_ROOT, 'scripts', 'build-maintenance-function.sh');
const MAINTENANCE_JS = path.join(FUNCTION_DIR, 'maintenance.js');

before(() => {
  // ビルドスクリプトの存在を前提に、毎回ビルドし直して最新の HTML を反映する
  if (!fs.existsSync(BUILD_SCRIPT)) {
    throw new Error(`build script not found: ${BUILD_SCRIPT}`);
  }
  execFileSync('bash', [BUILD_SCRIPT], { cwd: REPO_ROOT, stdio: 'pipe' });
});

test('maintenance.js: build script produces maintenance.js', () => {
  assert.ok(fs.existsSync(MAINTENANCE_JS), `maintenance.js should exist at ${MAINTENANCE_JS}`);
});

test('maintenance.js: placeholder __MAINTENANCE_HTML__ is replaced', () => {
  const code = fs.readFileSync(MAINTENANCE_JS, 'utf8');
  assert.ok(!code.includes('__MAINTENANCE_HTML__'), 'placeholder must be replaced after build');
});

test('maintenance.js: handler returns 503 with HTML body', () => {
  const handler = loadHandler('maintenance.js');
  const event = buildViewerRequestEvent({ uri: '/photo/123' });
  const response = handler(event);
  assert.equal(response.statusCode, 503);
  assert.equal(response.statusDescription, 'Service Unavailable');
  assert.ok(response.body, 'response body should be a non-empty string');
  assert.ok(response.body.includes('<html'), 'body should contain HTML');
});

test('maintenance.js: response sets content-type, cache-control, retry-after headers', () => {
  const handler = loadHandler('maintenance.js');
  const response = handler(buildViewerRequestEvent());
  assert.equal(response.headers['content-type'].value, 'text/html; charset=utf-8');
  assert.match(response.headers['cache-control'].value, /no-cache/);
  assert.match(response.headers['cache-control'].value, /no-store/);
  assert.equal(response.headers['retry-after'].value, '10800');
});

test('maintenance.js: body contains required Japanese and English messages', () => {
  const handler = loadHandler('maintenance.js');
  const response = handler(buildViewerRequestEvent());
  assert.match(response.body, /ただいまメンテナンス中です/);
  assert.match(response.body, /しばらくお待ちください/);
  assert.match(response.body, /Currently under maintenance/);
});

test('maintenance.js: body embeds Photlas SVG logo (map pin path)', () => {
  const handler = loadHandler('maintenance.js');
  const response = handler(buildViewerRequestEvent());
  assert.match(response.body, /<svg/);
  // SplashScreen.tsx と同じ map pin の path コマンド冒頭を検証
  assert.match(response.body, /M256 80C180 80/);
});

test('maintenance.js: handler works for any URI (subpath fallthrough)', () => {
  const handler = loadHandler('maintenance.js');
  for (const uri of ['/', '/photo/1', '/about', '/login?next=/me']) {
    const response = handler(buildViewerRequestEvent({ uri }));
    assert.equal(response.statusCode, 503, `uri=${uri} should still return 503`);
  }
});

test('maintenance.js: total file size stays under 10KB CloudFront Function limit', () => {
  const stat = fs.statSync(MAINTENANCE_JS);
  // CloudFront Function のコードサイズ上限は 10KB (10240 bytes)。
  // 余裕があるかどうかも参考のためメッセージに含める。
  assert.ok(
    stat.size < 10240,
    `maintenance.js is ${stat.size} bytes; must be < 10240 bytes (CloudFront Function limit)`
  );
});
