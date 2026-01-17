import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginRequiredDialog } from './LoginRequiredDialog'

/**
 * LoginRequiredDialog コンポーネントのテスト
 * Issue#27: パネル・ダイアログ群の移行
 *
 * 未ログイン時に投稿ボタンを押したときに表示されるダイアログ
 */

describe('LoginRequiredDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onShowLogin: vi.fn(),
    onShowSignUp: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UI Elements - UI要素', () => {
    it('renders dialog when open prop is true', () => {
      render(<LoginRequiredDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not render dialog when open prop is false', () => {
      render(<LoginRequiredDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders dialog title', () => {
      render(<LoginRequiredDialog {...defaultProps} />)

      expect(screen.getByRole('heading', { name: 'ログインが必要です' })).toBeInTheDocument()
    })

    it('renders dialog description', () => {
      render(<LoginRequiredDialog {...defaultProps} />)

      expect(screen.getByText('この機能を利用するには、ログインまたはアカウント作成が必要です。')).toBeInTheDocument()
    })

    it('renders login button', () => {
      render(<LoginRequiredDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /ログイン/ })).toBeInTheDocument()
    })

    it('renders sign up button', () => {
      render(<LoginRequiredDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /新規アカウント作成/ })).toBeInTheDocument()
    })
  })

  describe('User Interactions - ユーザー操作', () => {
    it('calls onShowLogin and closes dialog when login button is clicked', async () => {
      const user = userEvent.setup()
      render(<LoginRequiredDialog {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /ログイン/ }))

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
      expect(defaultProps.onShowLogin).toHaveBeenCalled()
    })

    it('calls onShowSignUp and closes dialog when sign up button is clicked', async () => {
      const user = userEvent.setup()
      render(<LoginRequiredDialog {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /新規アカウント作成/ }))

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
      expect(defaultProps.onShowSignUp).toHaveBeenCalled()
    })
  })
})
