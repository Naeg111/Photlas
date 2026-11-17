import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const CONSENT_KEY = 'cookie_consent'

/**
 * Cookie同意バナー
 *
 * Issue#71: GDPR対応。同意取得モデルに変更。
 * 「同意する」でGA4のConsent Modeをgrantedに更新。
 * 「拒否する」でGA4はdenied（匿名基本計測のみ）のまま。
 * Sentryはサービス運営の正当な利益として常に有効。
 *
 * Spec#93: 文言は表示言語の翻訳（cookie.*）だけを出す。
 * 多言語化の前に入れていた英文の併記（Spec#71）は、英語表示で同じ文が 2 回出るなどのため削除した。
 *
 * Safariツールバーの色検出対策:
 * 全画面transparent overlay（fixed inset-0）の中にバナーを配置。
 * バナーの下に透明スペーサーを置き、ビューポート最下端にbodyの黒が透過する。
 */

interface CookieConsentBannerProps {
  onPrivacyPolicyClick?: () => void
}

export function CookieConsentBanner({ onPrivacyPolicyClick }: Readonly<CookieConsentBannerProps>) {
  const { t } = useTranslation()
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
              {t('cookie.message')}
              <button
                onClick={onPrivacyPolicyClick}
                className="text-blue-600 underline hover:text-blue-800 mx-1"
              >
                {t('cookie.privacyLink')}
              </button>
              {t('cookie.messageSuffix')}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              className="px-6 py-2 border border-black bg-white text-black rounded-lg hover:bg-black hover:text-white active:bg-black active:text-white transition-colors whitespace-nowrap"
            >
              {t('cookie.decline')}
            </button>
            <button
              onClick={handleAccept}
              className="px-6 py-2 border border-black bg-white text-black rounded-lg hover:bg-black hover:text-white active:bg-black active:text-white transition-colors whitespace-nowrap"
            >
              {t('cookie.accept')}
            </button>
          </div>
        </div>
      </div>
      {/* Safariツールバー色検出用: ビューポート最下端に透明領域を確保 */}
      <div className="h-1.5 shrink-0" />
    </div>
  )
}
