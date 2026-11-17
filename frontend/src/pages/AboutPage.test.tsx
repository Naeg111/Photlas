import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AboutPage from './AboutPage'
import i18n from '../i18n'

/**
 * Issue#99 - Google OAuth 検証要件: ホームページが
 *   1. アプリ名「Photlas」を可視テキストで表示
 *   2. アプリの目的を説明する文章を含む
 *   3. プライバシーポリシーへの可視 <a href> リンクを含む
 *   4. 利用規約への可視 <a href> リンクを含む
 * を満たすことを検証する。
 */
describe('AboutPage', () => {
  beforeEach(() => {
    document.querySelectorAll('meta[name="robots"]').forEach((el) => el.remove())
  })

  function renderPage() {
    return render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    )
  }

  it('Issue#143 - コンテンツページなので noindex メタは付与されない', () => {
    renderPage()
    expect(document.querySelector('meta[name="robots"]')).toBeNull()
  })

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

  it('Spec#93 追加対応: 英語の設定では、本文・リンク・タブ名が英語で表示される', async () => {
    await i18n.changeLanguage('en')
    try {
      renderPage()
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Photlas')
      expect(screen.getByText(/discovering places you want to visit through photos/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Try Photlas' })).toHaveAttribute('href', '/')
      expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy')
      expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms-of-service')
      expect(screen.getByText('Key features')).toBeInTheDocument()
      expect(document.title).toBe('Photlas - Discover places you want to visit through photos')
      expect(screen.queryByText(/写真から行ってみたい場所が見つかる/)).not.toBeInTheDocument()
    } finally {
      await i18n.changeLanguage('ja')
    }
  })
})
