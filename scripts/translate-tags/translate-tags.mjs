// Issue#135 Phase 4: tags の 4 言語翻訳 (ja / zh / ko / es) を Claude API で行うスクリプト
//
// 設計詳細は documents/04_Issues/Issue#135.md の 4.4 を参照。
//
// 主な責務:
//   - DB から display_name_zh/ko/es 等が NULL の tag 行を取得
//   - Claude API を呼んで 4 言語訳を取得
//   - UPDATE SQL を生成（実 DB 適用は呼び出し側の責任）
//
// 冪等性 (idempotency):
//   既に 4 言語すべて埋まっている行はスキップする。何度実行しても同じ状態。
//
// 実行方法:
//   ANTHROPIC_API_KEY=sk-... node scripts/translate-tags/translate-tags.mjs < tags.json > out.sql
//   （標準入力に対象 tag 行配列の JSON、標準出力に UPDATE SQL）
//
// テストとの分離:
//   - 純粋関数 (buildTranslationPrompt / parseClaudeResponse / translateRow / translateBatch)
//     は export してテストから差し替え可能
//   - 実 Claude API 呼び出しは defaultClaudeCaller のみが行う
//   - DB アクセスは行わない（出力 SQL を介して間接的に DB を更新する）

/**
 * 翻訳指示プロンプトを構築する。
 *
 * @param {string} label 英語の Rekognition ラベル（例: "Cherry Blossom"）
 * @returns {string} Claude に渡すプロンプト
 */
export function buildTranslationPrompt(label) {
  return [
    'You are a translator for a photo-sharing website.',
    `Translate the following English keyword into 4 languages: Japanese (ja), Chinese Simplified (zh), Korean (ko), and Spanish (es).`,
    'Each translation should be a single word or short phrase that is natural as a photography keyword (not a literal/dictionary translation).',
    '',
    `Keyword: "${label}"`,
    '',
    'Reply with a JSON object only, with exactly these 4 keys: ja, zh, ko, es.',
    'Example: {"ja": "桜", "zh": "樱花", "ko": "벚꽃", "es": "Flor de cerezo"}',
  ].join('\n');
}

/**
 * Claude のレスポンステキストから JSON を取り出して翻訳結果オブジェクトを返す。
 * テキストに前後のプロセが混じっていても最初に出現する {...} を抽出する。
 *
 * @param {string} text Claude のレスポンステキスト
 * @returns {{ja: string, zh: string, ko: string, es: string}}
 * @throws テキストから JSON を抽出できない・必須キー欠落時
 */
export function parseClaudeResponse(text) {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Claude response did not contain JSON: ' + String(text).slice(0, 100));
  }
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (e) {
    throw new Error('Failed to parse JSON from Claude response: ' + e.message);
  }
  for (const key of ['ja', 'zh', 'ko', 'es']) {
    if (typeof parsed[key] !== 'string' || parsed[key].trim() === '') {
      throw new Error(
        `Translation for '${key}' (Spanish/...) is missing or empty. Got: ${JSON.stringify(parsed)}`
      );
    }
  }
  return { ja: parsed.ja, zh: parsed.zh, ko: parsed.ko, es: parsed.es };
}

/**
 * 1 行（1 タグ）を翻訳する。
 *
 * @param {{id: number, rekognition_label: string}} row tag 行
 * @param {(prompt: string) => Promise<string>} callClaude Claude API 呼び出し関数（テストで差し替え可）
 * @returns {Promise<{ja: string, zh: string, ko: string, es: string}>}
 */
export async function translateRow(row, callClaude) {
  const prompt = buildTranslationPrompt(row.rekognition_label);
  const response = await callClaude(prompt);
  return parseClaudeResponse(response);
}

/**
 * 行配列に対して翻訳バッチを実行し、UPDATE SQL 文の配列を返す。
 *
 * 既に 4 言語すべて埋まっている行はスキップ（冪等性）。
 * 1 行で例外が起きても他の行は処理を続ける（バッチ処理の安全性）。
 *
 * @param {Array<{
 *   id: number, rekognition_label: string,
 *   display_name_ja?: string|null, display_name_zh?: string|null,
 *   display_name_ko?: string|null, display_name_es?: string|null
 * }>} rows
 * @param {(prompt: string) => Promise<string>} callClaude
 * @returns {Promise<string[]>} UPDATE SQL 文の配列
 */
export async function translateBatch(rows, callClaude) {
  const sqls = [];
  for (const row of rows) {
    if (hasAllFourTranslations(row)) {
      continue; // 冪等性: 既に全部埋まっている行はスキップ
    }
    let translated;
    try {
      translated = await translateRow(row, callClaude);
    } catch (e) {
      // Issue#135 4.4: 1 行失敗しても次に進む（バッチ全体は止めない）
      console.error(`[translate-tags] row id=${row.id} (${row.rekognition_label}) failed: ${e.message}`);
      continue;
    }
    sqls.push(buildUpdateSql(row.id, translated));
  }
  return sqls;
}

function hasAllFourTranslations(row) {
  return (
    nonEmpty(row.display_name_ja)
    && nonEmpty(row.display_name_zh)
    && nonEmpty(row.display_name_ko)
    && nonEmpty(row.display_name_es)
  );
}

function nonEmpty(s) {
  return typeof s === 'string' && s.length > 0;
}

/** 単一引用符を SQL の '' でエスケープ。 */
function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

function buildUpdateSql(id, t) {
  return (
    `UPDATE tags SET `
    + `display_name_ja = '${sqlEscape(t.ja)}', `
    + `display_name_zh = '${sqlEscape(t.zh)}', `
    + `display_name_ko = '${sqlEscape(t.ko)}', `
    + `display_name_es = '${sqlEscape(t.es)}', `
    + `updated_at = CURRENT_TIMESTAMP `
    + `WHERE id = ${id};`
  );
}

// ========== CLI エントリポイント（実 Claude API を呼ぶ） ==========

/**
 * 実 Claude API 呼び出し関数のデフォルト実装。
 * 環境変数 ANTHROPIC_API_KEY が必須。
 *
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function defaultClaudeCaller(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
  // Anthropic Messages API
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude API HTTP ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  // 戻り値構造: { content: [{ type: 'text', text: '...' }, ...] }
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock) {
    throw new Error('Claude response has no text content');
  }
  return textBlock.text;
}

/** CLI として動作するときのエントリーポイント。stdin に行配列 JSON、stdout に UPDATE SQL。 */
async function main() {
  const input = await readStdin();
  const rows = JSON.parse(input);
  if (!Array.isArray(rows)) {
    throw new Error('Input must be a JSON array of tag rows');
  }
  const sqls = await translateBatch(rows, defaultClaudeCaller);
  for (const sql of sqls) {
    console.log(sql);
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

// import.meta.url が CLI 実行時のエントリと一致するときだけ main() を呼ぶ
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
