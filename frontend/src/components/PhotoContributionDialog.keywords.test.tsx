/**
 * Issue#135 Phase 10: PhotoContributionDialog にキーワードセクションが組み込まれていることのテスト。
 *
 * - 開いた時に /api/v1/tags がフェッチされる
 * - analyzePhoto の suggestedTags が KeywordSection の AI 提案として渡る
 * - onSubmit のペイロードに tagIds / aiOriginatedTagIds が含まれる
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PhotoContributionDialog } from './PhotoContributionDialog'

// fetchTags のモック
const mockFetchTags = vi.fn()
vi.mock('../utils/tagsApi', () => ({
  fetchTags: (...args: unknown[]) => mockFetchTags(...args),
}))

// 他依存のモック（aiPrefill テストと同じ）
vi.mock('motion/react', () => ({
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))
vi.mock('react-map-gl', () => ({
  default: ({ children }: any) => <div>{children}</div>,
  Map: ({ children }: any) => <div>{children}</div>,
  Marker: ({ children }: any) => <div>{children}</div>,
}))
vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(() => ({
    suggest: vi.fn().mockResolvedValue({ suggestions: [] }),
    retrieve: vi.fn().mockResolvedValue({ features: [] }),
  })),
  SessionToken: vi.fn(),
}))
vi.mock('../utils/extractExif', () => ({
  extractExif: vi.fn().mockResolvedValue(null),
}))
vi.mock('./InlineMapPicker', () => ({
  InlineMapPicker: () => <div data-testid="inline-map-picker" />,
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))
vi.mock('react-easy-crop', () => ({
  default: () => <div data-testid="cropper-component" />,
}))
global.URL.createObjectURL = vi.fn(() => 'blob:mock')
global.URL.revokeObjectURL = vi.fn()

const mockAnalyzePhoto = vi.fn()
vi.mock('../utils/photoAnalyzeApi', () => ({
  analyzePhoto: (...args: unknown[]) => mockAnalyzePhoto(...args),
}))
vi.mock('../utils/cropImageToBlob', () => ({
  cropImageToBlob: vi.fn().mockResolvedValue(new Blob(['c'])),
  cropImageToBlobForUpload: vi.fn().mockResolvedValue(new Blob(['c'])),
  resizeImageToBlobForAnalyze: vi.fn().mockResolvedValue(new Blob(['r'])),
}))

describe('PhotoContributionDialog - Issue#135 キーワードセクション組込', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchTags.mockResolvedValue({
      tags: [
        { tagId: 1, slug: 'cherry-blossom', displayName: '桜', categoryCodes: [206], sortOrder: 10 },
      ],
    })
    mockAnalyzePhoto.mockResolvedValue({
      categories: [],
      weather: null,
      confidence: {},
      analyzeToken: 'token',
      parentFallbacks: [],
      exifRulesFired: [],
      suggestedTags: [
        { tagId: 1, slug: 'cherry-blossom', displayName: '桜', confidence: 92.0 },
      ],
    })
  })

  it('Issue#135 - ダイアログ表示時に /api/v1/tags がフェッチされる', async () => {
    render(<PhotoContributionDialog open onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(mockFetchTags).toHaveBeenCalled()
    })
  })

  it('Issue#135 - ファイル選択後、analyzePhoto の suggestedTags が KeywordSection の AI 提案として表示される', async () => {
    const user = userEvent.setup()
    render(<PhotoContributionDialog open onOpenChange={vi.fn()} />)

    const file = new File(['x'], 't.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(mockAnalyzePhoto).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByTestId('keyword-section-ai-suggestions')).toBeInTheDocument()
      expect(screen.getByText('桜')).toBeInTheDocument()
    })
  })

  // ========== Issue#141 Phase 9: 投稿フォーム互換確認 (Q2) ==========

  it('Issue#141 Phase 9: 投稿フォームでカテゴリを選択しても tagIds は auto-select されない (Q2)', async () => {
    // 植物カテゴリ配下に複数 tag を持つ fixture
    mockFetchTags.mockResolvedValue({
      tags: [
        { tagId: 1, slug: 'cherry-blossom', displayName: '桜', categoryCodes: [206], sortOrder: 10 },
        { tagId: 4, slug: 'maple', displayName: 'もみじ', categoryCodes: [206], sortOrder: 100 },
      ],
    })

    const user = userEvent.setup()
    render(<PhotoContributionDialog open onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(mockFetchTags).toHaveBeenCalled()
    })

    // 植物カテゴリの role=button 親要素を pointerDown でトグル (実装は onPointerDown)
    const plantsButton = await screen.findByRole('button', { name: /植物/i })
    await user.pointer({ keys: '[MouseLeft>]', target: plantsButton })
    await user.pointer({ keys: '[/MouseLeft]', target: plantsButton })

    // 文脈連動エリアに 桜・もみじ チップが現れる (表示は OK)
    await waitFor(() => {
      const ctx = screen.queryByTestId('keyword-section-contextual')
      expect(ctx).toBeInTheDocument()
    })

    // しかし auto-select で「selected」状態のチップは無いはず (投稿フォームは false)
    // selected チップは bg-gray-900 (CSS class) で見分ける
    const ctx = screen.getByTestId('keyword-section-contextual')
    const selectedChips = ctx.querySelectorAll('.bg-gray-900')
    expect(selectedChips).toHaveLength(0)
  })
})
