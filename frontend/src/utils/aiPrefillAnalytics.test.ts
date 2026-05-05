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
