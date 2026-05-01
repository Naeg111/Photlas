import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TermsContentJa } from '../components/TermsContentJa'
import { TermsContentEn } from '../components/TermsContentEn'
import { TermsContentKo } from '../components/TermsContentKo'
import { TermsContentZhCN } from '../components/TermsContentZhCN'
import { TermsContentZhTW } from '../components/TermsContentZhTW'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useCanonicalUrl } from '../hooks/useCanonicalUrl'

/**
 * Issue#99 - 利用規約の単独ページ。
 * Issue#101 - 5 言語対応 + ハードコード日本語の i18n 化、既存バグ修正
 *
 * Google OAuth 同意画面に登録する利用規約 URL
 * (https://photlas.jp/terms-of-service) が直接アクセス可能であることを保証する。
 *
 * 既存バグ: 旧実装の startsWith('en') 判定では ko / zh-CN / zh-TW のユーザーで
 * 日本語が表示されていた。本対応で 5 言語対応の switch 方式に統一。
 */
function selectTermsContent(language: string | undefined) {
  switch (language) {
    case 'ja': return <TermsContentJa />
    case 'ko': return <TermsContentKo />
    case 'zh-CN': return <TermsContentZhCN />
    case 'zh-TW': return <TermsContentZhTW />
    default: return <TermsContentEn />
  }
}

export default function TermsOfServiceStandalonePage() {
  const { t, i18n } = useTranslation()
  useDocumentTitle(`${t('auth.termsOfService')} - Photlas`)
  useCanonicalUrl('/terms-of-service')

  return (
    // index.css の html/body overflow:hidden を回避するため、
    // ラッパー自身を h-screen + overflow-y-auto で内部スクロール可能にする。
    <div className="h-screen overflow-y-auto bg-white text-gray-900 flex flex-col">
      {/* ヘッダー */}
      <header className="border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" className="w-10 h-10" />
          <Link to="/about" className="text-xl font-semibold hover:underline">
            Photlas
          </Link>
        </div>
      </header>

      {/* 本文 */}
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-6 py-12">
          {/* Issue#101: h1 を i18n 化 */}
          <h1 className="text-3xl font-bold mb-8">{t('auth.termsOfService')}</h1>
          {selectTermsContent(i18n.language)}
        </article>
      </main>

      {/* フッター */}
      <footer className="border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <div>&copy; Photlas</div>
          <nav className="flex gap-4">
            {/* Issue#101: フッターリンクを i18n 化 */}
            <Link to="/about" className="underline hover:text-gray-900">
              {t('menu.about')}
            </Link>
            <a href="/privacy-policy" className="underline hover:text-gray-900">
              {t('auth.privacyPolicy')}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
