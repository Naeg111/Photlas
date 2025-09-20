import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CategoryButtons from './CategoryButtons'

/**
 * CategoryButtons コンポーネントのテスト
 * TDD Red-Green-Refactor サイクルでの開発
 * 
 * Issue#1 要件:
 * - カテゴリボタン群の表示
 * - 横並び配置
 * - 複数カテゴリのボタン（風景、建築等）
 */
describe('CategoryButtons', () => {
  it('renders category buttons container', () => {
    // Red: このテストは最初失敗する（CategoryButtonsコンポーネントが存在しないため）
    render(<CategoryButtons />)
    // コンテナの確認
    expect(screen.getByRole('group') || screen.getByTestId('category-buttons')).toBeInTheDocument()
  })

  it('displays multiple category buttons', () => {
    // Red: 複数のカテゴリボタンが表示される
    render(<CategoryButtons />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(1)
  })

  it('includes expected categories', () => {
    // Red: 期待されるカテゴリが含まれている
    render(<CategoryButtons />)
    expect(screen.getByRole('button', { name: /風景/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /建築/ })).toBeInTheDocument()
  })

  it('all category buttons are clickable', () => {
    // Red: すべてのカテゴリボタンがクリック可能
    render(<CategoryButtons />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).not.toBeDisabled()
    })
  })
})
