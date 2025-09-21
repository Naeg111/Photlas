import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

/**
 * App コンポーネントのテスト
 * Issue#2 対応: ルーティング機能追加
 */
describe('App', () => {
  afterEach(() => {
    // 確実なDOMクリーンアップ
    cleanup()
    document.body.innerHTML = ''
  })

  it('renders Photlas heading on home page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Photlas')
  })

  it('renders map area description on home page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByText('地図表示エリア (Google Maps Platform)')).toBeInTheDocument()
  })

  it('renders all floating UI components on home page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    // フローティング要素の確認
    expect(screen.getByRole('button', { name: 'フィルター' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'メニュー' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+' })).toBeInTheDocument()
    expect(screen.getByTestId('category-buttons')).toBeInTheDocument()
  })

  it('renders RegisterPage when navigating to /register', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <App />
      </MemoryRouter>
    )
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('アカウント登録')
  })

  it('renders RegisterSuccessPage when navigating to /register/success', () => {
    render(
      <MemoryRouter initialEntries={['/register/success']}>
        <App />
      </MemoryRouter>
    )
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('登録完了')
    expect(screen.getByText('登録ありがとうございます！')).toBeInTheDocument()
  })

  it('renders 404 page for unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>
    )
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ページが見つかりません')
  })
})