import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SnsLinkEditDialog } from './SnsLinkEditDialog'
import {
  PLATFORM_INSTAGRAM,
  PLATFORM_THREADS,
  PLATFORM_TWITTER,
} from '../utils/codeConstants'

/**
 * Issue#102: SNSリンク編集ダイアログのテスト
 * - 固定3行UI（Instagram → Threads → X）
 * - 各行にロゴ表示
 * - サービス別 placeholder
 * - プラットフォーム別 URL バリデーション（onBlur）
 * - バリデーションエラー時に保存ボタン無効化
 */

describe('SnsLinkEditDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    initialLinks: [],
    onSave: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('固定3行UI', () => {
    it('Instagram・Threads・X の3つの URL 入力欄が表示される', () => {
      render(<SnsLinkEditDialog {...defaultProps} />)

      expect(screen.getByTestId('sns-url-input-instagram')).toBeInTheDocument()
      expect(screen.getByTestId('sns-url-input-threads')).toBeInTheDocument()
      expect(screen.getByTestId('sns-url-input-x')).toBeInTheDocument()
    })

    it('セレクトボックス・追加ボタン・削除ボタンが存在しない', () => {
      render(<SnsLinkEditDialog {...defaultProps} />)

      expect(screen.queryByTestId('sns-platform-select-0')).not.toBeInTheDocument()
      expect(screen.queryByTestId('add-sns-link-button')).not.toBeInTheDocument()
      expect(screen.queryByTestId('delete-sns-link-0')).not.toBeInTheDocument()
    })

    it('各行の前にロゴが表示される', () => {
      render(<SnsLinkEditDialog {...defaultProps} />)

      expect(screen.getByTestId('sns-logo-instagram')).toBeInTheDocument()
      expect(screen.getByTestId('sns-logo-threads')).toBeInTheDocument()
      expect(screen.getByTestId('sns-logo-x')).toBeInTheDocument()
    })

    it('各入力欄にサービス別のplaceholderが表示される', () => {
      render(<SnsLinkEditDialog {...defaultProps} />)

      expect(screen.getByTestId('sns-url-input-instagram')).toHaveAttribute(
        'placeholder',
        'https://www.instagram.com/username'
      )
      expect(screen.getByTestId('sns-url-input-threads')).toHaveAttribute(
        'placeholder',
        'https://www.threads.com/@username'
      )
      expect(screen.getByTestId('sns-url-input-x')).toHaveAttribute(
        'placeholder',
        'https://x.com/username'
      )
    })
  })

  describe('initialLinks の反映', () => {
    it('initialLinks の URL が対応するサービスの入力欄にセットされる', () => {
      const initialLinks = [
        { platform: PLATFORM_INSTAGRAM, url: 'https://www.instagram.com/me' },
        { platform: PLATFORM_THREADS, url: 'https://www.threads.com/@me' },
        { platform: PLATFORM_TWITTER, url: 'https://x.com/me' },
      ]
      render(<SnsLinkEditDialog {...defaultProps} initialLinks={initialLinks} />)

      expect(screen.getByTestId('sns-url-input-instagram')).toHaveValue(
        'https://www.instagram.com/me'
      )
      expect(screen.getByTestId('sns-url-input-threads')).toHaveValue(
        'https://www.threads.com/@me'
      )
      expect(screen.getByTestId('sns-url-input-x')).toHaveValue('https://x.com/me')
    })

    it('initialLinks に platform が含まれない場合は対応欄が空になる', () => {
      render(<SnsLinkEditDialog {...defaultProps} initialLinks={[]} />)

      expect(screen.getByTestId('sns-url-input-instagram')).toHaveValue('')
      expect(screen.getByTestId('sns-url-input-threads')).toHaveValue('')
      expect(screen.getByTestId('sns-url-input-x')).toHaveValue('')
    })
  })

  describe('保存', () => {
    it('全て空欄で保存した場合、空配列で onSave が呼ばれる', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(<SnsLinkEditDialog {...defaultProps} onSave={onSave} />)

      await user.click(screen.getByRole('button', { name: '保存' }))

      expect(onSave).toHaveBeenCalledWith([])
    })

    it('入力されたURLのみが onSave に渡される（platform 付き）', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(<SnsLinkEditDialog {...defaultProps} onSave={onSave} />)

      await user.type(
        screen.getByTestId('sns-url-input-threads'),
        'https://www.threads.com/@me'
      )

      await user.click(screen.getByRole('button', { name: '保存' }))

      expect(onSave).toHaveBeenCalledWith([
        { platform: PLATFORM_THREADS, url: 'https://www.threads.com/@me' },
      ])
    })
  })

  describe('プラットフォーム別 URL バリデーション (onBlur)', () => {
    it('Instagram の入力欄に X の URL を入力し、フォーカスを外すとエラーが表示される', async () => {
      const user = userEvent.setup()
      render(<SnsLinkEditDialog {...defaultProps} />)

      const input = screen.getByTestId('sns-url-input-instagram')
      await user.type(input, 'https://x.com/user')
      await user.tab()

      await waitFor(() => {
        expect(
          screen.getByTestId('sns-url-error-instagram')
        ).toBeInTheDocument()
      })
    })

    it('Threads の入力欄に正しい threads.com の URL を入力するとエラーが表示されない', async () => {
      const user = userEvent.setup()
      render(<SnsLinkEditDialog {...defaultProps} />)

      const input = screen.getByTestId('sns-url-input-threads')
      await user.type(input, 'https://www.threads.com/@me')
      await user.tab()

      expect(
        screen.queryByTestId('sns-url-error-threads')
      ).not.toBeInTheDocument()
    })

    it('Threads の入力欄に旧ドメイン threads.net の URL もエラーにならない', async () => {
      const user = userEvent.setup()
      render(<SnsLinkEditDialog {...defaultProps} />)

      const input = screen.getByTestId('sns-url-input-threads')
      await user.type(input, 'https://www.threads.net/@me')
      await user.tab()

      expect(
        screen.queryByTestId('sns-url-error-threads')
      ).not.toBeInTheDocument()
    })

    it('X の入力欄に twitter.com の URL を入れてもエラーにならない', async () => {
      const user = userEvent.setup()
      render(<SnsLinkEditDialog {...defaultProps} />)

      const input = screen.getByTestId('sns-url-input-x')
      await user.type(input, 'https://twitter.com/me')
      await user.tab()

      expect(screen.queryByTestId('sns-url-error-x')).not.toBeInTheDocument()
    })

    it('不正な URL 形式（https:// で始まらない）を入力するとエラーが表示される', async () => {
      const user = userEvent.setup()
      render(<SnsLinkEditDialog {...defaultProps} />)

      const input = screen.getByTestId('sns-url-input-x')
      await user.type(input, 'not-a-valid-url')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByTestId('sns-url-error-x')).toBeInTheDocument()
      })
    })

    it('空欄の場合はバリデーションエラーが表示されない', async () => {
      const user = userEvent.setup()
      render(<SnsLinkEditDialog {...defaultProps} />)

      const input = screen.getByTestId('sns-url-input-instagram')
      await user.click(input)
      await user.tab()

      expect(
        screen.queryByTestId('sns-url-error-instagram')
      ).not.toBeInTheDocument()
    })
  })

  describe('保存ボタン無効化', () => {
    it('バリデーションエラーがある状態では保存ボタンが無効化される', async () => {
      const user = userEvent.setup()
      render(<SnsLinkEditDialog {...defaultProps} />)

      const input = screen.getByTestId('sns-url-input-instagram')
      await user.type(input, 'https://x.com/user')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
      })
    })

    it('全て正しい入力なら保存ボタンが有効', async () => {
      const user = userEvent.setup()
      render(<SnsLinkEditDialog {...defaultProps} />)

      await user.type(
        screen.getByTestId('sns-url-input-instagram'),
        'https://www.instagram.com/me'
      )
      await user.tab()

      expect(screen.getByRole('button', { name: '保存' })).toBeEnabled()
    })
  })
})
