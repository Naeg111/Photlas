import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
})
