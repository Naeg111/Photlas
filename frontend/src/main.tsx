import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initSentry } from './config/sentry'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import App from './App.tsx'

initSentry()

// Issue#70: iOS PWA全画面高さ補正
// black-translucent時、CSSビューポート単位がステータスバー分を含まないため、
// 利用可能な全ての高さ値から最大値を取得して--app-heightに設定する。
if ((navigator as { standalone?: boolean }).standalone === true) {
  const setAppHeight = () => {
    const candidates = [
      window.innerHeight,
      window.outerHeight,
      screen.height,
      screen.availHeight,
      document.documentElement.clientHeight,
      window.visualViewport?.height ?? 0,
    ].filter(v => v > 0)
    const maxH = Math.max(...candidates)
    document.documentElement.style.setProperty('--app-height', `${maxH}px`)
  }
  // 初回は少し遅延させてレイアウト完了後に測定
  setTimeout(setAppHeight, 50)
  window.addEventListener('resize', setAppHeight)
  window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 200))
}

// Issue#70: PWA対応 - Service Worker登録（ページ読み込み完了後に登録）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
