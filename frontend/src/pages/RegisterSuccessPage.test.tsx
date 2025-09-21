import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import RegisterSuccessPage from './RegisterSuccessPage'

/**
 * RegisterSuccessPage コンポーネントのテスト
 * Issue#2: ユーザー登録機能 (UI) - 登録完了ページ
 * 
 * TDD Red段階: 実装前のテストケース定義
 */
describe('RegisterSuccessPage', () => {
  // 各テスト後にDOMをクリーンアップ
  afterEach(() => {
    cleanup()
  })

  describe('Basic Layout', () => {
    it('renders success message heading', () => {
      render(
        <MemoryRouter>
          <RegisterSuccessPage />
        </MemoryRouter>
      )
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('登録完了')
    })

    it('renders success message', () => {
      render(
        <MemoryRouter>
          <RegisterSuccessPage />
        </MemoryRouter>
      )
      
      expect(screen.getByText('登録ありがとうございます！')).toBeInTheDocument()
    })

    it('renders email verification instruction', () => {
      render(
        <MemoryRouter>
          <RegisterSuccessPage />
        </MemoryRouter>
      )
      
      expect(screen.getByText('ご登録のメールアドレスに確認メールを送信しました。メール内のリンクをクリックして、登録を完了してください。')).toBeInTheDocument()
    })

    it('renders navigation link to top page', () => {
      render(
        <MemoryRouter>
          <RegisterSuccessPage />
        </MemoryRouter>
      )
      
      const topPageLink = screen.getByRole('link', { name: 'トップページへ' })
      expect(topPageLink).toBeInTheDocument()
      expect(topPageLink).toHaveAttribute('href', '/')
    })
  })

  describe('Success Message Display', () => {
    it('displays success message prominently', () => {
      render(
        <MemoryRouter>
          <RegisterSuccessPage />
        </MemoryRouter>
      )
      
      const successMessage = screen.getByText('登録ありがとうございます！')
      expect(successMessage).toHaveClass('text-green-600') // 緑色で表示
    })

    it('displays verification instruction with proper styling', () => {
      render(
        <MemoryRouter>
          <RegisterSuccessPage />
        </MemoryRouter>
      )
      
      const instruction = screen.getByText('ご登録のメールアドレスに確認メールを送信しました。メール内のリンクをクリックして、登録を完了してください。')
      expect(instruction).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('renders top page link with proper styling', () => {
      render(
        <MemoryRouter>
          <RegisterSuccessPage />
        </MemoryRouter>
      )
      
      const link = screen.getByRole('link', { name: 'トップページへ' })
      expect(link).toHaveClass('bg-blue-500') // 青いリンク
      expect(link).toHaveClass('text-white') // 白いテキスト
    })

    it('link navigates to home page', () => {
      render(
        <MemoryRouter>
          <RegisterSuccessPage />
        </MemoryRouter>
      )
      
      const link = screen.getByRole('link', { name: 'トップページへ' })
      expect(link).toHaveAttribute('href', '/')
    })
  })
})
