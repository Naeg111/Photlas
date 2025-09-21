import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 各テスト後にDOMクリーンアップを実行
afterEach(() => {
  // React Testing Libraryの標準クリーンアップ
  cleanup()
  
  // 確実にDOMをクリーンアップ
  document.body.innerHTML = ''
  
  // グローバル状態をリセット
  if (global.gc) {
    global.gc()
  }
})
