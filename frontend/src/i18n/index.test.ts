import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { applyAccountLanguage, detectInitialLanguage, loadLanguageResource, SUPPORTED_LANGUAGES } from './index'
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
  // Spec#93 2.7: 非ログイン時のブラウザ言語検出
  describe('detectInitialLanguage', () => {
    /** navigator.language を差し替える */
    function setBrowserLanguage(tag: string) {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue(tag)
    }

    beforeEach(() => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it.each([
      ['ja', 'ja'],
      ['ja-JP', 'ja'],
      ['en-US', 'en'],
      ['en-GB', 'en'],
      ['ko', 'ko'],
      ['ko-KR', 'ko'],
      ['zh-CN', 'zh-CN'],
      ['zh', 'zh-CN'],
      ['zh-SG', 'zh-CN'],
      ['zh-Hans-CN', 'zh-CN'],
      ['zh-Hans-HK', 'zh-CN'],
      ['zh-TW', 'zh-TW'],
      ['zh-HK', 'zh-TW'],
      ['zh-MO', 'zh-TW'],
      ['zh-Hant', 'zh-TW'],
      ['zh-Hant-TW', 'zh-TW'],
      ['zh-tw', 'zh-TW'],
      ['fr', 'en'],
      ['fr-FR', 'en'],
      ['de-DE', 'en'],
      ['th', 'en'],
    ])('ブラウザの言語が %s なら %s で表示する', (browserLanguage, expected) => {
      setBrowserLanguage(browserLanguage)
      expect(detectInitialLanguage()).toBe(expected)
    })

    it('localStorage に photlas-language があればブラウザの言語より優先する', () => {
      setBrowserLanguage('ja-JP')
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'photlas-language' ? 'zh-TW' : null
      )
      expect(detectInitialLanguage()).toBe('zh-TW')
    })

    it('localStorage に未対応の言語があればブラウザの言語で判定する', () => {
      setBrowserLanguage('ko-KR')
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'photlas-language' ? 'fr' : null
      )
      expect(detectInitialLanguage()).toBe('ko')
    })
  })

  // Spec#93 2.2: ログイン後は DB の言語設定で localStorage と表示言語を上書きする
  describe('applyAccountLanguage', () => {
    beforeEach(() => {
      vi.mocked(localStorage.setItem).mockClear()
    })

    it('対応言語なら localStorage に保存し、表示言語を切り替える', async () => {
      try {
        await applyAccountLanguage('ko')
        expect(localStorage.setItem).toHaveBeenCalledWith('photlas-language', 'ko')
        expect(i18n.language).toBe('ko')
      } finally {
        await i18n.changeLanguage('ja')
      }
    })

    it.each([undefined, null, '', 'fr'])('%s のときは何もしない', async (language) => {
      await applyAccountLanguage(language)
      expect(localStorage.setItem).not.toHaveBeenCalled()
      expect(i18n.language).toBe('ja')
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

  // Spec#93 追加対応: 読み上げソフトやブラウザの翻訳が表示言語を正しく扱えるよう、<html lang> を合わせる
  describe('<html> の lang', () => {
    it('表示言語を切り替えると、<html> の lang も同じ言語になる', async () => {
      try {
        for (const lng of SUPPORTED_LANGUAGES) {
          await i18n.changeLanguage(lng)
          expect(document.documentElement.lang).toBe(lng)
        }
      } finally {
        await i18n.changeLanguage('ja')
      }
      expect(document.documentElement.lang).toBe('ja')
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
