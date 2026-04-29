import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PrivacyContentJa } from '../components/PrivacyContentJa'
import { PrivacyContentEn } from '../components/PrivacyContentEn'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/**
 * Issue#99 - プライバシーポリシーの単独ページ。
 *
 * Google OAuth 同意画面に登録するプライバシーポリシー URL
 * (https://photlas.jp/privacy-policy) が直接アクセス可能であることを保証する。
 * Dialog 版 ({@link import('../components/PrivacyPolicyPage').PrivacyPolicyPage})
 * は本文コンポーネント (PrivacyContentJa / PrivacyContentEn) を再利用する。
 */
export default function PrivacyPolicyStandalonePage() {
  const { i18n } = useTranslation()
  useDocumentTitle('プライバシーポリシー - Photlas')

  const isEnglish = i18n.language?.startsWith('en')

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
          <h1 className="text-3xl font-bold mb-8">プライバシーポリシー</h1>
          {isEnglish ? <PrivacyContentEn /> : <PrivacyContentJa />}
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
            <a href="/terms-of-service" className="underline hover:text-gray-900">
              利用規約
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
