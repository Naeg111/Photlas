import { useState, useEffect } from 'react'

const CONSENT_KEY = 'cookie_consent'

/**
 * Cookie同意バナー
 *
 * Issue#71: GDPR対応。同意取得モデルに変更。
 * 「同意する」でGA4のConsent Modeをgrantedに更新。
 * 「拒否する」でGA4はdenied（匿名基本計測のみ）のまま。
 * Sentryはサービス運営の正当な利益として常に有効。
 *
 * Safariツールバーの色検出対策:
 * 全画面transparent overlay（fixed inset-0）の中にバナーを配置。
 * バナーの下に透明スペーサーを置き、ビューポート最下端にbodyの黒が透過する。
 */

interface CookieConsentBannerProps {
  onPrivacyPolicyClick?: () => void
}

export function CookieConsentBanner({ onPrivacyPolicyClick }: Readonly<CookieConsentBannerProps>) {
  const [isVisible, setIsVisible] = useState(() => {
    const consent = localStorage.getItem(CONSENT_KEY)
    return consent === null
  })

  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isVisible) return
    const timer = setTimeout(() => setReady(true), 500)
    return () => clearTimeout(timer)
  }, [isVisible])

  if (!isVisible || !ready) return null

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    // GA4 Consent Mode を granted に更新
    if (typeof gtag === 'function') {
      gtag('consent', 'update', { analytics_storage: 'granted' })
    }
    setIsVisible(false)
  }

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setIsVisible(false)
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-end">
      <div
        data-testid="cookie-consent-banner"
        className="bg-white border-t border-gray-200 shadow-lg p-4 pointer-events-auto"
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-3 text-sm text-gray-700">
          <div className="text-center">
            <p>
              このサイトでは、サービス改善のためにGoogle Analyticsを使用し、Cookieによるアクセス情報を収集しています。詳しくは
              <button
                onClick={onPrivacyPolicyClick}
                className="text-blue-600 underline hover:text-blue-800 mx-1"
              >
                プライバシーポリシー
              </button>
              をご覧ください。
            </p>
            <p className="mt-1 text-xs text-gray-500">
              This site uses Google Analytics and cookies to collect access information for service improvement.
              See our <button onClick={onPrivacyPolicyClick} className="text-blue-600 underline hover:text-blue-800 mx-1">Privacy Policy</button> for details.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              className="px-6 py-2 border border-black bg-white text-black rounded-lg hover:bg-black hover:text-white active:bg-black active:text-white transition-colors whitespace-nowrap"
            >
              拒否する / Decline
            </button>
            <button
              onClick={handleAccept}
              className="px-6 py-2 border border-black bg-white text-black rounded-lg hover:bg-black hover:text-white active:bg-black active:text-white transition-colors whitespace-nowrap"
            >
              同意する / Accept
            </button>
          </div>
        </div>
      </div>
      {/* Safariツールバー色検出用: ビューポート最下端に透明領域を確保 */}
      <div className="h-1.5 shrink-0" />
    </div>
  )
}
