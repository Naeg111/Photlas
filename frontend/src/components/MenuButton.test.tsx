import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import MenuButton from './MenuButton'

/**
 * MenuButton コンポーネントのテスト
 * TDD Red-Green-Refactor サイクルでの開発
 * 
 * Issue#1 要件:
 * - メニューボタンの表示
 * - 右上に配置
 * - クリック可能
 */
describe('MenuButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders menu button', () => {
    // Red: このテストは最初失敗する（MenuButtonコンポーネントが存在しないため）
    render(<MenuButton />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('displays correct text', () => {
    // Red: ボタンテキストの確認
    render(<MenuButton />)
    expect(screen.getByRole('button')).toHaveTextContent('メニュー')
  })

  it('is clickable', () => {
    // Red: クリック可能性の確認
    render(<MenuButton />)
    const button = screen.getByRole('button')
    expect(button).not.toBeDisabled()
  })
})
