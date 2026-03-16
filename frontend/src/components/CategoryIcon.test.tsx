import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CategoryIcon } from './CategoryIcon'

/**
 * CategoryIcon コンポーネントのテスト
 * 各カテゴリに対応するSVGアイコンが正しく表示されることを検証する
 */
describe('CategoryIcon', () => {
  const categories = [
    '風景',
    '街並み',
    'ポートレート',
    '植物',
    '動物',
    '自動車',
    'バイク',
    '鉄道',
    '飛行機',
    '星空',
    '食べ物',
    'その他',
  ]

  it.each(categories)(
    '%s カテゴリのSVGアイコンが表示される',
    (category) => {
      const { container } = render(<CategoryIcon category={category} />)

      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    },
  )

  it('未知のカテゴリでnullが返される', () => {
    const { container } = render(<CategoryIcon category="存在しないカテゴリ" />)

    expect(container.innerHTML).toBe('')
  })

  it('デフォルトのclassName "w-4 h-4" が適用される', () => {
    const { container } = render(<CategoryIcon category="風景" />)

    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('w-4', 'h-4')
  })

  it('カスタムclassNameが指定された場合それが適用される', () => {
    const { container } = render(
      <CategoryIcon category="風景" className="w-8 h-8 text-blue-500" />,
    )

    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('w-8', 'h-8', 'text-blue-500')
  })
})
