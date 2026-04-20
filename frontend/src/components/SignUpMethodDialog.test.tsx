import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignUpMethodDialog from './SignUpMethodDialog'

function renderDialog(overrides?: {
  onOpenChange?: (open: boolean) => void
  onChooseSns?: () => void
  onChooseEmail?: () => void
}) {
  return render(
    <SignUpMethodDialog
      open={true}
      onOpenChange={overrides?.onOpenChange ?? vi.fn()}
      onChooseSns={overrides?.onChooseSns ?? vi.fn()}
      onChooseEmail={overrides?.onChooseEmail ?? vi.fn()}
    />
  )
}

describe('SignUpMethodDialog', () => {
  it('タイトルと説明文を表示する', () => {
    renderDialog()
    expect(screen.getByText('アカウント作成方法を選択')).toBeInTheDocument()
    expect(screen.getByText('新規登録方法を選んでください。')).toBeInTheDocument()
  })

  it('[Phase 8r-4 Q6] 「SNSで登録」と「メールアドレスで登録」の 2 つのボタンを表示する', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'SNSで登録' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'メールアドレスで登録' })).toBeInTheDocument()
  })

  it('[Phase 8r-4 Q6] 「SNSで登録」クリックで onChooseSns が呼ばれる', async () => {
    const onChooseSns = vi.fn()
    const onChooseEmail = vi.fn()
    renderDialog({ onChooseSns, onChooseEmail })

    await userEvent.click(screen.getByRole('button', { name: 'SNSで登録' }))

    expect(onChooseSns).toHaveBeenCalledOnce()
    expect(onChooseEmail).not.toHaveBeenCalled()
  })

  it('「メールアドレスで登録」クリックで onChooseEmail が呼ばれる', async () => {
    const onChooseSns = vi.fn()
    const onChooseEmail = vi.fn()
    renderDialog({ onChooseSns, onChooseEmail })

    await userEvent.click(screen.getByRole('button', { name: 'メールアドレスで登録' }))

    expect(onChooseEmail).toHaveBeenCalledOnce()
    expect(onChooseSns).not.toHaveBeenCalled()
  })

  it('open=false の場合はダイアログ内容が表示されない', () => {
    render(
      <SignUpMethodDialog
        open={false}
        onOpenChange={vi.fn()}
        onChooseSns={vi.fn()}
        onChooseEmail={vi.fn()}
      />
    )
    expect(screen.queryByText('アカウント作成方法を選択')).not.toBeInTheDocument()
  })

  it('閉じる操作で onOpenChange(false) が呼ばれる（shadcn Dialog の標準挙動）', async () => {
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange })
    // Radix の DialogContent にある close (X) ボタンは aria-label="Close"
    const closeBtn = screen.getByRole('button', { name: /close/i })
    await userEvent.click(closeBtn)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  describe('[Phase 8r-4 Q7] OAuth 無効環境でも SNS ボタンは活性', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_OAUTH_ENABLED', 'false')
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('OAuth 無効時でも「SNSで登録」ボタンは disabled にならない（遷移先 OAuthSignUpDialog で disabled になる）', () => {
      renderDialog()
      const snsBtn = screen.getByRole('button', { name: 'SNSで登録' })
      expect(snsBtn).toBeEnabled()
      expect(snsBtn).not.toHaveAttribute('aria-disabled', 'true')
    })

    it('OAuth 無効時でも「SNSで登録」クリックで onChooseSns が呼ばれる', async () => {
      const onChooseSns = vi.fn()
      renderDialog({ onChooseSns })
      await userEvent.click(screen.getByRole('button', { name: 'SNSで登録' }))
      expect(onChooseSns).toHaveBeenCalledOnce()
    })
  })
})
