import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDialogState } from './useDialogState'

describe('useDialogState', () => {
  it('全てのダイアログが閉じた状態で初期化される', () => {
    const { result } = renderHook(() => useDialogState())

    const state = result.current.state
    const allClosed = Object.values(state).every(value => value === false)
    expect(allClosed).toBe(true)
  })

  it('open()で指定したダイアログがtrueになる', () => {
    const { result } = renderHook(() => useDialogState())

    act(() => {
      result.current.open('login')
    })

    expect(result.current.state.login).toBe(true)
  })

  it('close()で指定したダイアログがfalseになる', () => {
    const { result } = renderHook(() => useDialogState())

    act(() => {
      result.current.open('login')
    })
    expect(result.current.state.login).toBe(true)

    act(() => {
      result.current.close('login')
    })
    expect(result.current.state.login).toBe(false)
  })

  it('toggle()で開閉状態が反転する', () => {
    const { result } = renderHook(() => useDialogState())

    expect(result.current.state.signUp).toBe(false)

    act(() => {
      result.current.toggle('signUp')
    })
    expect(result.current.state.signUp).toBe(true)

    act(() => {
      result.current.toggle('signUp')
    })
    expect(result.current.state.signUp).toBe(false)
  })

  it('isOpen()が正しい開閉状態を返す', () => {
    const { result } = renderHook(() => useDialogState())

    expect(result.current.isOpen('profile')).toBe(false)

    act(() => {
      result.current.open('profile')
    })
    expect(result.current.isOpen('profile')).toBe(true)
  })

  it('getProps()がopen/onOpenChangeプロパティを返す', () => {
    const { result } = renderHook(() => useDialogState())

    const props = result.current.getProps('about')
    expect(props).toHaveProperty('open')
    expect(props).toHaveProperty('onOpenChange')
    expect(props.open).toBe(false)
    expect(typeof props.onOpenChange).toBe('function')
  })

  it('getProps().onOpenChange(true)でダイアログが開く', () => {
    const { result } = renderHook(() => useDialogState())

    act(() => {
      result.current.getProps('about').onOpenChange(true)
    })
    expect(result.current.state.about).toBe(true)

    act(() => {
      result.current.getProps('about').onOpenChange(false)
    })
    expect(result.current.state.about).toBe(false)
  })

  it('あるダイアログを開いても他のダイアログに影響しない', () => {
    const { result } = renderHook(() => useDialogState())

    act(() => {
      result.current.open('login')
    })

    expect(result.current.state.login).toBe(true)
    expect(result.current.state.signUp).toBe(false)
    expect(result.current.state.profile).toBe(false)
    expect(result.current.state.about).toBe(false)
  })

  it('複数のダイアログを同時に開くことができる', () => {
    const { result } = renderHook(() => useDialogState())

    act(() => {
      result.current.open('login')
      result.current.open('terms')
      result.current.open('privacy')
    })

    expect(result.current.state.login).toBe(true)
    expect(result.current.state.terms).toBe(true)
    expect(result.current.state.privacy).toBe(true)
  })

  it('toggle()を連続で呼び出すと状態が正しく切り替わる', () => {
    const { result } = renderHook(() => useDialogState())

    act(() => {
      result.current.toggle('filterPanel')
    })
    expect(result.current.state.filterPanel).toBe(true)

    act(() => {
      result.current.toggle('filterPanel')
    })
    expect(result.current.state.filterPanel).toBe(false)

    act(() => {
      result.current.toggle('filterPanel')
    })
    expect(result.current.state.filterPanel).toBe(true)
  })
})
