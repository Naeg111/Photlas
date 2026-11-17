import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

export const SUPPORTED_LANGUAGES = ['ja', 'en', 'ko', 'zh-CN', 'zh-TW'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const FALLBACK_LANGUAGE: SupportedLanguage = 'en'

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

/**
 * Issue#130: 5 言語分の翻訳 JSON (≈137KB) を全部同期 import すると initial bundle が肥大化するため、
 * Vite ネイティブの import.meta.glob で動的 import に切り替えた。
 * 起動時は検出言語 1 つだけロードし、言語切替時に追加ロードする。
 */
const localeLoaders = import.meta.glob<{ default: Record<string, unknown> }>(
  './locales/*.json'
)

function pathFor(lng: SupportedLanguage): string {
  return `./locales/${lng}.json`
}

/**
 * 指定言語のリソースを動的に読み込み、i18n に登録する。
 * 既に登録済みの言語は再ロードしない。
 */
export async function loadLanguageResource(lng: SupportedLanguage): Promise<void> {
  if (i18n.hasResourceBundle(lng, 'translation')) return
  const loader = localeLoaders[pathFor(lng)]
  if (!loader) return
  const mod = await loader()
  i18n.addResourceBundle(lng, 'translation', mod.default, true, true)
}

/** 手動で選んだ言語（ログイン後は DB の言語）を保存する localStorage のキー */
const LANGUAGE_STORAGE_KEY = 'photlas-language'

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

/**
 * localStorage / navigator.language から初期言語を決定する。
 * SUPPORTED_LANGUAGES に含まれない場合は FALLBACK_LANGUAGE を返す。
 */
export function detectInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return FALLBACK_LANGUAGE
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (isSupportedLanguage(stored)) {
    return stored
  }
  const navLang = navigator.language
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(navLang)) {
    return navLang as SupportedLanguage
  }
  const base = navLang.split('-')[0]
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(base)) {
    return base as SupportedLanguage
  }
  return FALLBACK_LANGUAGE
}

/**
 * Spec#93: ログイン後、アカウント（DB）の言語設定で表示言語と localStorage を上書きする。
 * 対応 5 言語以外（未設定を含む）は何もしない。
 */
export async function applyAccountLanguage(language: string | null | undefined): Promise<void> {
  if (!isSupportedLanguage(language)) return
  // 先に保存しておけば、直後に画面を読み直しても（PWA の OAuth 等）この言語で起動する
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  try {
    // Issue#130: 言語リソースは動的 import なので、changeLanguage 前にロードする
    await loadLanguageResource(language)
    await i18n.changeLanguage(language)
  } catch {
    // 読み込みに失敗しても localStorage には保存済みなので、次回起動時に反映される
  }
}

/**
 * i18n を初期化する。リソースは空で init し、初期言語のリソースを動的ロードする。
 * main.tsx から起動時に 1 回だけ呼ぶ。
 */
export async function initI18n(): Promise<void> {
  const initialLng = detectInitialLanguage()

  // init() を先に呼ばないと hasResourceBundle / addResourceBundle が使えない
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {},
      lng: initialLng,
      fallbackLng: FALLBACK_LANGUAGE,
      supportedLngs: [...SUPPORTED_LANGUAGES],
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: ['localStorage'],
      },
      interpolation: {
        escapeValue: false,
      },
    })

  // init 完了後に動的ロード
  await loadLanguageResource(initialLng)
}

export default i18n
