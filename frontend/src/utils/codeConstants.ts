/**
 * Issue#87: 桁区切り数値コード定数
 *
 * バックエンドのCodeConstants.javaと同一の値を定義。
 * APIレスポンスの数値コードを表示文字列に変換するマッピングも提供する。
 *
 * 100番台: User.role
 * 200番台: Category.id
 * 300番台: Photo.time_of_day
 * 400番台: Photo.weather
 * 500番台: Photo.device_type
 * 600番台: UserSnsLink.platform
 * 700番台: AccountSanction.sanction_type
 * 800番台: Violation.violation_type / Report.reason
 * 900番台: ModerationDetail.source
 * 1000番台: Photo.moderation_status
 * 1100番台: Report.target_type
 * 1200番台: LocationSuggestion.status
 * 1300番台: Violation.action_taken
 */

// ========== 100番台: User.role ==========
export const ROLE_USER = 101
export const ROLE_ADMIN = 102
export const ROLE_SUSPENDED = 103

// ========== 200番台: Category.id ==========
export const CATEGORY_NATURE = 201
export const CATEGORY_CITYSCAPE = 202
export const CATEGORY_ARCHITECTURE = 203
export const CATEGORY_NIGHT_VIEW = 204
export const CATEGORY_GOURMET = 205
export const CATEGORY_PLANTS = 206
export const CATEGORY_ANIMALS = 207
export const CATEGORY_WILD_BIRDS = 208
export const CATEGORY_CARS = 209
export const CATEGORY_MOTORCYCLES = 210
export const CATEGORY_RAILWAYS = 211
export const CATEGORY_AIRCRAFT = 212
export const CATEGORY_STARRY_SKY = 213
export const CATEGORY_OTHER = 214

// ========== 300番台: Photo.time_of_day ==========
export const TIME_OF_DAY_MORNING = 301
export const TIME_OF_DAY_DAY = 302
export const TIME_OF_DAY_EVENING = 303
export const TIME_OF_DAY_NIGHT = 304

// ========== 400番台: Photo.weather ==========
export const WEATHER_SUNNY = 401
export const WEATHER_CLOUDY = 402
export const WEATHER_RAIN = 403
export const WEATHER_SNOW = 404

// ========== 500番台: Photo.device_type ==========
export const DEVICE_TYPE_SLR = 501
export const DEVICE_TYPE_MIRRORLESS = 502
export const DEVICE_TYPE_COMPACT = 503
export const DEVICE_TYPE_SMARTPHONE = 504
export const DEVICE_TYPE_FILM = 505
export const DEVICE_TYPE_OTHER = 506

// ========== 600番台: UserSnsLink.platform ==========
export const PLATFORM_TWITTER = 601
export const PLATFORM_INSTAGRAM = 602
export const PLATFORM_YOUTUBE = 603
export const PLATFORM_TIKTOK = 604

// ========== 800番台: Report.reason ==========
export const REASON_ADULT_CONTENT = 801
export const REASON_VIOLENCE = 802
export const REASON_COPYRIGHT_INFRINGEMENT = 803
export const REASON_PRIVACY_VIOLATION = 804
export const REASON_SPAM = 805
export const REASON_OTHER = 806

// ========== 1000番台: Photo.moderation_status ==========
export const MODERATION_STATUS_PENDING_REVIEW = 1001
export const MODERATION_STATUS_PUBLISHED = 1002
export const MODERATION_STATUS_QUARANTINED = 1003
export const MODERATION_STATUS_REMOVED = 1004

// ========== 1100番台: Report.target_type ==========
export const TARGET_TYPE_PHOTO = 1101
export const TARGET_TYPE_PROFILE = 1102

// ========== 表示文字列マッピング ==========

/** 天気コード → 日本語表示 */
export const WEATHER_LABELS: Record<number, string> = {
  [WEATHER_SUNNY]: '晴れ',
  [WEATHER_CLOUDY]: '曇り',
  [WEATHER_RAIN]: '雨',
  [WEATHER_SNOW]: '雪',
}

/** 天気の選択肢（select用） */
export const WEATHER_OPTIONS = [
  { value: WEATHER_SUNNY, label: '晴れ' },
  { value: WEATHER_CLOUDY, label: '曇り' },
  { value: WEATHER_RAIN, label: '雨' },
  { value: WEATHER_SNOW, label: '雪' },
] as const

/** 時間帯コード → 日本語表示 */
export const TIME_OF_DAY_LABELS: Record<number, string> = {
  [TIME_OF_DAY_MORNING]: '朝',
  [TIME_OF_DAY_DAY]: '昼',
  [TIME_OF_DAY_EVENING]: '夕方',
  [TIME_OF_DAY_NIGHT]: '夜',
}

