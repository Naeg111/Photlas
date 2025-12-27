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
