import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SplashScreen } from './SplashScreen'

/**
 * Issue#85: スプラッシュ画面のデザインリニューアル（ドロップバウンスアニメーション）
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - アイコン（ピンとカメラ）のみを画面中央に配置
 * - 「Photlas」テキストは表示しない
 * - ローディングスピナーは表示しない
 * - フェードアウトアニメーション（exit）
 */

describe('SplashScreen', () => {
  describe('UI Elements', () => {
    it('does not render the application name', () => {
      render(<SplashScreen />)

      expect(screen.queryByText('Photlas')).not.toBeInTheDocument()
    })

    it('does not render loading spinner', () => {
      const { container } = render(<SplashScreen />)

      const spinner = container.querySelector('[class*="animate-spin"]')
      expect(spinner).not.toBeInTheDocument()
    })

    it('renders the logo SVG element', () => {
      const { container } = render(<SplashScreen />)

      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveAttribute('viewBox', '56 60 400 400')
    })

    it('renders with full screen black background', () => {
      const { container } = render(<SplashScreen />)

      const splashDiv = container.firstChild
      expect(splashDiv).toHaveClass('fixed', 'inset-0', 'bg-black')
    })

    it('does not apply animation class on initial render to prevent cached state restoration', () => {
      vi.useFakeTimers()
      const { container } = render(<SplashScreen />)

      expect(container.querySelector('.animate-drop-bounce')).not.toBeInTheDocument()
      vi.useRealTimers()
    })

    it('applies animation class after deferred execution', () => {
      vi.useFakeTimers()
      const { container } = render(<SplashScreen />)

      act(() => { vi.runAllTimers() })
      expect(container.querySelector('.animate-drop-bounce')).toBeInTheDocument()
      vi.useRealTimers()
    })

    it('has inline opacity 0 on icon wrapper regardless of animation state', () => {
      const { container } = render(<SplashScreen />)

      const iconWrapper = container.querySelector('svg')?.parentElement
      expect(iconWrapper).toHaveStyle({ opacity: '0' })
    })

    it('has critical inline styles on container for PWA CSS-loading race', () => {
      const { container } = render(<SplashScreen />)

      const splashDiv = container.firstChild as HTMLElement
      const style = splashDiv.getAttribute('style') ?? ''
      expect(style).toContain('position: fixed')
      expect(style).toContain('background-color: black')
      expect(style).toContain('display: flex')
      expect(style).toContain('align-items: center')
      expect(style).toContain('justify-content: center')
    })

    it('uses vmin for orientation-independent icon sizing', () => {
      const { container } = render(<SplashScreen />)

      const svg = container.querySelector('svg')
      const style = svg?.getAttribute('style') ?? ''
      expect(style).toContain('vmin')
      expect(style).not.toContain('vw')
    })
  })

  describe('Layout', () => {
    it('centers content vertically and horizontally', () => {
      const { container } = render(<SplashScreen />)

      const splashDiv = container.firstChild
      expect(splashDiv).toHaveClass('flex', 'items-center', 'justify-center')
    })

    it('has highest z-index to overlay everything', () => {
      const { container } = render(<SplashScreen />)

      const splashDiv = container.firstChild
      expect(splashDiv).toHaveClass('z-50')
    })
  })

  describe('Logo Design', () => {
    it('includes map pin shape in SVG', () => {
      const { container } = render(<SplashScreen />)

      const svg = container.querySelector('svg')
      const paths = svg?.querySelectorAll('path')
      expect(paths).toBeTruthy()
      expect(paths!.length).toBeGreaterThan(0)
    })

    it('includes camera lens circle in SVG', () => {
      const { container } = render(<SplashScreen />)

      const svg = container.querySelector('svg')
      const circles = svg?.querySelectorAll('circle')
      expect(circles).toBeTruthy()
      expect(circles!.length).toBeGreaterThanOrEqual(2)
    })

    it('includes camera body rect in SVG', () => {
      const { container } = render(<SplashScreen />)

      const svg = container.querySelector('svg')
      const rects = svg?.querySelectorAll('rect')
      expect(rects).toBeTruthy()
      expect(rects!.length).toBeGreaterThanOrEqual(2)
    })
  })
})
