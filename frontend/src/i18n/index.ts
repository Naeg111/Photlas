import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ja from './locales/ja.json'
import en from './locales/en.json'
import ko from './locales/ko.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

export const SUPPORTED_LANGUAGES = ['ja', 'en', 'ko', 'zh-CN', 'zh-TW'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  ja: '日',
  en: 'EN',
  ko: '한',
  'zh-CN': '简',
  'zh-TW': '繁',
}

/** Mapbox language code mapping */
export const MAPBOX_LANGUAGE_MAP: Record<SupportedLanguage, string> = {
  ja: 'ja',
  en: 'en',
  ko: 'ko',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ja: { translation: ja },
      en: { translation: en },
      ko: { translation: ko },
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhTW },
    },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'photlas-language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
