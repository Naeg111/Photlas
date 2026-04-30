import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from 'i18next'
import PrivacyPolicyStandalonePage from './PrivacyPolicyStandalonePage'

/**
 * Issue#99 - Google OAuth 検証要件: プライバシーポリシー URL
 * (https://photlas.jp/privacy-policy) が単独ページとしてアクセス可能で、
 * プライバシーポリシーの本文が表示されることを検証する。
 *
 * Issue#101 - 5 言語対応 + ハードコード日本語テキストの i18n 化
 */
describe('PrivacyPolicyStandalonePage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <PrivacyPolicyStandalonePage />
      </MemoryRouter>
    )
  }

  it('「プライバシーポリシー」見出しが表示される', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'プライバシーポリシー' })).toBeInTheDocument()
  })

  it('プライバシーポリシー本文が表示される（個人情報の文言を含む）', () => {
    renderPage()
    // PrivacyContentJa が描画されていることを 1 文だけ抽出して確認
    expect(screen.getAllByText(/個人情報保護法/).length).toBeGreaterThan(0)
  })
})

describe('Issue#101 - PrivacyPolicyStandalonePage 多言語対応', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <PrivacyPolicyStandalonePage />
      </MemoryRouter>
    )
  }

  afterEach(async () => {
    await i18n.changeLanguage('ja')
  })

  it('既存バグ修正: ko 言語で韓国語コンテンツが表示される（日本語ではなく）', async () => {
    await i18n.changeLanguage('ko')
    renderPage()
    expect(screen.getByText(/제1조/)).toBeInTheDocument()
  })

  it('既存バグ修正: zh-CN 言語で簡体字コンテンツが表示される', async () => {
    await i18n.changeLanguage('zh-CN')
    renderPage()
    expect(screen.getByText(/第1条|第一条/)).toBeInTheDocument()
  })

  it('既存バグ修正: zh-TW 言語で繁体字コンテンツが表示される', async () => {
    await i18n.changeLanguage('zh-TW')
    renderPage()
    expect(screen.getByText(/第1條|第一條/)).toBeInTheDocument()
  })

  it('en 言語では英語の見出しが表示される（i18n 化された h1）', async () => {
    await i18n.changeLanguage('en')
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /Privacy Policy/i })).toBeInTheDocument()
  })

  it('ko 言語では韓国語の見出しが表示される', async () => {
    await i18n.changeLanguage('ko')
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /개인정보/ })).toBeInTheDocument()
  })
})
