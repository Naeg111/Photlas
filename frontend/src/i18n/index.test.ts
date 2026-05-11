import { describe, it, expect, beforeEach, vi } from 'vitest'
import { detectInitialLanguage, loadLanguageResource, SUPPORTED_LANGUAGES } from './index'
import i18n from './index'

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
})
