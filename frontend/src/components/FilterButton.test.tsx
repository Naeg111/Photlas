import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FilterButton from './FilterButton'

/**
 * FilterButton コンポーネントのテスト
 * TDD Red-Green-Refactor サイクルでの開発
 * 
 * Issue#1 要件:
 * - フィルターボタンの表示
 * - クリック可能
 * - 適切なスタイリング
 */
describe('FilterButton', () => {
  it('renders filter button', () => {
    // Red: このテストは最初失敗する（FilterButtonコンポーネントが存在しないため）
    render(<FilterButton />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('displays correct text', () => {
    // Red: ボタンテキストの確認
    render(<FilterButton />)
    expect(screen.getByRole('button')).toHaveTextContent('フィルター')
  })

  it('is clickable', () => {
    // Red: クリック可能性の確認
    render(<FilterButton />)
    const button = screen.getByRole('button')
    expect(button).not.toBeDisabled()
  })
})
