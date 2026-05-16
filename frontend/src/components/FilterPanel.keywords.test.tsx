/**
 * Issue#135 Phase 11: FilterPanel にキーワードセクションが組み込まれていることのテスト。
 *
 * - 開いた時に /api/v1/tags がフェッチされる
 * - KeywordSection が表示される（AI 提案エリアは非表示、文脈連動 + アコーディオン のみ）
 * - onApply の FilterConditions に tagIds が含まれる
 */

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilterPanel } from './FilterPanel'

const mockFetchTags = vi.fn()
vi.mock('../utils/tagsApi', () => ({
  fetchTags: (...args: unknown[]) => mockFetchTags(...args),
}))

describe('FilterPanel - Issue#135 キーワードフィルタ組込', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchTags.mockResolvedValue({
      tags: [
        { tagId: 1, slug: 'cherry-blossom', displayName: '桜', categoryCodes: [206], sortOrder: 10 },
      ],
    })
  })

  it('Issue#135 - パネル open=true で fetchTags が呼ばれる', async () => {
    render(<FilterPanel open onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(mockFetchTags).toHaveBeenCalled()
    })
  })

  it('Issue#135 - KeywordSection が表示される（カテゴリの下、AI 提案エリアは無し）', async () => {
    render(<FilterPanel open onOpenChange={vi.fn()} />)

    await waitFor(() => {
      // KeywordSection 自体は描画される
      expect(screen.getByTestId('keyword-section')).toBeInTheDocument()
    })
    // AI 提案エリアは表示されない（検索フィルタなので）
    expect(screen.queryByTestId('keyword-section-ai-suggestions')).not.toBeInTheDocument()
  })

  // ========== Issue#141 Phase 8: autoSelectByCategoryMode 統合 ==========

  it('Issue#141 - カテゴリ選択で配下キーワードが自動選択され、onApply の tagIds に含まれる', async () => {
    // 植物カテゴリ (206) 配下に「桜 (1)」「もみじ (4)」がある fixture
    mockFetchTags.mockResolvedValue({
      tags: [
        { tagId: 1, slug: 'cherry-blossom', displayName: '桜', categoryCodes: [206], sortOrder: 10 },
        { tagId: 4, slug: 'maple', displayName: 'もみじ', categoryCodes: [206], sortOrder: 100 },
      ],
    })
    const onApply = vi.fn()
    render(<FilterPanel open onOpenChange={vi.fn()} onApply={onApply} />)

    // tags 取得完了を待つ
    await waitFor(() => {
      expect(mockFetchTags).toHaveBeenCalled()
    })

    // 植物カテゴリのチップを探す（FilterPanel の categories セクション）
    const plantsButton = await screen.findByRole('button', { name: /植物/i })
    fireEvent.pointerDown(plantsButton)

    // auto-select で selectedTagIds に [1, 4] が入った状態になる
    // 「適用」ボタンをクリック
    const applyButton = await screen.findByRole('button', { name: /適用|apply/i })
    fireEvent.click(applyButton)

    // onApply で tagIds = [1, 4] が渡される
    expect(onApply).toHaveBeenCalled()
    const conditions = onApply.mock.calls[onApply.mock.calls.length - 1][0]
    expect(conditions.tagIds).toEqual(expect.arrayContaining([1, 4]))
  })

  it('Issue#141 - 個別チップ再クリックで auto-select 状態から外せる', async () => {
    mockFetchTags.mockResolvedValue({
      tags: [
        { tagId: 1, slug: 'cherry-blossom', displayName: '桜', categoryCodes: [206], sortOrder: 10 },
        { tagId: 4, slug: 'maple', displayName: 'もみじ', categoryCodes: [206], sortOrder: 100 },
      ],
    })
    const onApply = vi.fn()
    render(<FilterPanel open onOpenChange={vi.fn()} onApply={onApply} />)

    await waitFor(() => expect(mockFetchTags).toHaveBeenCalled())

    // 植物カテゴリを選択 → 桜・もみじが auto-select される
    const plantsButton = await screen.findByRole('button', { name: /植物/i })
    fireEvent.pointerDown(plantsButton)

    // 桜チップを再クリックで外す
    await waitFor(() => {
      const ctx = screen.getByTestId('keyword-section-contextual')
      expect(within(ctx).getByText('桜')).toBeInTheDocument()
    })
    const ctx = screen.getByTestId('keyword-section-contextual')
    fireEvent.click(within(ctx).getByText('桜'))

    // 適用
    const applyButton = await screen.findByRole('button', { name: /適用|apply/i })
    fireEvent.click(applyButton)

    const conditions = onApply.mock.calls[onApply.mock.calls.length - 1][0]
    // 桜は外れ、もみじだけ残る
    expect(conditions.tagIds).not.toContain(1)
    expect(conditions.tagIds).toContain(4)
  })
})
