import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SplashScreen } from './SplashScreen'

/**
 * Issue#11: フロントエンドデザインのコード導入 - スプラッシュスクリーン
 * TDD Red段階: 実装前のテストケース定義
 *
 * UI要件:
 * - アプリケーション起動時に表示される
 * - ロゴ（ピンとカメラアパーチャー）の表示
 * - アプリ名「Photlas」の表示
 * - ローディングアニメーション（スピナー）の表示
 * - フェードアウトアニメーション
 */

describe('SplashScreen', () => {
  describe('UI Elements', () => {
    it('renders the application name', () => {
      render(<SplashScreen />)

      expect(screen.getByText('Photlas')).toBeInTheDocument()
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

    it('renders loading spinner icon', () => {
      const { container } = render(<SplashScreen />)

      // lucide-reactのLoader2アイコンを探す
      const spinner = container.querySelector('[class*="animate-spin"]')
      expect(spinner).toBeInTheDocument()
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
