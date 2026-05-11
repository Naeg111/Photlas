import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initSentry } from './config/sentry'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initI18n } from './i18n'
import './index.css'
import App from './App.tsx'

initSentry()

// Issue#129: SW 登録は vite-plugin-pwa の injectRegister: 'auto' が
// ビルド時に index.html へ自動注入するため、ここでの手動登録は不要

// Issue#130: i18n を非同期初期化（初期言語の翻訳 JSON だけを動的 import）してから render
initI18n().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  )
})
