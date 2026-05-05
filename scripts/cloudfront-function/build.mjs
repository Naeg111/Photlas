// Issue#117: scripts/maintenance.html を JS 文字列リテラル向けにエスケープし、
// scripts/cloudfront-function/maintenance.js.template の `__MAINTENANCE_HTML__`
// を置換して scripts/cloudfront-function/maintenance.js を生成する。
//
// テンプレートのプレースホルダはシングルクォート文字列内にあるため、
// バックスラッシュ・シングルクォート・改行 (CR/LF) をエスケープする。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CloudFront Function コードサイズ上限 (AWS 仕様)
const CLOUDFRONT_FUNCTION_SIZE_LIMIT_BYTES = 10240;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HTML_FILE = path.join(REPO_ROOT, 'scripts', 'maintenance.html');
const TEMPLATE_FILE = path.join(REPO_ROOT, 'scripts', 'cloudfront-function', 'maintenance.js.template');
const OUTPUT_FILE = path.join(REPO_ROOT, 'scripts', 'cloudfront-function', 'maintenance.js');

function escapeForSingleQuotedJsString(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function readRequired(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: ${label} not found at ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, 'utf8');
}

const html = readRequired(HTML_FILE, 'maintenance.html');
const template = readRequired(TEMPLATE_FILE, 'maintenance.js.template');
const result = template.replace(/__MAINTENANCE_HTML__/g, escapeForSingleQuotedJsString(html));

fs.writeFileSync(OUTPUT_FILE, result);

const sizeBytes = Buffer.byteLength(result, 'utf8');
console.log(`Generated: ${OUTPUT_FILE} (${sizeBytes} bytes / limit ${CLOUDFRONT_FUNCTION_SIZE_LIMIT_BYTES})`);
if (sizeBytes >= CLOUDFRONT_FUNCTION_SIZE_LIMIT_BYTES) {
  console.error(`Error: maintenance.js exceeds CloudFront Function 10KB limit (${sizeBytes} bytes)`);
  process.exit(1);
}
