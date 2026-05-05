// Issue#117: scripts/maintenance.html を JS 文字列リテラル向けにエスケープし、
// scripts/cloudfront-function/maintenance.js.template の `__MAINTENANCE_HTML__`
// を置換して scripts/cloudfront-function/maintenance.js を生成する。
//
// テンプレートのプレースホルダはシングルクォート文字列内にあるため、
// バックスラッシュ・シングルクォート・改行 (CR/LF) をエスケープする。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HTML_FILE = path.join(REPO_ROOT, 'scripts', 'maintenance.html');
const TEMPLATE_FILE = path.join(REPO_ROOT, 'scripts', 'cloudfront-function', 'maintenance.js.template');
const OUTPUT_FILE = path.join(REPO_ROOT, 'scripts', 'cloudfront-function', 'maintenance.js');

const html = fs.readFileSync(HTML_FILE, 'utf8');
const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');

const escapedHtml = html
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\r/g, '\\r')
  .replace(/\n/g, '\\n');

const result = template.replace(/__MAINTENANCE_HTML__/g, escapedHtml);
fs.writeFileSync(OUTPUT_FILE, result);

console.log(`Generated: ${OUTPUT_FILE} (${Buffer.byteLength(result, 'utf8')} bytes)`);
