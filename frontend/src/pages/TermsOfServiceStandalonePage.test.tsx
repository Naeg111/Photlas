import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TermsOfServiceStandalonePage from './TermsOfServiceStandalonePage'

/**
 * Issue#99 - Google OAuth 検証要件: 利用規約 URL
 * (https://photlas.jp/terms-of-service) が単独ページとしてアクセス可能で、
 * 利用規約の本文が表示されることを検証する。
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
    expect(screen.getByText(/Photlas運営/)).toBeInTheDocument()
  })
})
