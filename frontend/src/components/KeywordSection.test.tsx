/**
 * Issue#135 Phase 9: KeywordSection コンポーネントのテスト。
 *
 * 主要機能:
 *  - AI 提案チップの常時表示（空なら非表示）
 *  - 選択中カテゴリ配下の主要キーワード（文脈連動表示、上位 N）
 *  - 「もっと細かく」展開でアコーディオン + 検索 BOX
 *  - キーワード選択の上限（投稿用は 20、検索フィルタは 10）
 *  - チップ・チェックボックスのクリックで選択トグル
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { KeywordSection, type KeywordSectionProps } from './KeywordSection'

const TAGS_FIXTURE = [
  { tagId: 1, slug: 'mountain', displayName: '山', categoryCodes: [201], sortOrder: 100 },
  { tagId: 2, slug: 'sea', displayName: '海', categoryCodes: [201], sortOrder: 100 },
  { tagId: 3, slug: 'cherry-blossom', displayName: '桜', categoryCodes: [206], sortOrder: 10 },
  { tagId: 4, slug: 'maple', displayName: 'もみじ', categoryCodes: [206], sortOrder: 100 },
  { tagId: 5, slug: 'dog', displayName: '犬', categoryCodes: [207], sortOrder: 100 },
  { tagId: 6, slug: 'bird', displayName: '鳥', categoryCodes: [207, 208], sortOrder: 100 },
  { tagId: 7, slug: 'sushi', displayName: '寿司', categoryCodes: [205], sortOrder: 100 },
]

function defaultProps(overrides: Partial<KeywordSectionProps> = {}): KeywordSectionProps {
  return {
    allTags: TAGS_FIXTURE,
    aiSuggestions: [],
    selectedCategoryCodes: [],
    selectedTagIds: [],
    onSelectionChange: vi.fn(),
    maxSelections: 20,
    contextualTopN: 10,
    ...overrides,
  }
}

describe('KeywordSection - Issue#135 Phase 9', () => {
  // ========== AI 提案 ==========

  it('AI 提案チップが渡されていれば常時表示される', () => {
    render(
      <KeywordSection
        {...defaultProps({
          aiSuggestions: [
            { tagId: 3, slug: 'cherry-blossom', displayName: '桜', confidence: 92 },
          ],
        })}
      />
    )
    expect(screen.getByTestId('keyword-section-ai-suggestions')).toBeInTheDocument()
    expect(screen.getByText('桜')).toBeInTheDocument()
  })

  it('AI 提案が 0 件の場合は AI 提案エリアごと非表示', () => {
    render(<KeywordSection {...defaultProps({ aiSuggestions: [] })} />)
    expect(screen.queryByTestId('keyword-section-ai-suggestions')).not.toBeInTheDocument()
  })

  // ========== 文脈連動表示 ==========

  it('選択中カテゴリ未指定なら文脈連動エリア非表示', () => {
    render(<KeywordSection {...defaultProps({ selectedCategoryCodes: [] })} />)
    expect(screen.queryByTestId('keyword-section-contextual')).not.toBeInTheDocument()
  })

  it('カテゴリ選択時にそのカテゴリ配下の主要キーワードがチップ表示される', () => {
    render(<KeywordSection {...defaultProps({ selectedCategoryCodes: [206] })} />)
    const ctx = screen.getByTestId('keyword-section-contextual')
    // 植物カテゴリの "桜" と "もみじ" が文脈連動エリアに表示される
    expect(within(ctx).getByText('桜')).toBeInTheDocument()
    expect(within(ctx).getByText('もみじ')).toBeInTheDocument()
    // 植物カテゴリに無いキーワードは表示されない
    expect(within(ctx).queryByText('寿司')).not.toBeInTheDocument()
  })

  it('contextualTopN: 文脈連動エリアは上位 N 件まで', () => {
    // 同カテゴリで 5 件 → topN=2 で 2 件のみ
    const many = [
      { tagId: 10, slug: 'a', displayName: 'A', categoryCodes: [201], sortOrder: 10 },
      { tagId: 11, slug: 'b', displayName: 'B', categoryCodes: [201], sortOrder: 20 },
      { tagId: 12, slug: 'c', displayName: 'C', categoryCodes: [201], sortOrder: 30 },
      { tagId: 13, slug: 'd', displayName: 'D', categoryCodes: [201], sortOrder: 40 },
      { tagId: 14, slug: 'e', displayName: 'E', categoryCodes: [201], sortOrder: 50 },
    ]
    render(
      <KeywordSection
        {...defaultProps({
          allTags: many,
          selectedCategoryCodes: [201],
          contextualTopN: 2,
        })}
      />
    )
    const ctx = screen.getByTestId('keyword-section-contextual')
    expect(within(ctx).getByText('A')).toBeInTheDocument()
    expect(within(ctx).getByText('B')).toBeInTheDocument()
    expect(within(ctx).queryByText('C')).not.toBeInTheDocument()
  })

  // ========== 「もっと細かく」展開 ==========

  it('初期状態では「もっと細かく」展開部は表示されない', () => {
    render(<KeywordSection {...defaultProps()} />)
    expect(screen.queryByTestId('keyword-section-more-panel')).not.toBeInTheDocument()
  })

  it('「もっと細かく」ボタンクリックで展開部が表示される', () => {
    render(<KeywordSection {...defaultProps()} />)
    fireEvent.click(screen.getByTestId('keyword-section-more-toggle'))
    expect(screen.getByTestId('keyword-section-more-panel')).toBeInTheDocument()
  })

  it('展開部に検索 BOX とアコーディオン群が表示される', () => {
    render(<KeywordSection {...defaultProps()} />)
    fireEvent.click(screen.getByTestId('keyword-section-more-toggle'))
    expect(screen.getByTestId('keyword-section-search-input')).toBeInTheDocument()
    // 自然風景・植物・グルメなど少なくとも 1 つのカテゴリアコーディオンが存在する
    expect(screen.getByTestId('keyword-accordion-201')).toBeInTheDocument()
    expect(screen.getByTestId('keyword-accordion-206')).toBeInTheDocument()
  })

  it('検索 BOX に文字を入力するとマッチしないキーワードは非表示になる', () => {
    render(<KeywordSection {...defaultProps()} />)
    fireEvent.click(screen.getByTestId('keyword-section-more-toggle'))
    const input = screen.getByTestId('keyword-section-search-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '桜' } })

    // 桜は残る、犬は消える
    expect(screen.getByText('桜')).toBeInTheDocument()
    expect(screen.queryByText('犬')).not.toBeInTheDocument()
  })

  // ========== 選択トグル・上限 ==========

  it('チップクリックで onSelectionChange が新しい配列で呼ばれる', () => {
    const onChange = vi.fn()
    render(
      <KeywordSection
        {...defaultProps({
          aiSuggestions: [
            { tagId: 3, slug: 'cherry-blossom', displayName: '桜', confidence: 92 },
          ],
          onSelectionChange: onChange,
        })}
      />
    )
    // 桜のチップをクリック
    fireEvent.click(screen.getByText('桜'))
    expect(onChange).toHaveBeenCalledWith([3])
  })

  it('既に選択済みのチップを再度クリックすると選択解除される', () => {
    const onChange = vi.fn()
    render(
      <KeywordSection
        {...defaultProps({
          aiSuggestions: [
            { tagId: 3, slug: 'cherry-blossom', displayName: '桜', confidence: 92 },
          ],
          selectedTagIds: [3],
          onSelectionChange: onChange,
        })}
      />
    )
    fireEvent.click(screen.getByText('桜'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('maxSelections 到達時はそれ以上選択できない', () => {
    const onChange = vi.fn()
    render(
      <KeywordSection
        {...defaultProps({
          allTags: TAGS_FIXTURE,
          selectedTagIds: [1, 2], // 既に 2 件
          maxSelections: 2,
          selectedCategoryCodes: [206],
          onSelectionChange: onChange,
        })}
      />
    )
    // 桜をクリックしようとする（既に上限）
    const ctx = screen.getByTestId('keyword-section-contextual')
    fireEvent.click(within(ctx).getByText('桜'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
