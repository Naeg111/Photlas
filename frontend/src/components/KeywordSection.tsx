/**
 * Issue#135 Phase 9: キーワード選択 UI コンポーネント。
 *
 * 投稿フォーム (PhotoContributionDialog) と検索フィルタ (SearchPage) で共用する。
 *
 * 機能:
 *   1. AI 提案チップ (常時表示、空配列なら非表示)
 *   2. 文脈連動表示エリア (選択中カテゴリ配下の主要キーワード上位 N 件、チップ)
 *   3. 「もっと細かく」展開部 (検索 BOX + 13 カテゴリのアコーディオン)
 *      - アコーディオン排他制御（同時 1 つだけ開く）
 *      - 同一キーワードが複数カテゴリに属する場合は重複表示、チェック状態は連動
 *   4. maxSelections 上限制御
 *
 * 詳細仕様は Issue#135 3.4.2 / 3.5 / Q31〜Q34 参照。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CATEGORY_LABELS } from '../utils/codeConstants'
import { formatTagDisplayName } from '../utils/formatTagDisplayName'
import { groupTagsByDisplayName, type TagGroup } from '../utils/tagGrouping'

export interface KeywordTag {
  tagId: number
  slug: string
  displayName: string
  categoryCodes: number[]
  sortOrder: number
  /** Issue#141 後追い: 投稿数 (PUBLISHED + 退会済除外)。0 ならフィルタ画面で非活性表示。 */
  photoCount?: number
}

export interface KeywordSuggestion {
  tagId: number
  slug: string
  displayName: string
  confidence: number
}

export interface KeywordSectionProps {
  /** 全アクティブタグ（GET /api/v1/tags の結果） */
  allTags: KeywordTag[]
  /** 文脈連動表示の起点となるカテゴリコード配列 */
  selectedCategoryCodes: number[]
  /** 現在チェック中のタグ ID 配列 */
  selectedTagIds: number[]
  /** 選択変更時のコールバック（新しい tag_id 配列を受け取る） */
  onSelectionChange: (next: number[]) => void
  /** 最大選択数（投稿: 20、検索フィルタ: 10） */
  maxSelections: number
  /** 文脈連動エリアでカテゴリごとに表示する最大件数（デフォルト 10） */
  contextualTopN?: number
  /**
   * Issue#141 Phase 6: カテゴリ選択時に配下キーワードを自動選択するモード。
   * フィルタ画面で true、投稿フォームで false（デフォルト）。
   * true のときは:
   *   - selectedCategoryCodes の追加で配下 tag を selectedTagIds に自動追加 (Q1: maxSelections 無視)
   *   - selectedCategoryCodes の解除で配下 tag を selectedTagIds から自動除外 (Q3: 手動分も巻き込み)
   *   - 他のまだ選択中のカテゴリにも属する tag は残す (Q5: 多対多整合)
   *   - 手動 handleToggle の maxSelections チェックも無効化 (フィルタ画面は実質無制限, Q1)
   */
  autoSelectByCategoryMode?: boolean
}

const DEFAULT_CONTEXTUAL_TOP_N = 10

