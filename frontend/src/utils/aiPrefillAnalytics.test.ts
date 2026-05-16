/**
 * Issue#119 - aiPrefillAnalytics の単体テスト。
 *
 * trackAiPrefillEvent: gtag への送信検証
 * compareAiPrefill: AI 提案 vs ユーザー選択の比較ロジック検証
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  trackAiPrefillEvent,
  compareAiPrefill,
  trackParentFallbackEvents,
  trackExifRuleFiredEvents,
} from './aiPrefillAnalytics'

describe('trackAiPrefillEvent', () => {
  let mockGtag: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockGtag = vi.fn()
    vi.stubGlobal('gtag', mockGtag)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Issue#119 - ai_prefill_shown を送信できる', () => {
    trackAiPrefillEvent('ai_prefill_shown', { categories_count: 2, weather_filled: true })
    expect(mockGtag).toHaveBeenCalledWith('event', 'ai_prefill_shown', {
      categories_count: 2,
      weather_filled: true,
    })
  })

  it('Issue#119 - ai_prefill_accepted をパラメータなしで送信できる', () => {
    trackAiPrefillEvent('ai_prefill_accepted')
    expect(mockGtag).toHaveBeenCalledWith('event', 'ai_prefill_accepted', undefined)
  })

  it('Issue#119 - ai_prefill_modified を modification_type と user_diff_flag で送信できる', () => {
    trackAiPrefillEvent('ai_prefill_modified', {
      modification_type: 'both',
      user_diff_flag: true,
    })
    expect(mockGtag).toHaveBeenCalledWith('event', 'ai_prefill_modified', {
      modification_type: 'both',
      user_diff_flag: true,
    })
  })

  it('Issue#119 - ai_prefill_failed を error_type で送信できる', () => {
    trackAiPrefillEvent('ai_prefill_failed', { error_type: 'network' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'ai_prefill_failed', {
      error_type: 'network',
    })
  })

  it('Issue#119 - gtag が未定義でもエラーにならない', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('gtag', undefined)
    expect(() => trackAiPrefillEvent('ai_prefill_shown')).not.toThrow()
  })
})

describe('compareAiPrefill', () => {
  // ========== 完全一致 → accepted ==========

  it('Issue#119 - カテゴリも天候も完全一致なら isModified=false', () => {
    const result = compareAiPrefill({
      aiCategories: [201, 204],
      aiWeather: 401,
      userCategories: [201, 204],
      userWeather: 401,
    })
    expect(result.isModified).toBe(false)
    expect(result.modificationType).toBeNull()
    expect(result.userDiffFlag).toBe(false)
  })

  it('Issue#119 - 両方とも null/empty で一致なら isModified=false', () => {
    const result = compareAiPrefill({
      aiCategories: [],
      aiWeather: null,
      userCategories: [],
      userWeather: null,
    })
    expect(result.isModified).toBe(false)
  })

  // ========== カテゴリのみ修正 → modificationType='category' ==========

  it('Issue#119 - カテゴリのみ違う → modificationType=category', () => {
    const result = compareAiPrefill({
      aiCategories: [201],
      aiWeather: 401,
      userCategories: [202],
      userWeather: 401,
    })
    expect(result.isModified).toBe(true)
    expect(result.modificationType).toBe('category')
  })

  it('Issue#119 - カテゴリ追加 → modificationType=category', () => {
    const result = compareAiPrefill({
      aiCategories: [201],
      aiWeather: 401,
      userCategories: [201, 204], // ユーザーが追加
      userWeather: 401,
    })
    expect(result.isModified).toBe(true)
    expect(result.modificationType).toBe('category')
  })

  // ========== 天候のみ修正 → modificationType='weather' ==========

  it('Issue#119 - 天候のみ違う → modificationType=weather', () => {
    const result = compareAiPrefill({
      aiCategories: [201],
      aiWeather: 401,
      userCategories: [201],
      userWeather: 402,
    })
    expect(result.isModified).toBe(true)
    expect(result.modificationType).toBe('weather')
  })

  // ========== 両方修正 → modificationType='both' ==========

  it('Issue#119 - カテゴリも天候も違う → modificationType=both', () => {
    const result = compareAiPrefill({
      aiCategories: [201],
      aiWeather: 401,
      userCategories: [202],
      userWeather: 402,
    })
    expect(result.isModified).toBe(true)
    expect(result.modificationType).toBe('both')
  })

  // ========== user_diff_flag ==========

  it('Issue#119 - user_diff_flag: AI とユーザー選択カテゴリが完全に重複ゼロなら true', () => {
    const result = compareAiPrefill({
      aiCategories: [201, 204],
      aiWeather: null,
      userCategories: [205, 207],
      userWeather: null,
    })
    expect(result.userDiffFlag).toBe(true)
  })

  it('Issue#119 - user_diff_flag: 1つでも重複があれば false', () => {
    const result = compareAiPrefill({
      aiCategories: [201, 204],
      aiWeather: null,
      userCategories: [201, 207],
      userWeather: null,
    })
    expect(result.userDiffFlag).toBe(false)
  })

  it('Issue#119 - user_diff_flag: AI 予測カテゴリが空なら常に false（比較対象なし）', () => {
    const result = compareAiPrefill({
      aiCategories: [],
      aiWeather: null,
      userCategories: [205],
      userWeather: null,
    })
    expect(result.userDiffFlag).toBe(false)
  })
})

describe('Issue#132 - trackParentFallbackEvents', () => {
  let mockGtag: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockGtag = vi.fn()
    vi.stubGlobal('gtag', mockGtag)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Issue#132 - 各 ParentFallback につき ai_parent_fallback_used を 1 回ずつ送信', () => {
    trackParentFallbackEvents([
      { childLabel: 'Husky', parentLabel: 'Dog', categoryCode: 207 },
      { childLabel: 'MysteryBird', parentLabel: 'Sparrow', categoryCode: 208 },
    ])

    expect(mockGtag).toHaveBeenCalledTimes(2)
    expect(mockGtag).toHaveBeenNthCalledWith(1, 'event', 'ai_parent_fallback_used', {
      child_label: 'Husky',
      parent_label: 'Dog',
      category_code: 207,
    })
    expect(mockGtag).toHaveBeenNthCalledWith(2, 'event', 'ai_parent_fallback_used', {
      child_label: 'MysteryBird',
      parent_label: 'Sparrow',
      category_code: 208,
    })
  })

  it('Issue#132 - 空配列なら gtag を呼ばない', () => {
    trackParentFallbackEvents([])
    expect(mockGtag).not.toHaveBeenCalled()
  })

  it('Issue#132 - gtag が未定義でもクラッシュしない', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('gtag', undefined)
    expect(() =>
      trackParentFallbackEvents([{ childLabel: 'X', parentLabel: 'Y', categoryCode: 1 }])
    ).not.toThrow()
  })
})

describe('Issue#132 - trackExifRuleFiredEvents', () => {
  let mockGtag: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockGtag = vi.fn()
    vi.stubGlobal('gtag', mockGtag)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Issue#132 - 各 ExifRuleFire につき ai_exif_rule_fired を 1 回ずつ送信', () => {
    trackExifRuleFiredEvents([
      { rule: 'R1', categoryCode: 213, boostValue: 30, createdNewCandidate: true },
      { rule: 'R3', categoryCode: 207, boostValue: 10, createdNewCandidate: false },
    ])

    expect(mockGtag).toHaveBeenCalledTimes(2)
    expect(mockGtag).toHaveBeenNthCalledWith(1, 'event', 'ai_exif_rule_fired', {
      rule: 'R1',
      category_code: 213,
      boost_value: 30,
      created_new_candidate: true,
    })
    expect(mockGtag).toHaveBeenNthCalledWith(2, 'event', 'ai_exif_rule_fired', {
      rule: 'R3',
      category_code: 207,
      boost_value: 10,
      created_new_candidate: false,
    })
  })

  it('Issue#132 - 空配列なら gtag を呼ばない', () => {
    trackExifRuleFiredEvents([])
    expect(mockGtag).not.toHaveBeenCalled()
  })

  it('Issue#132 - gtag が未定義でもクラッシュしない', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('gtag', undefined)
    expect(() =>
      trackExifRuleFiredEvents([
        { rule: 'R1', categoryCode: 213, boostValue: 30, createdNewCandidate: true },
      ])
    ).not.toThrow()
  })
})
