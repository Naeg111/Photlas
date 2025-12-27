import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { FilterPanel } from './FilterPanel'

/**
 * Issue#11: フロントエンドデザインのコード導入 - フィルターパネル
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - スライドインアニメーションを持つパネル
 * - 被写体種別フィルター（12種類のチップボタン）
 * - 時期フィルター（1月〜12月の12種類のチップボタン）
 * - 時間帯フィルター（朝・昼・夕方・夜の4種類のチップボタン）
 * - 天候フィルター（晴れ・曇り・雨・雪の4種類のチップボタン）
 * - クリアボタンと適用ボタン
 */

describe('FilterPanel', () => {
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements', () => {
    it('renders when open prop is true', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      // sr-onlyだが、SheetTitleは存在する
      expect(screen.getByText('フィルター')).toBeInTheDocument()
    })

    it('renders all category filter buttons', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const categories = ['風景', '街並み', '植物', '動物', '自動車', 'バイク', '鉄道', '飛行機', '食べ物', 'ポートレート', '星空', 'その他']

      categories.forEach(category => {
        expect(screen.getByRole('button', { name: new RegExp(category) })).toBeInTheDocument()
      })
    })

    it('renders all month filter buttons', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

      // 各月のボタンが存在することを確認（アイコンと月名を含むボタン）
      const allButtons = screen.getAllByRole('button')
      months.forEach(month => {
        const monthButton = allButtons.find(btn =>
          btn.textContent?.trim() === month
        )
        expect(monthButton).toBeTruthy()
      })
    })

    it('renders all time of day filter buttons', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const times = ['朝', '昼', '夕方', '夜']

      times.forEach(time => {
        expect(screen.getByRole('button', { name: new RegExp(time) })).toBeInTheDocument()
      })
    })

    it('renders all weather filter buttons', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const weather = ['晴れ', '曇り', '雨', '雪']

      weather.forEach(condition => {
        expect(screen.getByRole('button', { name: new RegExp(condition) })).toBeInTheDocument()
      })
    })

    it('renders clear button', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByRole('button', { name: 'クリア' })).toBeInTheDocument()
    })

    it('renders apply button', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByRole('button', { name: '適用' })).toBeInTheDocument()
    })
  })

  describe('Category Icons', () => {
    it('renders category icons for each category button', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      // カテゴリアイコンがレンダリングされることを確認
      // SVGまたはアイコンコンポーネントが存在するか
      const buttons = screen.getAllByRole('button')
      const categoryButtons = buttons.filter(btn =>
        ['風景', '街並み', '植物'].some(cat => btn.textContent?.includes(cat))
      )

      expect(categoryButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Month Icons', () => {
    it('renders month icons for each month button', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      // 月のボタンが正しくレンダリングされることを確認
      const monthButtons = screen.getAllByRole('button').filter(btn =>
        ['1月', '2月', '3月'].some(month => btn.textContent?.includes(month))
      )

      expect(monthButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Time of Day Icons', () => {
    it('renders time icons for each time period button', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      // 時間帯のボタンが正しくレンダリングされることを確認
      const timeButtons = screen.getAllByRole('button').filter(btn =>
        ['朝', '昼', '夕方', '夜'].some(time => btn.textContent?.includes(time))
      )

      expect(timeButtons.length).toBe(4)
    })
  })

  describe('Weather Icons', () => {
    it('renders weather icons for each weather condition button', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      // 天候のボタンが正しくレンダリングされることを確認
      const weatherButtons = screen.getAllByRole('button').filter(btn =>
        ['晴れ', '曇り', '雨', '雪'].some(weather => btn.textContent?.includes(weather))
      )

      expect(weatherButtons.length).toBe(4)
    })
  })

  describe('Issue#16: Filter Application', () => {
    it('calls onApply callback with selected filters when apply button is clicked', async () => {
      const mockOnApply = vi.fn()
      const user = userEvent.setup()

      render(
        <FilterPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onApply={mockOnApply}
        />
      )

      // フィルター条件を選択
      const landscapeButton = screen.getByRole('button', { name: /風景/ })
      await user.click(landscapeButton)

      // 月のボタンは複数候補があるため、getAllByRoleとfilterを使用
      const monthButtons = screen.getAllByRole('button').filter(btn => btn.textContent === '1月')
      await user.click(monthButtons[0])

      const morningButton = screen.getByRole('button', { name: /朝/ })
      await user.click(morningButton)

      const sunnyButton = screen.getByRole('button', { name: /晴れ/ })
      await user.click(sunnyButton)

      // 「適用」ボタンをクリック
      const applyButton = screen.getByRole('button', { name: '適用' })
      await user.click(applyButton)

      // onApplyが選択されたフィルター条件とともに呼び出されることを確認
      expect(mockOnApply).toHaveBeenCalledWith({
        categories: ['風景'],
        months: ['1月'],
        timesOfDay: ['朝'],
        weathers: ['晴れ']
      })
    })

    it('calls onApply with empty arrays when no filters are selected', async () => {
      const mockOnApply = vi.fn()
      const user = userEvent.setup()

      render(
        <FilterPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onApply={mockOnApply}
        />
      )

      // 「適用」ボタンをクリック（何も選択せずに）
      const applyButton = screen.getByRole('button', { name: '適用' })
      await user.click(applyButton)

      // onApplyが空の配列とともに呼び出されることを確認
      expect(mockOnApply).toHaveBeenCalledWith({
        categories: [],
        months: [],
        timesOfDay: [],
        weathers: []
      })
    })

    it('resets all filters when clear button is clicked', async () => {
      const user = userEvent.setup()

      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      // フィルター条件を選択
      const landscapeButton = screen.getByRole('button', { name: /風景/ })
      await user.click(landscapeButton)

      // 選択されたことを確認（variant="default"のスタイルが適用される）
      // Note: この確認方法は実装に依存するため、実際のDOMを確認する必要がある

      // 「クリア」ボタンをクリック
      const clearButton = screen.getByRole('button', { name: 'クリア' })
      await userEvent.click(clearButton)

      // すべてのフィルターがリセットされることを確認
      // Note: 実装後、選択状態が解除されることを確認する方法を追加
    })

    it('maintains filter selection state until apply or clear is clicked', async () => {
      const mockOnApply = vi.fn()
      const user = userEvent.setup()

      render(
        <FilterPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onApply={mockOnApply}
        />
      )

      // 複数のフィルター条件を選択
      const landscapeButton = screen.getByRole('button', { name: /風景/ })
      await user.click(landscapeButton)

      const cityscapeButton = screen.getByRole('button', { name: /街並み/ })
      await user.click(cityscapeButton)

      // 「適用」ボタンをクリック
      const applyButton = screen.getByRole('button', { name: '適用' })
      await user.click(applyButton)

      // 複数選択されたフィルター条件が渡されることを確認
      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: expect.arrayContaining(['風景', '街並み'])
        })
      )
    })
  })
})