export function KeywordSection({
  allTags,
  selectedCategoryCodes,
  selectedTagIds,
  onSelectionChange,
  maxSelections,
  contextualTopN = DEFAULT_CONTEXTUAL_TOP_N,
  autoSelectByCategoryMode = false,
}: Readonly<KeywordSectionProps>) {
  const { t } = useTranslation()
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [openAccordionCode, setOpenAccordionCode] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const selectedSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds])

  // Issue#159: 上限は「グループ（表示名）単位」で数える。同義タグ（牧場=Farm/Ranch/Pasture）は 1 件扱い。
  const displayNameByTagId = useMemo(() => {
    const m = new Map<number, string>()
    for (const tag of allTags) m.set(tag.tagId, tag.displayName)
    return m
  }, [allTags])
  const selectedGroupCount = useMemo(() => {
    const names = new Set<string>()
    for (const id of selectedTagIds) names.add(displayNameByTagId.get(id) ?? `#${id}`)
    return names.size
  }, [selectedTagIds, displayNameByTagId])

  // Issue#141 Phase 6: カテゴリ変化 diff で配下 tag を自動追加/除外
  // useRef で前回 codes と最新 selectedTagIds を保持し、依存配列に
  // selectedTagIds / onSelectionChange を入れない (無限ループ防止)
  const previousCodesRef = useRef<number[]>([])
  const selectedTagIdsRef = useRef(selectedTagIds)
  selectedTagIdsRef.current = selectedTagIds

  useEffect(() => {
    if (!autoSelectByCategoryMode) return
    // Phase 7 (Q-new-2): allTags 未取得中はスキップして、取得後の re-effect で
    // 遡及して auto-select する。previousCodesRef もここで更新しないことで
    // 次回 effect (allTags 取得後) で全カテゴリが「added」として再評価される。
    if (allTags.length === 0) return

    const previousCodes = previousCodesRef.current
    const added = selectedCategoryCodes.filter((c) => !previousCodes.includes(c))
    const removed = previousCodes.filter((c) => !selectedCategoryCodes.includes(c))
    previousCodesRef.current = [...selectedCategoryCodes]

    if (added.length === 0 && removed.length === 0) return

    // added カテゴリ配下の tag を追加（maxSelections 無視, Q1）
    // Issue#141 後追い: photoCount=0 の tag は auto-select でも追加しない (非活性チップ扱い)
    const tagsToAdd = allTags
      .filter((t) => t.categoryCodes.some((c) => added.includes(c)))
      .filter((t) => t.photoCount !== 0)
      .map((t) => t.tagId)

    // removed カテゴリ「のみ」に属する tag を除外（Q5: 他カテゴリにまだ属するなら残す）
    const tagsToRemove = allTags
      .filter((t) => t.categoryCodes.some((c) => removed.includes(c)))
      .filter((t) => !t.categoryCodes.some((c) => selectedCategoryCodes.includes(c)))
      .map((t) => t.tagId)

    const current = selectedTagIdsRef.current
    const next = Array.from(new Set([
      ...current.filter((id) => !tagsToRemove.includes(id)),
      ...tagsToAdd,
    ]))

    // 差分が無いなら onChange を呼ばない（不要な再 render 回避、無限ループ防止）
    if (next.length === current.length && next.every((id, i) => id === current[i])) return
    onSelectionChange(next)
  }, [autoSelectByCategoryMode, selectedCategoryCodes, allTags, onSelectionChange])

  // 文脈連動表示の対象：選択カテゴリ毎に topN（sort_order 昇順 + alphabetical）
  const contextualByCategory = useMemo(() => {
    const map = new Map<number, KeywordTag[]>()
    for (const code of selectedCategoryCodes) {
      const list = allTags
        .filter((tag) => tag.categoryCodes.includes(code))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
        .slice(0, contextualTopN)
      if (list.length > 0) map.set(code, list)
    }
    return map
  }, [allTags, selectedCategoryCodes, contextualTopN])

  // 「もっと細かく」展開時のカテゴリ × タグ一覧（検索フィルタ適用後）
  const accordionByCategory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const map = new Map<number, KeywordTag[]>()
    // 13 カテゴリ全部の枠を確保（タグが無くてもアコーディオンは出す）
    const codes = Object.keys(CATEGORY_LABELS).map(Number).sort((a, b) => a - b)
    for (const code of codes) {
      let list = allTags
        .filter((tag) => tag.categoryCodes.includes(code))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
      if (q.length > 0) {
        list = list.filter(
          (tag) =>
            tag.displayName.toLowerCase().includes(q)
            || tag.slug.toLowerCase().includes(q)
        )
      }
      // Issue#141 後追い: 配下タグが 0 件のカテゴリ (例: 「その他」214) はアコーディオン枠ごと非表示
      if (list.length === 0) continue
      map.set(code, list)
    }
    return map
  }, [allTags, searchQuery])

  // Issue#141 後追い: 0 件タグの集合 (フィルタ画面のみ非活性扱い)。
  // photoCount 未定義 (投稿フォーム用) は非活性化しない。
  const disabledTagIdSet = useMemo(() => {
    if (!autoSelectByCategoryMode) return new Set<number>()
    const s = new Set<number>()
    for (const t of allTags) {
      if (t.photoCount === 0) s.add(t.tagId)
    }
    return s
  }, [allTags, autoSelectByCategoryMode])

  // Issue#159: 表示名グループ単位の選択判定。いずれかのメンバーが選択済みならグループは選択中。
  function isGroupSelected(group: TagGroup): boolean {
    return group.tagIds.some((id) => selectedSet.has(id))
  }
  // グループの全メンバーが非活性（投稿 0 件）のときだけグループを非活性にする。
  function isGroupDisabled(group: TagGroup): boolean {
    return group.tagIds.every((id) => disabledTagIdSet.has(id))
  }

  // Issue#159: 表示名グループのトグル。
  //   - 解除: グループの全メンバー tagId を外す
  //   - フィルタ (autoSelectByCategoryMode): グループ全 tagId を追加（OR 絞り込み）
  //   - 投稿/編集: グループ単位の上限チェック → 正準タグ 1 件のみ追加
  function handleToggleGroup(group: TagGroup) {
    if (isGroupDisabled(group)) return
    const memberSet = new Set(group.tagIds)
    if (isGroupSelected(group)) {
      onSelectionChange(selectedTagIds.filter((id) => !memberSet.has(id)))
    } else if (autoSelectByCategoryMode) {
      onSelectionChange([...selectedTagIds, ...group.tagIds])
    } else {
      if (selectedGroupCount >= maxSelections) return
      onSelectionChange([...selectedTagIds, group.canonicalTagId])
    }
  }

  function handleAccordionToggle(code: number) {
    setOpenAccordionCode((cur) => (cur === code ? null : code))
  }

  function chipClass(selected: boolean, disabled = false): string {
    const base = 'inline-flex items-center px-3 py-1 rounded-full border text-sm select-none mr-2 mb-2'
    if (disabled) {
      // Issue#141 後追い: 投稿 0 件タグは非活性表示（クリック不可、グレーアウト、選択中でも黒くしない）
      return `${base} bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed`
    }
    return selected
      ? `${base} bg-gray-900 text-white border-gray-900 cursor-pointer`
      : `${base} bg-white text-gray-800 border-gray-300 hover:border-gray-500 cursor-pointer`
  }

  return (
    <div data-testid="keyword-section" className="flex flex-col gap-4">
      {/* 文脈連動表示エリア（選択カテゴリ未指定なら非表示） */}
      {contextualByCategory.size > 0 && (
        <section data-testid="keyword-section-contextual">
          <h3 className="text-sm font-semibold mb-2">
            {t('keyword.contextual', { defaultValue: '選択中の小カテゴリー' })}
          </h3>
          {[...contextualByCategory.entries()].map(([code, tags]) => (
            <div key={code} className="mb-2">
              <div className="text-xs text-gray-500 mb-1">{CATEGORY_LABELS[code]}</div>
              <div className="flex flex-wrap">
                {groupTagsByDisplayName(tags).map((group) => {
                  const isDisabled = isGroupDisabled(group)
                  return (
                    <button
                      key={`${code}-${group.slug}`}
                      type="button"
                      className={chipClass(isGroupSelected(group), isDisabled)}
                      onClick={() => handleToggleGroup(group)}
                      disabled={isDisabled}
                    >
                      {formatTagDisplayName(group.displayName)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 「もっと細かく」展開ボタン */}
      <button
        type="button"
        data-testid="keyword-section-more-toggle"
        className="text-left text-sm text-gray-700 underline self-start"
        onClick={() => setIsMoreOpen((v) => !v)}
      >
        {isMoreOpen
          ? t('keyword.moreClose', { defaultValue: '— 小カテゴリー一覧を閉じる' })
          : t('keyword.moreOpen', { defaultValue: '+ さらに細かく（小カテゴリー一覧）' })}
      </button>

      {/* 「もっと細かく」展開部 */}
      {isMoreOpen && (
        <div data-testid="keyword-section-more-panel" className="flex flex-col gap-2 border-t pt-3">
          <input
            type="search"
            data-testid="keyword-section-search-input"
            placeholder={t('keyword.searchPlaceholder', { defaultValue: '小カテゴリーを検索' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
          {/* 検索中はアコーディオンを畳まずマッチ全体を表示する（UX 改善） */}
          {searchQuery.trim().length > 0 ? (
            <SearchResultList
              accordionByCategory={accordionByCategory}
              chipClass={chipClass}
              onToggleGroup={handleToggleGroup}
              isGroupSelected={isGroupSelected}
              isGroupDisabled={isGroupDisabled}
            />
          ) : null}
          {[...accordionByCategory.entries()].map(([code, tags]) => {
            const isOpen = openAccordionCode === code
            const groups = groupTagsByDisplayName(tags)
            return (
              <div
                key={code}
                data-testid={`keyword-accordion-${code}`}
                className="border border-gray-200 rounded"
              >
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 flex items-center justify-between"
                  onClick={() => handleAccordionToggle(code)}
                >
                  <span className="text-sm font-medium">
                    {CATEGORY_LABELS[code]}
                    <span className="text-xs text-gray-500 ml-2">({groups.length})</span>
                  </span>
                  <span className="text-xs">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 flex flex-wrap">
                    {groups.map((group) => {
                      const isDisabled = isGroupDisabled(group)
                      return (
                        <button
                          key={`${code}-acc-${group.slug}`}
                          type="button"
                          className={chipClass(isGroupSelected(group), isDisabled)}
                          onClick={() => handleToggleGroup(group)}
                          disabled={isDisabled}
                        >
                          {formatTagDisplayName(group.displayName)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 選択数表示 */}
      <div className="text-xs text-gray-500">
        {t('keyword.selectionCount', {
          defaultValue: '{{count}} / {{max}} 件選択中',
          count: selectedGroupCount,
          max: maxSelections,
        })}
      </div>
    </div>
  )
}

/** 検索クエリ入力時の matched 全件フラット表示（カテゴリ枠を超えて重複表示）。 */
function SearchResultList({
  accordionByCategory,
  chipClass,
  onToggleGroup,
  isGroupSelected,
  isGroupDisabled,
}: Readonly<{
  accordionByCategory: Map<number, KeywordTag[]>
  chipClass: (selected: boolean, disabled?: boolean) => string
  onToggleGroup: (group: TagGroup) => void
  isGroupSelected: (group: TagGroup) => boolean
  isGroupDisabled: (group: TagGroup) => boolean
}>) {
  // Issue#159: 同一表示名の同義タグは 1 チップに畳む。複数カテゴリの重複表示は従来どおり維持。
  const items: { code: number; group: TagGroup }[] = []
  for (const [code, tags] of accordionByCategory.entries()) {
    for (const group of groupTagsByDisplayName(tags)) items.push({ code, group })
  }
  if (items.length === 0) return null
  return (
    <div data-testid="keyword-section-search-results" className="flex flex-wrap">
      {items.map(({ code, group }) => {
        const isDisabled = isGroupDisabled(group)
        return (
          <button
            key={`search-${code}-${group.slug}`}
            type="button"
            className={chipClass(isGroupSelected(group), isDisabled)}
            onClick={() => onToggleGroup(group)}
            disabled={isDisabled}
          >
            {formatTagDisplayName(group.displayName)}
          </button>
        )
      })}
    </div>
  )
}
