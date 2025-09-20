import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RegisterSuccessPage from './RegisterSuccessPage'

/**
 * RegisterSuccessPage コンポーネントのテスト
 * Issue#2: ユーザー登録機能 (UI) - 登録完了ページ
 * 
 * TDD Red段階: 実装前のテストケース定義
 */
describe('RegisterSuccessPage', () => {
  describe('Basic Layout', () => {
    it('renders success message', () => {
      render(<RegisterSuccessPage />)
      
      expect(screen.getByText('登録ありがとうございます！')).toBeInTheDocument()
    })

    it('renders email verification instruction', () => {
      render(<RegisterSuccessPage />)
      
      expect(screen.getByText('ご登録のメールアドレスに確認メールを送信しました。メール内のリンクをクリックして、登録を完了してください。')).toBeInTheDocument()
    })

    it('renders navigation button to top page', () => {
      render(<RegisterSuccessPage />)
      
      const topPageButton = screen.getByRole('button', { name: 'トップページへ' })
      expect(topPageButton).toBeInTheDocument()
    })

    it('renders correct page title', () => {
      render(<RegisterSuccessPage />)
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('登録完了')
    })
  })

  describe('Success Message Display', () => {
    it('displays success message prominently', () => {
      render(<RegisterSuccessPage />)
      
      const successMessage = screen.getByText('登録ありがとうございます！')
      expect(successMessage).toHaveClass('text-green-600') // 緑色で表示
    })

    it('displays verification instruction with proper styling', () => {
      render(<RegisterSuccessPage />)
      
      const instruction = screen.getByText('ご登録のメールアドレスに確認メールを送信しました。メール内のリンクをクリックして、登録を完了してください。')
      expect(instruction).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('renders top page button with proper styling', () => {
      render(<RegisterSuccessPage />)
      
      const button = screen.getByRole('button', { name: 'トップページへ' })
      expect(button).toHaveClass('bg-blue-500') // 青いボタン
      expect(button).toHaveClass('text-white') // 白いテキスト
    })

    it('button is clickable', () => {
      render(<RegisterSuccessPage />)
      
      const button = screen.getByRole('button', { name: 'トップページへ' })
      expect(button).not.toBeDisabled()
    })
  })
})
