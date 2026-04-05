/**
 * フィルター条件の変換ユーティリティ
 * Issue#16: フィルター機能 - UI表示値からAPI値への変換
 * Issue#87: 数値コード対応
 *
 * FilterPanelで選択された日本語の値をバックエンドAPIが期待する数値コードに変換する
 */

import {
  TIME_OF_DAY_MORNING, TIME_OF_DAY_DAY, TIME_OF_DAY_EVENING, TIME_OF_DAY_NIGHT,
  WEATHER_SUNNY, WEATHER_CLOUDY, WEATHER_RAIN, WEATHER_SNOW,
  DEVICE_TYPE_SLR, DEVICE_TYPE_MIRRORLESS, DEVICE_TYPE_COMPACT,
  DEVICE_TYPE_SMARTPHONE, DEVICE_TYPE_FILM, DEVICE_TYPE_OTHER,
} from './codeConstants'

/**
 * 月の変換: "1月" → 1, "2月" → 2, ..., "12月" → 12
 */
export function transformMonths(months: string[]): number[] {
  return months.map(month => {
    const match = /^(\d+)月$/.exec(month);
    if (!match) {
      return 0;
    }
    return Number.parseInt(match[1], 10);
  }).filter(m => m > 0 && m <= 12);
}

/**
 * 時間帯の変換（数値コード）
 * "朝" → 301, "昼" → 302, "夕方" → 303, "夜" → 304
 */
export function transformTimesOfDay(timesOfDay: string[]): number[] {
  const mapping: Record<string, number> = {
    '朝': TIME_OF_DAY_MORNING,
    '昼': TIME_OF_DAY_DAY,
    '夕方': TIME_OF_DAY_EVENING,
    '夜': TIME_OF_DAY_NIGHT,
  };

  return timesOfDay
    .map(time => mapping[time])
    .filter(time => time !== undefined);
}

/**
 * 天候の変換（数値コード）
 * "晴れ" → 401, "曇り" → 402, "雨" → 403, "雪" → 404
 */
export function transformWeathers(weathers: string[]): number[] {
  const mapping: Record<string, number> = {
    '晴れ': WEATHER_SUNNY,
    '曇り': WEATHER_CLOUDY,
    '雨': WEATHER_RAIN,
    '雪': WEATHER_SNOW,
  };

  return weathers
    .map(weather => mapping[weather])
    .filter(weather => weather !== undefined);
}

/**
 * 機材種別の変換（数値コード）
 */
export function transformDeviceTypes(deviceTypes: string[]): number[] {
  const mapping: Record<string, number> = {
    '一眼レフ': DEVICE_TYPE_SLR,
    'ミラーレス': DEVICE_TYPE_MIRRORLESS,
    'コンパクト': DEVICE_TYPE_COMPACT,
    'スマートフォン': DEVICE_TYPE_SMARTPHONE,
    'フィルム': DEVICE_TYPE_FILM,
    'その他': DEVICE_TYPE_OTHER,
  };

  return deviceTypes
    .map(dt => mapping[dt])
    .filter(dt => dt !== undefined);
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
  // Issue#63: 14ジャンルに拡充（ポートレート削除、建造物・夜景・野鳥追加、風景→自然風景、食べ物→グルメ）
  const mapping: Record<string, string> = {
    '自然風景': '自然風景',
    '街並み': '街並み',
    '建造物': '建造物',
    '夜景': '夜景',
    'グルメ': 'グルメ',
    '植物': '植物',
    '動物': '動物',
    '野鳥': '野鳥',
    '自動車': '自動車',
    'バイク': 'バイク',
    '鉄道': '鉄道',
    '飛行機': '飛行機',
    '星空': '星空',
    'その他': 'その他',
  };

  return categories
    .map(category => mapping[category])
    .filter(category => category !== undefined);
}

/**
 * カテゴリー名からカテゴリーIDへの変換
 *
 * @param categoryNames UI表示のカテゴリー名（日本語）
 * @param categoryMap カテゴリー名とIDのマッピング（fetchCategories()で取得）
 * @returns カテゴリーIDの配列
 */
export function categoryNamesToIds(
  categoryNames: string[],
  categoryMap: Map<string, number>
): number[] {
  return categoryNames
    .map(name => categoryMap.get(name))
    .filter((id): id is number => id !== undefined);
}