/** 機材種別コード → 日本語表示 */
export const DEVICE_TYPE_LABELS: Record<number, string> = {
  [DEVICE_TYPE_SLR]: '一眼レフ',
  [DEVICE_TYPE_MIRRORLESS]: 'ミラーレス',
  [DEVICE_TYPE_COMPACT]: 'コンパクト',
  [DEVICE_TYPE_SMARTPHONE]: 'スマートフォン',
  [DEVICE_TYPE_FILM]: 'フィルム',
  [DEVICE_TYPE_OTHER]: 'その他',
}

/** 機材種別の選択肢（select用） */
export const DEVICE_TYPE_OPTIONS = [
  { value: DEVICE_TYPE_SLR, label: '一眼レフ' },
  { value: DEVICE_TYPE_MIRRORLESS, label: 'ミラーレス' },
  { value: DEVICE_TYPE_COMPACT, label: 'コンパクト' },
  { value: DEVICE_TYPE_SMARTPHONE, label: 'スマートフォン' },
  { value: DEVICE_TYPE_FILM, label: 'フィルム' },
  { value: DEVICE_TYPE_OTHER, label: 'その他' },
] as const

/** カテゴリID → 日本語表示 */
export const CATEGORY_LABELS: Record<number, string> = {
  [CATEGORY_NATURE]: '自然風景',
  [CATEGORY_CITYSCAPE]: '街並み',
  [CATEGORY_ARCHITECTURE]: '建造物',
  [CATEGORY_NIGHT_VIEW]: '夜景',
  [CATEGORY_GOURMET]: 'グルメ',
  [CATEGORY_PLANTS]: '植物',
  [CATEGORY_ANIMALS]: '動物',
  [CATEGORY_WILD_BIRDS]: '野鳥',
  [CATEGORY_CARS]: '自動車',
  [CATEGORY_MOTORCYCLES]: 'バイク',
  [CATEGORY_RAILWAYS]: '鉄道',
  [CATEGORY_AIRCRAFT]: '飛行機',
  [CATEGORY_STARRY_SKY]: '星空',
  [CATEGORY_OTHER]: 'その他',
}

/** SNSプラットフォームコード → 表示名 */
export const PLATFORM_LABELS: Record<number, string> = {
  [PLATFORM_TWITTER]: 'X (Twitter)',
  [PLATFORM_INSTAGRAM]: 'Instagram',
  [PLATFORM_YOUTUBE]: 'YouTube',
  [PLATFORM_TIKTOK]: 'TikTok',
}

/** SNSプラットフォームの選択肢 */
export const PLATFORM_OPTIONS = [
  { value: PLATFORM_TWITTER, label: 'X (Twitter)' },
  { value: PLATFORM_INSTAGRAM, label: 'Instagram' },
  { value: PLATFORM_YOUTUBE, label: 'YouTube' },
  { value: PLATFORM_TIKTOK, label: 'TikTok' },
] as const

/** 通報理由コード → 日本語表示 */
export const REPORT_REASON_LABELS: Record<number, string> = {
  [REASON_ADULT_CONTENT]: '成人向けコンテンツ',
  [REASON_VIOLENCE]: '暴力的なコンテンツ',
  [REASON_COPYRIGHT_INFRINGEMENT]: '著作権侵害',
  [REASON_PRIVACY_VIOLATION]: 'プライバシー侵害',
  [REASON_SPAM]: 'スパム',
  [REASON_OTHER]: 'その他',
}

/** 通報理由の選択肢 */
export const REPORT_REASON_OPTIONS = [
  { value: REASON_ADULT_CONTENT, label: '成人向けコンテンツ' },
  { value: REASON_VIOLENCE, label: '暴力的なコンテンツ' },
  { value: REASON_COPYRIGHT_INFRINGEMENT, label: '著作権侵害' },
  { value: REASON_PRIVACY_VIOLATION, label: 'プライバシー侵害' },
  { value: REASON_SPAM, label: 'スパム' },
  { value: REASON_OTHER, label: 'その他' },
] as const

/** モデレーションステータスコード → 日本語表示 */
export const MODERATION_STATUS_LABELS: Record<number, string> = {
  [MODERATION_STATUS_PENDING_REVIEW]: '審査中',
  [MODERATION_STATUS_PUBLISHED]: '公開',
  [MODERATION_STATUS_QUARANTINED]: '隔離',
  [MODERATION_STATUS_REMOVED]: '削除済み',
}
