/**
 * 共通定数ファイル
 * Issue#27: パネル・ダイアログ群の移行 - Refactor段階
 *
 * アプリケーション全体で使用される定数を集約
 */

/**
 * 写真カテゴリ一覧
 * FilterPanel, PhotoContributionDialog で使用
 */
export const PHOTO_CATEGORIES = [
  '風景',
  '街並み',
  '植物',
  '動物',
  '自動車',
  'バイク',
  '鉄道',
  '飛行機',
  '食べ物',
  'ポートレート',
  '星空',
  'その他',
] as const

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]

/**
 * 写真アップロード関連の定数
 */
export const PHOTO_UPLOAD = {
  /** 最大ファイルサイズ（バイト） - 50MB */
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  /** 最大ファイルサイズ（表示用） */
  MAX_FILE_SIZE_DISPLAY: '50MB',
  /** 許可されるファイルタイプ */
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/heic'] as const,
  /** ファイルタイプ表示用テキスト */
  ALLOWED_FILE_TYPES_DISPLAY: 'JPEG、PNG、HEIC',
  /** タイトルの最大文字数 */
  TITLE_MAX_LENGTH: 20,
} as const

/**
 * ライトボックス（写真拡大表示）関連の定数
 */
export const LIGHTBOX = {
  /** 最小ズーム倍率 */
  MIN_SCALE: 0.5,
  /** 最大ズーム倍率 */
  MAX_SCALE: 3,
  /** ズーム変化量 */
  ZOOM_DELTA: 0.1,
  /** 初期ズーム倍率 */
  INITIAL_SCALE: 1,
} as const

/**
 * アップロードステータス関連の定数
 */
export const UPLOAD_STATUS = {
  /** 成功後のダイアログ閉じる遅延（ミリ秒） */
  SUCCESS_CLOSE_DELAY: 1500,
  /** エラー後のリセット遅延（ミリ秒） */
  ERROR_RESET_DELAY: 3000,
  /** プログレスバー更新間隔（ミリ秒） */
  PROGRESS_INTERVAL: 200,
  /** プログレスバー増分 */
  PROGRESS_INCREMENT: 10,
} as const
