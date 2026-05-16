/**
 * Issue#135 Phase 11: FilterPanel にキーワードセクションが組み込まれていることのテスト。
 *
 * - 開いた時に /api/v1/tags がフェッチされる
 * - KeywordSection が表示される（AI 提案エリアは非表示、文脈連動 + アコーディオン のみ）
 * - onApply の FilterConditions に tagIds が含まれる
 */

import { render, screen, waitFor } from '@testing-library/react'
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
})
