import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// localStorage のモック
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

// @ts-ignore
global.localStorage = localStorageMock

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

// 各テスト後にDOMクリーンアップを実行
afterEach(() => {
  // React Testing Libraryの標準クリーンアップ
  cleanup()

  // 確実にDOMをクリーンアップ
  document.body.innerHTML = ''
})
