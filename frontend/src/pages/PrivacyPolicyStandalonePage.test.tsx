import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPolicyStandalonePage from './PrivacyPolicyStandalonePage'

/**
 * Issue#99 - Google OAuth 検証要件: プライバシーポリシー URL
 * (https://photlas.jp/privacy-policy) が単独ページとしてアクセス可能で、
 * プライバシーポリシーの本文が表示されることを検証する。
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
