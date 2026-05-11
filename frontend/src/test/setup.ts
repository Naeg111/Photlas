import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// localStorage のモック（i18n 初期化が localStorage を参照するため先に設定）
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// sessionStorage のモック（useHeadingIndicator が利用）
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
})

// Issue#9: heic2anyのためにWorkerをモック
// @ts-ignore
global.Worker = class Worker {
  constructor() {}
  postMessage() {}
  terminate() {}
}

// Issue#14: matchMediaのモック（embla-carousel用）
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Issue#14: IntersectionObserverのモック（embla-carousel用）
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
} as any

// Issue#14: ResizeObserverのモック（embla-carousel用）
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any

// Issue#9: heic2anyモジュールのデフォルトモック
vi.mock('heic2any', () => ({
  default: vi.fn()
}))

// Issue#93 + Issue#130: テスト環境では i18n を非同期で初期化（動的 import 化に対応）
// 本番では言語ごとに動的ロードだが、テスト環境では多言語表示テスト（韓国語/中国語等）を
// シンプルに保つため、全言語を事前ロードする
const { default: i18n, initI18n, loadLanguageResource, SUPPORTED_LANGUAGES } = await import('../i18n')
await initI18n()
for (const lng of SUPPORTED_LANGUAGES) {
  await loadLanguageResource(lng)
}
await i18n.changeLanguage('ja')

// 各テスト後にDOMクリーンアップを実行
afterEach(() => {
  // React Testing Libraryの標準クリーンアップ
  cleanup()

  // 確実にDOMをクリーンアップ
  document.body.innerHTML = ''
})
