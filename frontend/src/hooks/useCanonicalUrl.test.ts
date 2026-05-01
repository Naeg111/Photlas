/**
 * useCanonicalUrl フックのテスト
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useCanonicalUrl } from './useCanonicalUrl'

describe('useCanonicalUrl', () => {
  beforeEach(() => {
    // 既存の canonical link を削除してクリーンな状態にする
    document.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove())
  })

  it('指定したパスの canonical URL を <link rel="canonical"> として head に追加する', () => {
    renderHook(() => useCanonicalUrl('/about'))

    const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    expect(link).not.toBeNull()
    expect(link?.href).toBe(`${window.location.origin}/about`)
  })

  it('path 省略時は現在の location.pathname を使用する', () => {
    // jsdom のデフォルト pathname は "/"
    renderHook(() => useCanonicalUrl())

    const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    expect(link).not.toBeNull()
    expect(link?.href).toBe(`${window.location.origin}/`)
  })

  it('アンマウント時に自身が作成した <link> を削除する', () => {
    const { unmount } = renderHook(() => useCanonicalUrl('/terms-of-service'))

    expect(document.querySelector('link[rel="canonical"]')).not.toBeNull()

    unmount()

    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
  })

  it('既存の <link rel="canonical"> がある場合、それを上書きする（削除はしない）', () => {
    // 事前に手動で <link> を作成（例: index.html に静的に書かれているケース）
    const existing = document.createElement('link')
    existing.rel = 'canonical'
    existing.href = 'https://example.com/initial'
    document.head.appendChild(existing)

    const { unmount } = renderHook(() => useCanonicalUrl('/about'))

    const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    expect(link?.href).toBe(`${window.location.origin}/about`)

    unmount()

    // アンマウント後も既存のものは残る
    const afterUnmount = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    expect(afterUnmount).not.toBeNull()
  })

  it('path が変わると canonical URL も更新される', () => {
    const { rerender } = renderHook(({ path }: { path: string }) => useCanonicalUrl(path), {
      initialProps: { path: '/about' },
    })

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    expect(link?.href).toBe(`${window.location.origin}/about`)

    rerender({ path: '/privacy-policy' })

    link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    expect(link?.href).toBe(`${window.location.origin}/privacy-policy`)
  })

  afterEach(() => {
    cleanup()
    document.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove())
  })
})
