import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OAuthSignUpDialog from './OAuthSignUpDialog'

function renderDialog(overrides?: {
  onOpenChange?: (open: boolean) => void
  onBack?: () => void
  onShowLogin?: () => void
  onShowTerms?: () => void
}) {
  return render(
    <OAuthSignUpDialog
      open={true}
      onOpenChange={overrides?.onOpenChange ?? vi.fn()}
      onBack={overrides?.onBack ?? vi.fn()}
      onShowLogin={overrides?.onShowLogin ?? vi.fn()}
      onShowTerms={overrides?.onShowTerms ?? vi.fn()}
    />
  )
}

describe('OAuthSignUpDialog', () => {
  // 本ダイアログは OAuth 有効時にしか開かれない前提。
  // テスト環境ではデフォルトで VITE_OAUTH_ENABLED 未設定のため、'true' をスタブする。
  beforeEach(() => {
    vi.stubEnv('VITE_OAUTH_ENABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('タイトルと説明文を表示する', () => {
    renderDialog()
    expect(screen.getByText('SNSで新規登録')).toBeInTheDocument()
    expect(screen.getByText('SNSアカウントで Photlas に新規登録します。')).toBeInTheDocument()
  })

  it('Google / LINE ボタンが表示される（variant signUp）', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Google で新規登録' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LINE で新規登録' })).toBeInTheDocument()
  })

  it('利用規約チェックボックス未チェックの初期状態では Google / LINE ボタンが disabled', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Google で新規登録' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'LINE で新規登録' })).toBeDisabled()
  })

  it('利用規約チェックボックスを ON にすると Google / LINE ボタンが有効化される', async () => {
    renderDialog()
    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)

    expect(screen.getByRole('button', { name: 'Google で新規登録' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'LINE で新規登録' })).toBeEnabled()
  })

  it('利用規約ラベル内の「利用規約」リンククリックで onShowTerms が呼ばれる', async () => {
    const onShowTerms = vi.fn()
    renderDialog({ onShowTerms })

    await userEvent.click(screen.getByRole('link', { name: '利用規約' }))
    expect(onShowTerms).toHaveBeenCalled()
  })

  it('「すでにアカウントをお持ちの方はログイン」リンクで onShowLogin が呼ばれる', async () => {
    const onShowLogin = vi.fn()
    renderDialog({ onShowLogin })

    await userEvent.click(
      screen.getByRole('button', { name: 'すでにアカウントをお持ちの方はログイン' })
    )
    expect(onShowLogin).toHaveBeenCalled()
  })

  it('「キャンセル」ボタンで onBack が呼ばれる（SignUpMethodDialog に戻る）', async () => {
    const onBack = vi.fn()
    renderDialog({ onBack })

    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('「キャンセル」ボタンは w-full クラスを持つ（SignUpDialog の登録+キャンセル合計幅と同等）', () => {
    renderDialog()
    const cancelBtn = screen.getByRole('button', { name: 'キャンセル' })
    // Q2: キャンセル幅は SignUpDialog の (キャンセル + 登録) 合計 = コンテナ幅いっぱい
    expect(cancelBtn.className).toContain('w-full')
  })

  it('open=false で内容が表示されない', () => {
    render(
      <OAuthSignUpDialog
        open={false}
        onOpenChange={vi.fn()}
        onBack={vi.fn()}
        onShowLogin={vi.fn()}
        onShowTerms={vi.fn()}
      />
    )
    expect(screen.queryByText('SNSで新規登録')).not.toBeInTheDocument()
  })
})
