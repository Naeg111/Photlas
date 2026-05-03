import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Map as MapboxMap } from 'mapbox-gl'
import { useMapboxLanguageSync } from './useMapboxLanguageSync'

/**
 * Issue#107: useMapboxLanguageSync フックの単体テスト
 */
describe('useMapboxLanguageSync', () => {
  it('map と mapboxLang が指定されると setLanguage が呼ばれる', () => {
    const setLanguage = vi.fn()
    const map = { setLanguage } as unknown as MapboxMap

    renderHook(() => useMapboxLanguageSync(map, 'ja'))

    expect(setLanguage).toHaveBeenCalledWith('ja')
  })

  it('map が null のときは setLanguage が呼ばれない', () => {
    // null の場合は何もしないこと（map ロード前のレンダリング相当）
    expect(() => {
      renderHook(() => useMapboxLanguageSync(null, 'ja'))
    }).not.toThrow()
  })

  it('mapboxLang が変更されると新しい言語コードで再度 setLanguage が呼ばれる', () => {
    const setLanguage = vi.fn()
    const map = { setLanguage } as unknown as MapboxMap

    const { rerender } = renderHook(
      ({ lang }: { lang: string }) => useMapboxLanguageSync(map, lang),
      { initialProps: { lang: 'ja' } },
    )

    expect(setLanguage).toHaveBeenLastCalledWith('ja')

    rerender({ lang: 'en' })

    expect(setLanguage).toHaveBeenLastCalledWith('en')
    expect(setLanguage).toHaveBeenCalledTimes(2)
  })

  it('mapboxLang が同じ値で再レンダリングされても setLanguage は再実行されない', () => {
    const setLanguage = vi.fn()
    const map = { setLanguage } as unknown as MapboxMap

    const { rerender } = renderHook(
      ({ lang }: { lang: string }) => useMapboxLanguageSync(map, lang),
      { initialProps: { lang: 'ja' } },
    )

    rerender({ lang: 'ja' })

    expect(setLanguage).toHaveBeenCalledTimes(1)
  })
})
