import { useState } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'cookie_consent_acknowledged'

/**
 * Cookie同意バナー
 *
 * Issue#60: 外部送信規律対応（通知モデル）。
 * GA4の利用をユーザーに通知し、OKを押すとlocalStorageに保存して再表示しない。
 *
 * Safariツールバーの色検出対策:
 * 全画面transparent overlay（fixed inset-0）の中にバナーを配置。
 * バナーの下に透明スペーサーを置き、ビューポート最下端にbodyの黒が透過する。
 * TopMenuPanel（bg-transparent SheetContent）と同じアプローチ。
 */
export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) !== 'true'
  })

  if (!isVisible) return null

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsVisible(false)
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-end">
      <div
        data-testid="cookie-consent-banner"
        className="bg-white border-t border-gray-200 shadow-lg p-4 pointer-events-auto"
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-3 text-sm text-gray-700">
          <p className="flex-1 text-center sm:text-left">
            このサイトでは、サービス改善のためにGoogle Analyticsを使用し、アクセス情報を収集しています。詳しくは
            <Link to="/" className="text-blue-600 underline hover:text-blue-800 mx-1">
              プライバシーポリシー
            </Link>
            をご覧ください。
          </p>
          <button
            onClick={handleAccept}
            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 whitespace-nowrap"
          >
            OK
          </button>
        </div>
      </div>
      {/* Safariツールバー色検出用: ビューポート最下端に透明領域を確保 */}
      <div className="h-3 shrink-0" />
    </div>
  )
}
