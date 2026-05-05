// Issue#117: passthrough.js（通常時の CloudFront Function コード）の単体テスト

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadHandler, buildViewerRequestEvent } = require('./test-utils');

test('passthrough.js: handler returns the original request unchanged', () => {
  const handler = loadHandler('passthrough.js');
  const event = buildViewerRequestEvent({ uri: '/photo/123' });
  const result = handler(event);
  assert.equal(result, event.request);
});

test('passthrough.js: handler does not return a response object (no statusCode)', () => {
  const handler = loadHandler('passthrough.js');
  const event = buildViewerRequestEvent();
  const result = handler(event);
  // viewer-request で request を返すと CloudFront は通常通りオリジンに転送する
  assert.equal(result.statusCode, undefined);
  assert.ok(result.uri !== undefined, 'should look like a request object');
});
