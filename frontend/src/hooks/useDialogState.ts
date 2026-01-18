import { useState, useCallback, useMemo } from 'react'

/**
 * ダイアログ名の型定義
 * Issue#28: App.tsx再構築 - Refactor段階
 */
export type DialogName =
  | 'filterPanel'
  | 'topMenu'
  | 'loginRequired'
  | 'login'
  | 'signUp'
  | 'terms'
  | 'privacy'
  | 'passwordReset'
  | 'photoContribution'
  | 'accountSettings'
  | 'profile'
  | 'photoDetail'
  | 'lightbox'

/**
 * ダイアログの開閉状態
 */
export type DialogState = Record<DialogName, boolean>

/**
 * ダイアログ状態管理フックの戻り値
 */
export interface UseDialogStateReturn {
  /** 各ダイアログの開閉状態 */
  state: DialogState
  /** 指定したダイアログを開く */
  open: (name: DialogName) => void
  /** 指定したダイアログを閉じる */
  close: (name: DialogName) => void
  /** 指定したダイアログの開閉状態を切り替える */
  toggle: (name: DialogName) => void
  /** 指定したダイアログのopen/onOpenChange用のプロパティを取得 */
  getProps: (name: DialogName) => {
    open: boolean
    onOpenChange: (open: boolean) => void
  }
  /** 指定したダイアログが開いているか */
  isOpen: (name: DialogName) => boolean
}

/**
 * ダイアログの初期状態
 */
const INITIAL_STATE: DialogState = {
  filterPanel: false,
  topMenu: false,
  loginRequired: false,
  login: false,
  signUp: false,
  terms: false,
  privacy: false,
  passwordReset: false,
  photoContribution: false,
  accountSettings: false,
  profile: false,
  photoDetail: false,
  lightbox: false,
}

/**
 * ダイアログ状態管理カスタムフック
 *
 * 複数のダイアログの開閉状態を一元管理する
 *
 * @example
 * ```tsx
 * const dialog = useDialogState()
 *
 * // ダイアログを開く
 * dialog.open('login')
 *
 * // プロパティを取得してコンポーネントに渡す
 * <LoginDialog {...dialog.getProps('login')} />
 *
 * // 開閉状態を確認
 * if (dialog.isOpen('login')) { ... }
 * ```
 */
export function useDialogState(): UseDialogStateReturn {
  const [state, setState] = useState<DialogState>(INITIAL_STATE)

  const open = useCallback((name: DialogName) => {
    setState(prev => ({ ...prev, [name]: true }))
  }, [])

  const close = useCallback((name: DialogName) => {
    setState(prev => ({ ...prev, [name]: false }))
  }, [])

  const toggle = useCallback((name: DialogName) => {
    setState(prev => ({ ...prev, [name]: !prev[name] }))
  }, [])

  const isOpen = useCallback((name: DialogName) => state[name], [state])

  const getProps = useCallback(
    (name: DialogName) => ({
      open: state[name],
      onOpenChange: (open: boolean) => {
        setState(prev => ({ ...prev, [name]: open }))
      },
    }),
    [state]
  )

  return useMemo(
    () => ({
      state,
      open,
      close,
      toggle,
      getProps,
      isOpen,
    }),
    [state, open, close, toggle, getProps, isOpen]
  )
}
