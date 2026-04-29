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

  // ---------- 基本レンダリング（Issue#104 でラベル「〇〇で続ける」に統一） ----------

  it('enabled=true の場合、Google と LINE ボタンをレンダリングする（「続ける」文言）', () => {
    render(<OAuthButtons enabled={true} />)
    expect(screen.getByRole('button', { name: 'Google で続ける' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LINE で続ける' })).toBeInTheDocument()
  })

  it('Google ボタンクリックで /api/v1/auth/oauth2/authorization/google に遷移（lang パラメータ付き）', async () => {
    render(<OAuthButtons enabled={true} />)
    await userEvent.click(screen.getByRole('button', { name: 'Google で続ける' }))
    expect(window.location.href).toContain('/api/v1/auth/oauth2/authorization/google')
    expect(window.location.href).toContain('lang=')
  })

  it('LINE ボタンクリックで /api/v1/auth/oauth2/authorization/line に遷移', async () => {
    render(<OAuthButtons enabled={true} />)
    await userEvent.click(screen.getByRole('button', { name: 'LINE で続ける' }))
    expect(window.location.href).toContain('/api/v1/auth/oauth2/authorization/line')
  })

  it('区切り線（または）を表示する（デフォルト）', () => {
    render(<OAuthButtons enabled={true} />)
    expect(screen.getByText('または')).toBeInTheDocument()
  })

  // ---------- Phase 8a: Q4 新仕様「OAuth 無効時でも disabled で表示」 ----------

  it('[Phase 8a] enabled=false の場合でもボタンは表示され、両方とも disabled 状態になる', () => {
    render(<OAuthButtons enabled={false} />)
    const googleBtn = screen.getByRole('button', { name: 'Google で続ける' })
    const lineBtn = screen.getByRole('button', { name: 'LINE で続ける' })
    expect(googleBtn).toBeInTheDocument()
    expect(lineBtn).toBeInTheDocument()
    expect(googleBtn).toBeDisabled()
    expect(lineBtn).toBeDisabled()
  })

  it('[Phase 8a] enabled=false のボタンをクリックしても window.location.href は変化しない', async () => {
    render(<OAuthButtons enabled={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Google で続ける' }))
    expect(window.location.href).toBe('')
  })

  // ---------- Phase 8a: disabled prop ----------

  it('[Phase 8a] disabled=true のとき、enabled=true でも両ボタンが disabled', () => {
    render(<OAuthButtons enabled={true} disabled={true} />)
    const googleBtn = screen.getByRole('button', { name: 'Google で続ける' })
    const lineBtn = screen.getByRole('button', { name: 'LINE で続ける' })
    expect(googleBtn).toBeDisabled()
    expect(lineBtn).toBeDisabled()
  })

  it('[Phase 8a] disabled=true のボタンをクリックしても遷移しない', async () => {
    render(<OAuthButtons enabled={true} disabled={true} />)
    await userEvent.click(screen.getByRole('button', { name: 'Google で続ける' }))
    expect(window.location.href).toBe('')
  })

  it('[Phase 8a] enabled=true かつ disabled=false（省略含む）はクリック可能（既存挙動）', async () => {
    render(<OAuthButtons enabled={true} disabled={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Google で続ける' }))
    expect(window.location.href).toContain('/api/v1/auth/oauth2/authorization/google')
  })

  // ---------- Phase 8a: hideDivider prop ----------

  it('[Phase 8a] hideDivider=true のとき「または」区切り線を表示しない', () => {
    render(<OAuthButtons enabled={true} hideDivider={true} />)
    expect(screen.queryByText('または')).not.toBeInTheDocument()
    // ボタン自体は表示される
    expect(screen.getByRole('button', { name: 'Google で続ける' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LINE で続ける' })).toBeInTheDocument()
  })

  it('[Phase 8a] hideDivider=false（省略含む）では「または」を表示する', () => {
    render(<OAuthButtons enabled={true} />)
    expect(screen.getByText('または')).toBeInTheDocument()
  })
})
