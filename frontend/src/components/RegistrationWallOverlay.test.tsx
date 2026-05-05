/**
 * Issue#118: RegistrationWallOverlay コンポーネントのテスト
 *
 * shadcn/ui の Dialog ではなく独自のオーバーレイ実装。理由:
 *   - Esc キー・背景クリックで閉じない（必須要件）
 *   - z-index を独立に管理する（壁: 70 / 通常 Dialog: 50）
 *   - 「閉じるボタン無し」を強制する
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RegistrationWallOverlay } from './RegistrationWallOverlay'

describe('RegistrationWallOverlay - Issue#118', () => {
  let mockGtag: ReturnType<typeof vi.fn>
  const noop = () => {}

  beforeEach(() => {
    mockGtag = vi.fn()
    vi.stubGlobal('gtag', mockGtag)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('表示制御', () => {
    it('Issue#118 - isOpen=false なら何も描画しない', () => {
      render(
        <RegistrationWallOverlay
          isOpen={false}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('Issue#118 - isOpen=true なら role="dialog" aria-modal="true" で描画する', () => {
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })
  })

  describe('文言表示（i18n: ja）', () => {
    beforeEach(() => {
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
    })

    it('Issue#118 - タイトルが表示される', () => {
      expect(
        screen.getByText('Photlas を続けてご利用いただくには、ログインが必要です'),
      ).toBeInTheDocument()
    })

    it('Issue#118 - 感謝の文言が表示される', () => {
      expect(screen.getByText('ご覧いただきありがとうございます。')).toBeInTheDocument()
    })

    it('Issue#118 - 説明文が表示される', () => {
      expect(
        screen.getByText(
          'アカウントを作成すると、お気に入りの写真を保存したり、自分の写真を投稿してコミュニティに参加できます。',
        ),
      ).toBeInTheDocument()
    })

    it('Issue#118 - 「アカウント作成」ボタンが表示される', () => {
      expect(screen.getByRole('button', { name: 'アカウント作成' })).toBeInTheDocument()
    })

    it('Issue#118 - 「ログイン」ボタンが表示される', () => {
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    })

    it('Issue#118 - 「Photlasとは？」リンクが表示される', () => {
      expect(screen.getByRole('button', { name: 'Photlasとは？' })).toBeInTheDocument()
    })
  })

  describe('ボタン操作', () => {
    it('Issue#118 - 「アカウント作成」クリックで onClickSignUp が呼ばれる', async () => {
      const onClickSignUp = vi.fn()
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={onClickSignUp}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: 'アカウント作成' }))
      expect(onClickSignUp).toHaveBeenCalledTimes(1)
    })

    it('Issue#118 - 「ログイン」クリックで onClickLogin が呼ばれる', async () => {
      const onClickLogin = vi.fn()
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={noop}
          onClickLogin={onClickLogin}
          onClickAbout={noop}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))
      expect(onClickLogin).toHaveBeenCalledTimes(1)
    })

    it('Issue#118 - 「Photlasとは？」クリックで onClickAbout が呼ばれる', async () => {
      const onClickAbout = vi.fn()
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={onClickAbout}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: 'Photlasとは？' }))
      expect(onClickAbout).toHaveBeenCalledTimes(1)
    })
  })

  describe('GA4 イベント送信', () => {
    it('Issue#118 - isOpen=true で初回マウント時に registration_wall_shown が送信される', () => {
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
      expect(mockGtag).toHaveBeenCalledWith('event', 'registration_wall_shown')
    })

    it('Issue#118 - isOpen=false なら registration_wall_shown は送信されない', () => {
      render(
        <RegistrationWallOverlay
          isOpen={false}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
      expect(mockGtag).not.toHaveBeenCalled()
    })

    it('Issue#118 - 「アカウント作成」クリックで registration_wall_signup_click が送信される', async () => {
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: 'アカウント作成' }))
      expect(mockGtag).toHaveBeenCalledWith('event', 'registration_wall_signup_click')
    })

    it('Issue#118 - 「ログイン」クリックで registration_wall_login_click が送信される', async () => {
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))
      expect(mockGtag).toHaveBeenCalledWith('event', 'registration_wall_login_click')
    })

    it('Issue#118 - 「Photlasとは？」クリックで registration_wall_about_click が送信される', async () => {
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: 'Photlasとは？' }))
      expect(mockGtag).toHaveBeenCalledWith('event', 'registration_wall_about_click')
    })
  })

  describe('z-index・閉じない挙動', () => {
    it('Issue#118 - オーバーレイは z-[70] クラスを持つ（Cookie バナー60 / Dialog 50 より上）', () => {
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toContain('z-[70]')
    })

    it('Issue#118 - 閉じるボタンが存在しない（登録/ログインが必須）', () => {
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
      expect(screen.queryByRole('button', { name: /close|閉じる/i })).not.toBeInTheDocument()
    })

    it('Issue#118 - Esc キーを押下しても何も起こらない（onOpenChange 等を呼ばない）', async () => {
      const onClickSignUp = vi.fn()
      const onClickLogin = vi.fn()
      const onClickAbout = vi.fn()
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={onClickSignUp}
          onClickLogin={onClickLogin}
          onClickAbout={onClickAbout}
        />,
      )
      await userEvent.keyboard('{Escape}')
      expect(onClickSignUp).not.toHaveBeenCalled()
      expect(onClickLogin).not.toHaveBeenCalled()
      expect(onClickAbout).not.toHaveBeenCalled()
    })
  })

  describe('アクセシビリティ', () => {
    it('Issue#118 - 「アカウント作成」ボタンに自動フォーカスされる', () => {
      render(
        <RegistrationWallOverlay
          isOpen={true}
          onClickSignUp={noop}
          onClickLogin={noop}
          onClickAbout={noop}
        />,
      )
      const signUpButton = screen.getByRole('button', { name: 'アカウント作成' })
      expect(signUpButton).toHaveFocus()
    })
  })
})
