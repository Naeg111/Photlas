import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TermsContentJa } from '../components/TermsContentJa'
import { TermsContentEn } from '../components/TermsContentEn'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/**
 * Issue#99 - 利用規約の単独ページ。
 *
 * Google OAuth 同意画面に登録する利用規約 URL
 * (https://photlas.jp/terms-of-service) が直接アクセス可能であることを保証する。
 */
export default function TermsOfServiceStandalonePage() {
  const { i18n } = useTranslation()
  useDocumentTitle('利用規約 - Photlas')

  const isEnglish = i18n.language?.startsWith('en')

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
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
          <h1 className="text-3xl font-bold mb-8">利用規約</h1>
          {isEnglish ? <TermsContentEn /> : <TermsContentJa />}
        </article>
      </main>

      {/* フッター */}
      <footer className="border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <div>&copy; Photlas</div>
          <nav className="flex gap-4">
            <Link to="/about" className="underline hover:text-gray-900">
              Photlas について
            </Link>
            <a href="/privacy-policy" className="underline hover:text-gray-900">
              プライバシーポリシー
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
