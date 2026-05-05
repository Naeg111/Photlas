/**
 * Issue#118: useRegistrationWall フックのテスト
 *
 * 注意: テスト全体の setup（src/test/setup.ts）で localStorage を vi.fn() でモック化しているため、
 *       本テスト内では Map ベースの実用的なストア実装で localStorage を上書きする。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRegistrationWall } from './useRegistrationWall'

describe('useRegistrationWall - Issue#118', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map()
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
      },
      configurable: true,
      writable: true,
    })
    Object.defineProperty(global, 'sessionStorage', {
      value: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
      configurable: true,
      writable: true,
    })
  })

  it('Issue#118 - 初期 isShown は localStorage の状態に基づいて同期決定される', () => {
    store.set('photlas_viewed_photo_ids', JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))

    const { result } = renderHook(() => useRegistrationWall(false))
    // useState 初期値の遅延評価により、初回レンダリングで true となる
    expect(result.current.isShown).toBe(true)
  })

  it('Issue#118 - ログイン中は閲覧10件以上でも isShown=false', () => {
    store.set('photlas_viewed_photo_ids', JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))

    const { result } = renderHook(() => useRegistrationWall(true))
    expect(result.current.isShown).toBe(false)
  })

  it('Issue#118 - recordPhotoView で閲覧履歴に加算され、10件で isShown=true に変化する', () => {
    const { result } = renderHook(() => useRegistrationWall(false))
    expect(result.current.isShown).toBe(false)

    act(() => {
      for (let i = 1; i <= 10; i++) {
        result.current.recordPhotoView(i)
      }
    })

    expect(result.current.isShown).toBe(true)
  })

  it('Issue#118 - ログイン中は recordPhotoView 呼び出しでも localStorage に書き込まない', () => {
    const { result } = renderHook(() => useRegistrationWall(true))

    act(() => {
      result.current.recordPhotoView(101)
    })

    // 書き込みが行われていないこと（store にキーがない）
    expect(store.has('photlas_viewed_photo_ids')).toBe(false)
  })

  it('Issue#118 - 認証状態が false→true に変わると isShown=false に再計算される', () => {
    store.set('photlas_viewed_photo_ids', JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))

    const { result, rerender } = renderHook(
      ({ isAuthenticated }: { isAuthenticated: boolean }) => useRegistrationWall(isAuthenticated),
      { initialProps: { isAuthenticated: false } },
    )
    expect(result.current.isShown).toBe(true)

    rerender({ isAuthenticated: true })
    expect(result.current.isShown).toBe(false)
  })
})
