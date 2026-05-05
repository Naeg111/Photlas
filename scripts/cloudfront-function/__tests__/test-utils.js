// Issue#117: CloudFront Function のローカルテストヘルパー
//
// CloudFront Function は AWS のエッジ環境で動く独自ランタイムだが、
// 構文は ES5.1 互換のサブセット。`function handler(event)` をトップレベルに
// 1 つだけ定義する形式のため、Node.js の vm でロードして関数として呼び出せる。

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FUNCTION_DIR = path.resolve(__dirname, '..');

/**
 * CloudFront Function のソースを読み込み、handler 関数を返す。
 * @param {string} fileName - scripts/cloudfront-function/ からの相対ファイル名
 * @returns {(event: object) => object} handler 関数
 */
function loadHandler(fileName) {
  const filePath = path.join(FUNCTION_DIR, fileName);
  const code = fs.readFileSync(filePath, 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(code, context);
  if (typeof context.handler !== 'function') {
    throw new Error(`handler is not defined in ${fileName}`);
  }
  return context.handler;
}

/**
 * CloudFront viewer-request イベントの最小モック。
 * 実際の構造は AWS ドキュメント参照だが、テストでは request だけあれば足りる。
 */
function buildViewerRequestEvent({ uri = '/', method = 'GET' } = {}) {
  return {
    version: '1.0',
    context: { distributionId: 'EDFDVBD6EXAMPLE' },
    viewer: { ip: '203.0.113.1' },
    request: {
      method,
      uri,
      querystring: {},
      headers: { host: { value: 'photlas.jp' } },
      cookies: {},
    },
  };
}

module.exports = { loadHandler, buildViewerRequestEvent, FUNCTION_DIR };
