/**
 * フィルター条件の変換ユーティリティ
 * Issue#16: フィルター機能 - UI表示値からAPI値への変換
 *
 * FilterPanelで選択された日本語の値をバックエンドAPIが期待する形式に変換する
 */

/**
 * 月の変換: "1月" → 1, "2月" → 2, ..., "12月" → 12
 */
export function transformMonths(months: string[]): number[] {
  return months.map(month => {
    const match = month.match(/^(\d+)月$/);
    if (!match) {
      console.warn(`Invalid month format: ${month}`);
      return 0;
    }
    return parseInt(match[1], 10);
  }).filter(m => m > 0 && m <= 12);
}

/**
 * 時間帯の変換
 * "朝" → "MORNING", "昼" → "DAY", "夕方" → "EVENING", "夜" → "NIGHT"
 */
export function transformTimesOfDay(timesOfDay: string[]): string[] {
  const mapping: Record<string, string> = {
    '朝': 'MORNING',
    '昼': 'DAY',
    '夕方': 'EVENING',
    '夜': 'NIGHT'
  };

  return timesOfDay
    .map(time => mapping[time])
    .filter(time => time !== undefined);
}

/**
 * 天候の変換
 * "晴れ" → "Sunny", "曇り" → "Cloudy", "雨" → "Rain", "雪" → "Snow"
 */
export function transformWeathers(weathers: string[]): string[] {
  const mapping: Record<string, string> = {
    '晴れ': 'Sunny',
    '曇り': 'Cloudy',
    '雨': 'Rain',
    '雪': 'Snow'
  };

  return weathers
    .map(weather => mapping[weather])
    .filter(weather => weather !== undefined);
}

/**
 * カテゴリーの変換
 * UI表示名からDB上のカテゴリー名に変換
 *
 * 注意: 現在はカテゴリー名をそのまま返すが、将来的には:
 * 1. Categories API エンドポイントを作成して全カテゴリーを取得
 * 2. カテゴリー名からIDへの変換を行う
 *
 * Issue#16メモ: "街並み" は DBでは "都市・街並み" として格納されている可能性あり
 */
export function transformCategories(categories: string[]): string[] {
  const mapping: Record<string, string> = {
    '風景': '風景',
    '街並み': '街並み',  // TODO: DBとの整合性確認 (都市・街並み?)
    '植物': '植物',
    '動物': '動物',
    '自動車': '自動車',
    'バイク': 'バイク',
    '鉄道': '鉄道',
    '飛行機': '飛行機',
    '食べ物': '食べ物',
    'ポートレート': 'ポートレート',
    '星空': '星空',
    'その他': 'その他'
  };

  return categories
    .map(category => mapping[category])
    .filter(category => category !== undefined);
}

/**
 * カテゴリー名からカテゴリーIDへの変換
 *
 * TODO: 現在は仮実装。本来は /api/v1/categories エンドポイントから
 * カテゴリー一覧を取得してIDマッピングを行うべき
 *
 * 暫定的に、カテゴリーが作成順に1から12までのIDを持つと仮定
 */
export function categoryNamesToIds(_categoryNames: string[]): number[] {
  // TODO: 実装 - Categories API から取得したマッピングを使用
  // 現時点では空配列を返す（API統合時に実装）
  console.warn('categoryNamesToIds: Not yet implemented. Categories API endpoint required.');
  return [];
}
