// Issue#135 Phase 4: scripts/translate-tags のテスト
//
// scripts/translate-tags/translate-tags.mjs は新規キーワードを 4 言語
// (ja / zh / ko / es) に Claude API で翻訳するスクリプト。
//
// 実際の Claude API 呼び出しはモックで差し替え、純粋関数（プロンプト構築・
// レスポンス解析・冪等性）を検証する。

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const MODULE_PATH = path.resolve(__dirname, '..', 'translate-tags.mjs');

async function loadModule() {
  return import(MODULE_PATH);
}

// ========== buildTranslationPrompt ==========

test('buildTranslationPrompt: contains the English label', async () => {
  const { buildTranslationPrompt } = await loadModule();
  const prompt = buildTranslationPrompt('Cherry Blossom');
  assert.match(prompt, /Cherry Blossom/);
});

test('buildTranslationPrompt: mentions all four target languages', async () => {
  const { buildTranslationPrompt } = await loadModule();
  const prompt = buildTranslationPrompt('Mountain');
  // 4 言語の名前が含まれていること（順序や具体的な記述は問わない）
  for (const lang of ['Japanese', 'Chinese', 'Korean', 'Spanish']) {
    assert.match(prompt, new RegExp(lang, 'i'), `prompt should mention ${lang}`);
  }
});

test('buildTranslationPrompt: instructs Claude to return JSON', async () => {
  const { buildTranslationPrompt } = await loadModule();
  const prompt = buildTranslationPrompt('Sushi');
  assert.match(prompt, /JSON/i);
});

// ========== parseClaudeResponse ==========

test('parseClaudeResponse: parses well-formed JSON with all 4 langs', async () => {
  const { parseClaudeResponse } = await loadModule();
  const json = '{"ja": "桜", "zh": "樱花", "ko": "벚꽃", "es": "Flor de cerezo"}';
  const result = parseClaudeResponse(json);
  assert.deepEqual(result, {
    ja: '桜', zh: '樱花', ko: '벚꽃', es: 'Flor de cerezo',
  });
});

test('parseClaudeResponse: extracts JSON from text with surrounding prose', async () => {
  const { parseClaudeResponse } = await loadModule();
  // Claude が説明文を前後に付けても JSON を抽出できること
  const text = 'Here is the translation:\n{"ja": "山", "zh": "山", "ko": "산", "es": "Montaña"}\nDone.';
  const result = parseClaudeResponse(text);
  assert.equal(result.ja, '山');
  assert.equal(result.es, 'Montaña');
});

test('parseClaudeResponse: throws on missing required language', async () => {
  const { parseClaudeResponse } = await loadModule();
  const incomplete = '{"ja": "海", "zh": "海", "ko": "바다"}'; // es 欠落
  assert.throws(() => parseClaudeResponse(incomplete), /es|Spanish/i);
});

test('parseClaudeResponse: throws on completely invalid JSON', async () => {
  const { parseClaudeResponse } = await loadModule();
  assert.throws(() => parseClaudeResponse('not json at all'));
});

// ========== translateRow (1 行翻訳) ==========

test('translateRow: calls callClaude with the row label and returns parsed translations', async () => {
  const { translateRow } = await loadModule();
  let calledWith = null;
  const mockClaude = async (prompt) => {
    calledWith = prompt;
    return '{"ja": "犬", "zh": "狗", "ko": "개", "es": "Perro"}';
  };

  const result = await translateRow({ id: 1, rekognition_label: 'Dog' }, mockClaude);

  assert.match(calledWith, /Dog/);
  assert.deepEqual(result, { ja: '犬', zh: '狗', ko: '개', es: 'Perro' });
});

// ========== translateBatch (冪等性) ==========

test('translateBatch: skips rows that already have all 4 translations (idempotency)', async () => {
  const { translateBatch } = await loadModule();
  let callCount = 0;
  const mockClaude = async () => {
    callCount++;
    return '{"ja": "a", "zh": "b", "ko": "c", "es": "d"}';
  };

  const rows = [
    {
      id: 1, rekognition_label: 'Tag1',
      display_name_ja: 'X', display_name_zh: 'X', display_name_ko: 'X', display_name_es: 'X',
    },
    {
      id: 2, rekognition_label: 'Tag2',
      display_name_ja: 'X', display_name_zh: null, display_name_ko: 'X', display_name_es: 'X',
    },
  ];

  await translateBatch(rows, mockClaude);

  // Tag1 はすべて埋まっているので呼ばれず、Tag2 のみ呼ばれる
  assert.equal(callCount, 1);
});

test('translateBatch: produces UPDATE SQL for rows with missing translations', async () => {
  const { translateBatch } = await loadModule();
  const mockClaude = async () => '{"ja": "やまね", "zh": "山", "ko": "산", "es": "Montaña"}';

  const rows = [
    {
      id: 5, rekognition_label: 'Mountain',
      display_name_ja: null, display_name_zh: null, display_name_ko: null, display_name_es: null,
    },
  ];

  const result = await translateBatch(rows, mockClaude);

  assert.equal(result.length, 1);
  assert.match(result[0], /UPDATE tags/i);
  assert.match(result[0], /id\s*=\s*5/);
  // 各言語のカラムが含まれていること
  assert.match(result[0], /display_name_ja\s*=\s*'やまね'/);
  assert.match(result[0], /display_name_zh\s*=\s*'山'/);
  assert.match(result[0], /display_name_ko\s*=\s*'산'/);
  assert.match(result[0], /display_name_es\s*=\s*'Montaña'/);
});

test('translateBatch: SQL escapes single quotes in translations', async () => {
  const { translateBatch } = await loadModule();
  const mockClaude = async () => `{"ja": "オ'ライリー", "zh": "x", "ko": "y", "es": "z"}`;

  const rows = [
    {
      id: 9, rekognition_label: 'Foo',
      display_name_ja: null, display_name_zh: 'x', display_name_ko: 'y', display_name_es: 'z',
    },
  ];

  const result = await translateBatch(rows, mockClaude);

  // ' は '' でエスケープされる
  assert.match(result[0], /オ''ライリー/);
});

test('translateBatch: continues processing remaining rows when one row throws', async () => {
  const { translateBatch } = await loadModule();
  let n = 0;
  const mockClaude = async () => {
    n++;
    if (n === 1) throw new Error('claude api fail');
    return '{"ja": "良", "zh": "x", "ko": "y", "es": "z"}';
  };

  const rows = [
    { id: 1, rekognition_label: 'Bad',
      display_name_ja: null, display_name_zh: null, display_name_ko: null, display_name_es: null },
    { id: 2, rekognition_label: 'Good',
      display_name_ja: null, display_name_zh: null, display_name_ko: null, display_name_es: null },
  ];

  const result = await translateBatch(rows, mockClaude);

  // 2 行目だけ成功
  assert.equal(result.length, 1);
  assert.match(result[0], /id\s*=\s*2/);
});
