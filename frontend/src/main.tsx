import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initSentry } from './config/sentry'
import { ErrorBoundary } from './components/ErrorBoundary'
import './i18n'
import './index.css'
import App from './App.tsx'

initSentry()

// Issue#70: PWA対応 - Service Worker登録（ページ読み込み完了後に登録）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}

let currentRoot: Root | null = null

function mountReactApp(targetEl: HTMLElement): void {
  currentRoot = createRoot(targetEl)
  currentRoot.render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  )
}

mountReactApp(document.getElementById('root')!)

/**
 * 案Q: iOS PWA OAuth 戻り後の viewport 不整合への対処試行。
 * React ツリー全体を unmount → 新しい #root 要素に作り替えて再 mount する。
 * これにより iOS WebKit にレイアウトの完全再評価を促す狙い。
 *
 * 通常時には呼ばれない。OAuthCallbackPage が PWA standalone モードで OAuth 完了後に
 * dispatchEvent('photlas-remount') を投げると発動する。
 */
window.addEventListener('photlas-remount', () => {
  if (!currentRoot) return
  currentRoot.unmount()
  currentRoot = null

  const oldEl = document.getElementById('root')
  const parent = oldEl?.parentNode
  if (!oldEl || !parent) return

  const newEl = document.createElement('div')
  newEl.id = 'root'
  parent.replaceChild(newEl, oldEl)

  mountReactApp(newEl)
})
