import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from 'i18next'
import TermsOfServiceStandalonePage from './TermsOfServiceStandalonePage'

/**
 * Issue#99 - Google OAuth 検証要件: 利用規約 URL
 * (https://photlas.jp/terms-of-service) が単独ページとしてアクセス可能で、
 * 利用規約の本文が表示されることを検証する。
 *
 * Issue#101 - 5 言語対応 + ハードコード日本語テキストの i18n 化
 */
describe('TermsOfServiceStandalonePage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <TermsOfServiceStandalonePage />
      </MemoryRouter>
    )
  }

  it('「利用規約」見出しが表示される', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: '利用規約' })).toBeInTheDocument()
  })

  it('利用規約本文が表示される（規約の冒頭文を含む）', () => {
    renderPage()
    expect(screen.getAllByText(/Photlas運営/).length).toBeGreaterThan(0)
  })
})

describe('Issue#101 - TermsOfServiceStandalonePage 多言語対応', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <TermsOfServiceStandalonePage />
      </MemoryRouter>
    )
  }

  afterEach(async () => {
    await i18n.changeLanguage('ja')
  })

  it('既存バグ修正: ko 言語で韓国語コンテンツが表示される（日本語ではなく）', async () => {
    await i18n.changeLanguage('ko')
    renderPage()
    expect(screen.getAllByText(/제1조/).length).toBeGreaterThan(0)
  })

  it('既存バグ修正: zh-CN 言語で簡体字コンテンツが表示される', async () => {
    await i18n.changeLanguage('zh-CN')
    renderPage()
    expect(screen.getAllByText(/第1条|第一条/).length).toBeGreaterThan(0)
  })

  it('既存バグ修正: zh-TW 言語で繁体字コンテンツが表示される', async () => {
    await i18n.changeLanguage('zh-TW')
    renderPage()
    expect(screen.getAllByText(/第1條|第一條/).length).toBeGreaterThan(0)
  })

  it('en 言語では英語の見出しが表示される（i18n 化された h1）', async () => {
    await i18n.changeLanguage('en')
    renderPage()
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s.some(h => /Terms of Service/i.test(h.textContent ?? ''))).toBe(true)
  })

  it('ko 言語では韓国語の見出しが表示される', async () => {
    await i18n.changeLanguage('ko')
    renderPage()
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s.some(h => /이용약관/.test(h.textContent ?? ''))).toBe(true)
  })
})
