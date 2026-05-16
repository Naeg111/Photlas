/**
 * Issue#119: AI プリフィルの GA4 イベント送信ユーティリティ。
 *
 * GA4 + Consent Mode（CookieConsentBanner.tsx 参照）が既に組み込まれている前提で、
 * AI プリフィルの表示・採用・修正・失敗を計測する。
 *
 * gtag 未定義時もクラッシュしないようガードしている（registrationWallAnalytics と同じパターン）。
 */

export type AiPrefillEvent =
  | 'ai_prefill_shown'
  | 'ai_prefill_accepted'
  | 'ai_prefill_modified'
  | 'ai_prefill_failed'
  // Issue#132: AI 解析の観測イベント
  | 'ai_parent_fallback_used'
  | 'ai_exif_rule_fired'

export type AiPrefillModificationType = 'category' | 'weather' | 'both'

/**
 * AI 結果と最終ユーザー選択の比較入力。
 */
export interface AiPrefillComparisonInput {
  /** AI が提案したカテゴリコード（200番台） */
  aiCategories: number[]
  /** AI が提案した天候コード（400番台、提案なしは null） */
  aiWeather: number | null
  /** 投稿時のユーザー選択カテゴリコード（200番台） */
  userCategories: number[]
  /** 投稿時のユーザー選択天候コード（400番台、未選択は null） */
  userWeather: number | null
}

export interface AiPrefillComparisonResult {
  /** ユーザーが AI 提案を修正したか */
  isModified: boolean
  /** 修正の種類（カテゴリのみ / 天候のみ / 両方）。{@code isModified=false} なら null */
  modificationType: AiPrefillModificationType | null
  /**
   * Issue#119 3.3: ユーザー選択カテゴリと AI 予測カテゴリの「重複ゼロ」フラグ。
   * バックエンドの user_diff_flag と同じロジック:
   * - AI 予測が空 → false（比較対象なし）
   * - AI とユーザーの集合に1つでも重複 → false
   * - 重複ゼロ → true
   */
  userDiffFlag: boolean
}

/**
 * AI プリフィルの GA4 イベントを送信する。
 *
 * @param eventName イベント名
 * @param params    イベントパラメータ（任意）
 */
export function trackAiPrefillEvent(
  eventName: AiPrefillEvent,
  params?: Record<string, unknown>
): void {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params)
  }
}

/**
 * AI 提案と最終ユーザー選択を比較し、accepted/modified の判定情報を返す。
 *
 * @param input AI 結果とユーザー選択
 * @returns     比較結果（修正の有無、修正種別、user_diff_flag）
 */
export function compareAiPrefill(input: AiPrefillComparisonInput): AiPrefillComparisonResult {
  const aiCatSet = new Set(input.aiCategories)
  const userCatSet = new Set(input.userCategories)

  const categoriesEqual =
    aiCatSet.size === userCatSet.size && [...aiCatSet].every((c) => userCatSet.has(c))
  const weatherEqual = (input.aiWeather ?? null) === (input.userWeather ?? null)

  if (categoriesEqual && weatherEqual) {
    return { isModified: false, modificationType: null, userDiffFlag: false }
  }

  let modificationType: AiPrefillModificationType
  if (!categoriesEqual && !weatherEqual) {
    modificationType = 'both'
  } else if (!categoriesEqual) {
    modificationType = 'category'
  } else {
    modificationType = 'weather'
  }

  let userDiffFlag = false
  if (input.aiCategories.length > 0) {
    const intersection = [...aiCatSet].filter((c) => userCatSet.has(c))
    userDiffFlag = intersection.length === 0
  }

  return { isModified: true, modificationType, userDiffFlag }
}

// ========== Issue#132: AI 解析の観測イベント ==========

/**
 * Issue#132: 親ラベル経由でカテゴリマッピングが成立した発火イベント。
 * バックエンドの ParentFallback DTO と1対1対応。
 */
export interface ParentFallback {
  /** 辞書未マッチだった子ラベル名（例: "Husky"） */
  childLabel: string
  /** 親フォールバックで採用された親ラベル名（例: "Dog"） */
  parentLabel: string
  /** マッピング先 Photlas カテゴリコード（例: 207） */
  categoryCode: number
}

/**
 * Issue#132: EXIF ベースのスコア補正ルール (R1〜R5) 発火イベント。
 * バックエンドの ExifRuleFire DTO と1対1対応。
 */
export interface ExifRuleFire {
  /** "R1" 〜 "R5" のいずれか */
  rule: string
  /** 加算対象カテゴリコード */
  categoryCode: number
  /** 加算値（例: R1=30, R3=10） */
  boostValue: number
  /** Rekognition 未検出カテゴリに新規候補として追加した場合 true */
  createdNewCandidate: boolean
}

/**
 * バックエンドが返した parentFallbacks 配列を走査し、各イベントを GA4 へ送信する。
 * 空配列の場合は何もしない。
 */
export function trackParentFallbackEvents(parentFallbacks: ParentFallback[]): void {
  for (const fb of parentFallbacks) {
    trackAiPrefillEvent('ai_parent_fallback_used', {
      child_label: fb.childLabel,
      parent_label: fb.parentLabel,
      category_code: fb.categoryCode,
    })
  }
}

/**
 * バックエンドが返した exifRulesFired 配列を走査し、各イベントを GA4 へ送信する。
 * 空配列の場合は何もしない。
 */
export function trackExifRuleFiredEvents(exifRulesFired: ExifRuleFire[]): void {
  for (const fire of exifRulesFired) {
    trackAiPrefillEvent('ai_exif_rule_fired', {
      rule: fire.rule,
      category_code: fire.categoryCode,
      boost_value: fire.boostValue,
      created_new_candidate: fire.createdNewCandidate,
    })
  }
}
