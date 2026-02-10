import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotFoundPage from './NotFoundPage'

describe('NotFoundPage', () => {
  const originalTitle = document.title

  afterEach(() => {
    document.title = originalTitle
  })

  it('404メッセージが表示される', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    )

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('ページが見つかりません')).toBeInTheDocument()
    expect(screen.getByText('お探しのページは存在しないか、移動した可能性があります。')).toBeInTheDocument()
  })

  it('トップページへのリンクが存在する', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    )

    const link = screen.getByText('トップページへ戻る')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/')
  })

  it('document.titleが設定される', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    )

    expect(document.title).toBe('ページが見つかりません - Photlas')
  })
})
