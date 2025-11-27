import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import PostButton from './PostButton'

/**
 * PostButton コンポーネントのテスト
 * TDD Red-Green-Refactor サイクルでの開発
 * 
 * Issue#1 要件:
 * - 右下に配置される丸いプラスボタン
 * - フローティングアクションボタンのスタイル
 * - クリック可能
 */
describe('PostButton', () => {
  afterEach(() => {
    cleanup()
  })
  it('renders post button', () => {
    // Red: このテストは最初失敗する（PostButtonコンポーネントが存在しないため）
    render(<PostButton />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('displays plus symbol', () => {
    // Red: プラス記号の表示確認
    render(<PostButton />)
    expect(screen.getByRole('button')).toHaveTextContent('+')
  })

  it('has floating action button styling', () => {
    // Red: フローティングアクションボタンのスタイル確認
    render(<PostButton />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('rounded-full') // 丸いボタン
  })
})
