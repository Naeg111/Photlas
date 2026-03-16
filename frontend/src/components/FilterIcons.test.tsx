import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MonthIcons, TimeIcons, WeatherIcons } from './FilterIcons'

/**
 * FilterIcons コンポーネントのテスト
 * 月・時間帯・天候の各フィルターアイコンが正しくレンダリングされることを検証する
 */
describe('FilterIcons', () => {
  describe('MonthIcons', () => {
    const months = [
      '1月',
      '2月',
      '3月',
      '4月',
      '5月',
      '6月',
      '7月',
      '8月',
      '9月',
      '10月',
      '11月',
      '12月',
    ]

    it.each(months)(
      '%s のアイコンがSVG要素としてレンダリングされる',
      (month) => {
        const IconComponent = MonthIcons[month]
        expect(IconComponent).toBeDefined()

        const { container } = render(<IconComponent />)
        const svg = container.querySelector('svg')
        expect(svg).toBeInTheDocument()
      },
    )

    it('classNameプロパティを受け取れる', () => {
      const IconComponent = MonthIcons['3月']
      const { container } = render(<IconComponent className="w-8 h-8" />)

      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('w-8', 'h-8')
    })
  })

  describe('TimeIcons', () => {
    const times = ['朝', '昼', '夕方', '夜']

    it.each(times)(
      '%s のアイコンがSVG要素としてレンダリングされる',
      (time) => {
        const IconComponent = TimeIcons[time]
        expect(IconComponent).toBeDefined()

        const { container } = render(<IconComponent />)
        const svg = container.querySelector('svg')
        expect(svg).toBeInTheDocument()
      },
    )

    it('classNameプロパティを受け取れる', () => {
      const IconComponent = TimeIcons['朝']
      const { container } = render(<IconComponent className="w-10 h-10" />)

      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('w-10', 'h-10')
    })
  })

  describe('WeatherIcons', () => {
    const weathers = ['晴れ', '曇り', '雨', '雪']

    it.each(weathers)(
      '%s のアイコンがSVG要素としてレンダリングされる',
      (weather) => {
        const IconComponent = WeatherIcons[weather]
        expect(IconComponent).toBeDefined()

        const { container } = render(<IconComponent />)
        const svg = container.querySelector('svg')
        expect(svg).toBeInTheDocument()
      },
    )

    it('classNameプロパティを受け取れる', () => {
      const IconComponent = WeatherIcons['晴れ']
      const { container } = render(<IconComponent className="w-6 h-6" />)

      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('w-6', 'h-6')
    })
  })

  describe('存在しないキー', () => {
    it('MonthIconsで存在しないキーはundefinedを返す', () => {
      const result = MonthIcons['13月']
      expect(result).toBeUndefined()
    })

    it('TimeIconsで存在しないキーはundefinedを返す', () => {
      const result = TimeIcons['深夜']
      expect(result).toBeUndefined()
    })

    it('WeatherIconsで存在しないキーはundefinedを返す', () => {
      const result = WeatherIcons['台風']
      expect(result).toBeUndefined()
    })
  })
})
