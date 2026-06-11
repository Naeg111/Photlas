/**
 * useRobotsNoindex フックのテスト (Issue#143)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useRobotsNoindex } from './useRobotsNoindex'

function robotsMeta(): HTMLMetaElement | null {
  return document.querySelector<HTMLMetaElement>('meta[name="robots"]')
}

describe('useRobotsNoindex', () => {
  beforeEach(() => {
    document.querySelectorAll('meta[name="robots"]').forEach((el) => el.remove())
  })

  it('<meta name="robots" content="noindex, follow"> を head に 1 つ追加する', () => {
    renderHook(() => useRobotsNoindex())

    expect(document.querySelectorAll('meta[name="robots"]')).toHaveLength(1)
    expect(robotsMeta()?.content).toBe('noindex, follow')
  })

  it('アンマウント時に自身が作成した meta を削除する', () => {
    const { unmount } = renderHook(() => useRobotsNoindex())
    expect(robotsMeta()).not.toBeNull()

    unmount()

    expect(robotsMeta()).toBeNull()
  })

  it('二重生成しない（既に robots meta がある状態で呼んでも 1 つのまま）', () => {
    renderHook(() => useRobotsNoindex())
    renderHook(() => useRobotsNoindex())

    expect(document.querySelectorAll('meta[name="robots"]')).toHaveLength(1)
  })

  it('既存の robots meta（staging の静的注入を想定）は値を上書きし、アンマウントで元の値に戻す（削除しない）', () => {
    const existing = document.createElement('meta')
    existing.name = 'robots'
    existing.content = 'noindex' // staging の build 時静的注入を模す
    document.head.appendChild(existing)

    const { unmount } = renderHook(() => useRobotsNoindex())
    expect(robotsMeta()?.content).toBe('noindex, follow')

    unmount()

    expect(robotsMeta()).not.toBeNull()
    expect(robotsMeta()?.content).toBe('noindex') // 既存値へ復元
  })

  it('content 引数で値を指定できる', () => {
    renderHook(() => useRobotsNoindex('noindex'))
    expect(robotsMeta()?.content).toBe('noindex')
  })

  afterEach(() => {
    cleanup()
    document.querySelectorAll('meta[name="robots"]').forEach((el) => el.remove())
  })
})
