import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OAuthButtons from './OAuthButtons'

describe('OAuthButtons', () => {
  let originalLocation: Location

  beforeEach(() => {
    // window.location.href を監視可能にする
    originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        href: '',
      },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('enabled=false の場合は何もレンダリングしない', () => {
    const { container } = render(<OAuthButtons enabled={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('enabled=true の場合、Google と LINE ボタンをレンダリングする（signIn variant）', () => {
    render(<OAuthButtons enabled={true} variant="signIn" />)
    expect(screen.getByRole('button', { name: 'Google でサインイン' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LINE でサインイン' })).toBeInTheDocument()
  })

  it('signUp variant では「新規登録」の文言になる', () => {
    render(<OAuthButtons enabled={true} variant="signUp" />)
    expect(screen.getByRole('button', { name: 'Google で新規登録' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LINE で新規登録' })).toBeInTheDocument()
  })

  it('Google ボタンクリックで /api/v1/auth/oauth2/authorization/google に遷移（lang パラメータ付き）', async () => {
    render(<OAuthButtons enabled={true} />)
    await userEvent.click(screen.getByRole('button', { name: 'Google でサインイン' }))
    expect(window.location.href).toContain('/api/v1/auth/oauth2/authorization/google')
    expect(window.location.href).toContain('lang=')
  })

  it('LINE ボタンクリックで /api/v1/auth/oauth2/authorization/line に遷移', async () => {
    render(<OAuthButtons enabled={true} />)
    await userEvent.click(screen.getByRole('button', { name: 'LINE でサインイン' }))
    expect(window.location.href).toContain('/api/v1/auth/oauth2/authorization/line')
  })

  it('区切り線（または）を表示する', () => {
    render(<OAuthButtons enabled={true} />)
    expect(screen.getByText('または')).toBeInTheDocument()
  })
})
