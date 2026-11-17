import { describe, it, expect, beforeEach, vi } from 'vitest'
import { detectInitialLanguage, loadLanguageResource, SUPPORTED_LANGUAGES } from './index'
import i18n from './index'
import ja from './locales/ja.json'
import en from './locales/en.json'
import ko from './locales/ko.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

/** ネストした翻訳オブジェクトを「a.b.c → 文字列」の平らな形にする */
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') {
      Object.assign(out, flatten(value as Record<string, unknown>, path))
    } else {
      out[path] = String(value)
    }
  }
  return out
}

/** 文言に含まれる差し込み変数（{{name}}）の一覧 */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort()
}

describe('i18n - Issue#130', () => {
  describe('detectInitialLanguage', () => {
    beforeEach(() => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)
    })

    it('localStorage に photlas-language があればそれを返す', () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'photlas-language' ? 'ko' : null
      )
      expect(detectInitialLanguage()).toBe('ko')
    })

    it('localStorage に未サポート言語があれば navigator にフォールバック', () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'photlas-language' ? 'fr' : null
      )
      // jsdom の navigator.language は 'en-US' なので 'en' に解決される
      const detected = detectInitialLanguage()
      expect(SUPPORTED_LANGUAGES).toContain(detected)
    })

    it('localStorage が null でも SUPPORTED_LANGUAGES 内の値を返す', () => {
      const detected = detectInitialLanguage()
      expect(SUPPORTED_LANGUAGES).toContain(detected)
    })
  })

  describe('loadLanguageResource', () => {
    it('既に登録済みの言語はロード処理を発火しない', async () => {
      // setup.ts で全言語が事前ロード済み
      expect(i18n.hasResourceBundle('ja', 'translation')).toBe(true)
      // ja は再度 load しても問題なく resolve する (no-op)
      await expect(loadLanguageResource('ja')).resolves.toBeUndefined()
    })

    it('全 SUPPORTED_LANGUAGES がロード可能', async () => {
      for (const lng of SUPPORTED_LANGUAGES) {
        await loadLanguageResource(lng)
        expect(i18n.hasResourceBundle(lng, 'translation')).toBe(true)
      }
    })
  })

  // Spec#93 追加対応: 言語ファイルごとの項目漏れを防ぐ。
  // 翻訳ファイルは今の言語の分しか読み込まないため、項目が欠けると代わりの英語も出ず、キー名がそのまま表示される。
  describe('翻訳ファイルの項目', () => {
    const jaFlat = flatten(ja)
    const others = { en, ko, 'zh-CN': zhCN, 'zh-TW': zhTW } as const

    it.each(Object.entries(others))('%s は ja と同じ項目をすべて持つ', (_lng, resource) => {
      const flat = flatten(resource as Record<string, unknown>)
      const missing = Object.keys(jaFlat).filter((key) => !(key in flat))
      const extra = Object.keys(flat).filter((key) => !(key in jaFlat))
      expect(missing).toEqual([])
      expect(extra).toEqual([])
    })

    it.each(Object.entries(others))('%s の差し込み変数（{{...}}）は ja と一致する', (_lng, resource) => {
      const flat = flatten(resource as Record<string, unknown>)
      const mismatched = Object.keys(jaFlat).filter(
        (key) => key in flat && placeholders(jaFlat[key]).join() !== placeholders(flat[key]).join()
      )
      expect(mismatched).toEqual([])
    })
  })
})
