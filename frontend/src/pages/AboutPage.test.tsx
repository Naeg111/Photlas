import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AboutPage from './AboutPage'

/**
 * Issue#99 - Google OAuth 検証要件: ホームページが
 *   1. アプリ名「Photlas」を可視テキストで表示
 *   2. アプリの目的を説明する文章を含む
 *   3. プライバシーポリシーへの可視 <a href> リンクを含む
 *   4. 利用規約への可視 <a href> リンクを含む
 * を満たすことを検証する。
 */
describe('AboutPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    )
  }

  it('「Photlas」がアプリ名として h1 で表示される', () => {
    renderPage()
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Photlas')
  })

  it('アプリの目的を説明する文章が表示される', () => {
    renderPage()
    expect(screen.getByText(/写真から行ってみたい場所が見つかる/)).toBeInTheDocument()
  })

  it('プライバシーポリシーへの可視リンクがある', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /プライバシーポリシー/ })
    expect(link).toHaveAttribute('href', '/privacy-policy')
  })

  it('利用規約への可視リンクがある', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /利用規約/ })
    expect(link).toHaveAttribute('href', '/terms-of-service')
  })

  it('「Photlas を使ってみる」CTA リンクがあり / に遷移する', () => {
    renderPage()
    const cta = screen.getByRole('link', { name: 'Photlas を使ってみる' })
    expect(cta).toHaveAttribute('href', '/')
  })
})
