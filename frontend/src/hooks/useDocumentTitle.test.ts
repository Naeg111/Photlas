import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDocumentTitle } from './useDocumentTitle'

describe('useDocumentTitle', () => {
  const originalTitle = document.title

  afterEach(() => {
    document.title = originalTitle
  })

  it('document.titleが設定される', () => {
    renderHook(() => useDocumentTitle('テストページ - Photlas'))

    expect(document.title).toBe('テストページ - Photlas')
  })

  it('アンマウント時にデフォルトタイトルに戻る', () => {
    const { unmount } = renderHook(() => useDocumentTitle('テストページ - Photlas'))

    expect(document.title).toBe('テストページ - Photlas')

    unmount()

    expect(document.title).toBe('Photlas - 写真で撮影スポットを共有・発見')
  })

  it('タイトルが変更されると更新される', () => {
    const { rerender } = renderHook(
      ({ title }) => useDocumentTitle(title),
      { initialProps: { title: '初期タイトル' } }
    )

    expect(document.title).toBe('初期タイトル')

    rerender({ title: '更新タイトル' })

    expect(document.title).toBe('更新タイトル')
  })
})
