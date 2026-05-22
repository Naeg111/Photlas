import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { toast } from 'sonner'
import { useOAuthLoginToast } from './useOAuthLoginToast'
import { OAUTH_LOGIN_TOAST_FLAG_KEY } from '../config/app'

/**
 * Issue#144: useOAuthLoginToast のユニットテスト。
 * App.tsx 統合テスト（App.test.tsx）でカバーする発火条件を、フック単体で素早く検証する。
 */

// react-i18next の t は受け取ったキーをそのまま返す
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

const LOGIN_SUCCESS_KEY = 'auth.loginSuccess'

describe('useOAuthLoginToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    ;(sessionStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
  })

  function setOAuthFlag(present: boolean) {
    ;(sessionStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
      present && key === OAUTH_LOGIN_TOAST_FLAG_KEY ? '1' : null
    )
  }

  it('既存ユーザー: フラグあり + ダイアログ無し + スプラッシュ解除済み → 発火する', () => {
    setOAuthFlag(true)
    const { result } = renderHook(() =>
      useOAuthLoginToast({ showTermsDialog: false, showUsernameDialog: false, isSplashClosed: true })
    )
    act(() => result.current.beginIfOauthLogin())
    expect(toast).toHaveBeenCalledWith(LOGIN_SUCCESS_KEY)
    // フラグは消費される
    expect(sessionStorage.removeItem).toHaveBeenCalledWith(OAUTH_LOGIN_TOAST_FLAG_KEY)
  })

  it('スプラッシュ表示中は発火せず、解除後に発火する', () => {
    setOAuthFlag(true)
    const { result, rerender } = renderHook(
      ({ splash }: { splash: boolean }) =>
        useOAuthLoginToast({ showTermsDialog: false, showUsernameDialog: false, isSplashClosed: splash }),
      { initialProps: { splash: false } }
    )
    act(() => result.current.beginIfOauthLogin())
    expect(toast).not.toHaveBeenCalledWith(LOGIN_SUCCESS_KEY)

    rerender({ splash: true })
    expect(toast).toHaveBeenCalledWith(LOGIN_SUCCESS_KEY)
  })

  it('ダイアログ表示中は発火せず、全て閉じたら発火する', () => {
    setOAuthFlag(true)
    const { result, rerender } = renderHook(
      ({ username }: { username: boolean }) =>
        useOAuthLoginToast({ showTermsDialog: false, showUsernameDialog: username, isSplashClosed: true }),
      { initialProps: { username: true } }
    )
    act(() => result.current.beginIfOauthLogin())
    expect(toast).not.toHaveBeenCalledWith(LOGIN_SUCCESS_KEY)

    rerender({ username: false })
    expect(toast).toHaveBeenCalledWith(LOGIN_SUCCESS_KEY)
  })

  it('フラグ無し（受動的な起動）では beginIfOauthLogin を呼んでも発火しない', () => {
    setOAuthFlag(false)
    const { result } = renderHook(() =>
      useOAuthLoginToast({ showTermsDialog: false, showUsernameDialog: false, isSplashClosed: true })
    )
    act(() => result.current.beginIfOauthLogin())
    expect(toast).not.toHaveBeenCalledWith(LOGIN_SUCCESS_KEY)
  })

  it('cancelPendingLoginToast でフラグ破棄後は発火しない', () => {
    setOAuthFlag(true)
    const { result } = renderHook(() =>
      useOAuthLoginToast({ showTermsDialog: true, showUsernameDialog: false, isSplashClosed: true })
    )
    act(() => result.current.beginIfOauthLogin())
    act(() => result.current.cancelPendingLoginToast())
    expect(sessionStorage.removeItem).toHaveBeenCalledWith(OAUTH_LOGIN_TOAST_FLAG_KEY)
    expect(toast).not.toHaveBeenCalledWith(LOGIN_SUCCESS_KEY)
  })

  it('発火は1回だけ（保留中に再レンダーされても二重発火しない）', () => {
    setOAuthFlag(true)
    const { result, rerender } = renderHook(
      ({ splash }: { splash: boolean }) =>
        useOAuthLoginToast({ showTermsDialog: false, showUsernameDialog: false, isSplashClosed: splash }),
      { initialProps: { splash: true } }
    )
    act(() => result.current.beginIfOauthLogin())
    rerender({ splash: true })
    rerender({ splash: true })
    const loginCalls = (toast as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === LOGIN_SUCCESS_KEY
    )
    expect(loginCalls).toHaveLength(1)
  })
})
