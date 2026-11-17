import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useCanonicalUrl } from '../hooks/useCanonicalUrl'

/**
 * Issue#99 - Photlas のランディング/概要ページ。
 *
 * Google OAuth 公開審査において、OAuth 同意画面に登録する「アプリのホームページ」
 * URL が以下を満たす必要があるため、本ページを `/about` に配置して登録 URL を
 * `https://photlas.jp/about` に切り替える運用とする:
 *
 * <ul>
 *   <li>アプリ名「Photlas」を可視テキストで表示</li>
 *   <li>アプリの目的を説明する文章を含む</li>
 *   <li>プライバシーポリシー / 利用規約への可視リンクを含む</li>
 * </ul>
 *
 * メインの地図画面 (https://photlas.jp/) には影響を与えない設計。
 *
 * Spec#93 追加対応: Google の同意画面や利用規約・プライバシーポリシーの単独ページからも
 * 一般の利用者が来るため、表示言語に合わせて 5 言語で出す。
 */
/** 「主な特徴」の項目（翻訳キー aboutPage.<項目>Title / aboutPage.<項目>Text） */
const FEATURES = ['exploreMap', 'filterPosts', 'shareShootingInfo'] as const

export default function AboutPage() {
  const { t } = useTranslation()
  useDocumentTitle(`Photlas - ${t('aboutPage.tagline')}`)
  useCanonicalUrl('/about')

  return (
    // index.css の html/body overflow:hidden を回避するため、
    // ラッパー自身を h-screen + overflow-y-auto で内部スクロール可能にする。
    <div className="h-screen overflow-y-auto bg-white text-gray-900 flex flex-col">
      {/* ヘッダー */}
      <header className="border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" loading="eager" className="w-10 h-10" />
          <span className="text-xl font-semibold">Photlas</span>
        </div>
      </header>

      {/* ヒーロー */}
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="text-4xl font-bold mb-4">Photlas</h1>
          <p className="text-lg text-gray-700 leading-relaxed mb-8">
            {t('aboutPage.intro')}
          </p>
          <div className="flex justify-center">
            <Button asChild size="lg" className="bg-black hover:bg-gray-800 text-white">
              <Link to="/">{t('aboutPage.cta')}</Link>
            </Button>
          </div>
        </section>

        {/* 特徴 */}
        <section className="max-w-3xl mx-auto px-6 pb-16">
          <h2 className="text-2xl font-semibold mb-6">{t('aboutPage.featuresTitle')}</h2>
          <ul className="space-y-4 text-gray-700">
            {FEATURES.map((feature) => (
              <li key={feature}>
                <strong className="text-gray-900">{t(`aboutPage.${feature}Title`)}</strong>{' '}
                {t(`aboutPage.${feature}Text`)}
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* フッター */}
      <footer className="border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <div>&copy; Photlas</div>
          <nav className="flex gap-4">
            <a href="/privacy-policy" className="underline hover:text-gray-900">
              {t('auth.privacyPolicy')}
            </a>
            <a href="/terms-of-service" className="underline hover:text-gray-900">
              {t('auth.termsOfService')}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
