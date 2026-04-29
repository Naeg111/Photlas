import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

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
 */
export default function AboutPage() {
  useDocumentTitle('Photlas - 写真から行ってみたい場所が見つかる Web サービス')

  return (
    // index.css の html/body overflow:hidden を回避するため、
    // ラッパー自身を h-screen + overflow-y-auto で内部スクロール可能にする。
    <div className="h-screen overflow-y-auto bg-white text-gray-900 flex flex-col">
      {/* ヘッダー */}
      <header className="border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" className="w-10 h-10" />
          <span className="text-xl font-semibold">Photlas</span>
        </div>
      </header>

      {/* ヒーロー */}
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="text-4xl font-bold mb-4">Photlas</h1>
          <p className="text-lg text-gray-700 leading-relaxed">
            写真から行ってみたい場所が見つかる Web サービスです。
            ユーザーが投稿した写真とその撮影場所を地図上から自由に探索でき、
            新たな旅のきっかけを生み出します。
          </p>
        </section>

        {/* 特徴 */}
        <section className="max-w-3xl mx-auto px-6 pb-16">
          <h2 className="text-2xl font-semibold mb-6">主な特徴</h2>
          <ul className="space-y-4 text-gray-700">
            <li>
              <strong className="text-gray-900">地図上でスポットを探索:</strong>{' '}
              投稿された写真を地図上のピンで一覧表示し、地図を眺めるうちに、思いがけない投稿と出会い、行きたい場所が広がります。
            </li>
            <li>
              <strong className="text-gray-900">写真の条件で投稿を絞り込み:</strong>{' '}
              ジャンル・季節・時間帯・天候などの条件で絞り込んで、自分好みの投稿を探せます。
            </li>
            <li>
              <strong className="text-gray-900">撮影情報の共有:</strong>{' '}
              カメラ・レンズ・撮影設定など、写真の撮影情報を他のユーザーと共有できます。
            </li>
          </ul>
        </section>
      </main>

      {/* フッター */}
      <footer className="border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <div>&copy; Photlas</div>
          <nav className="flex gap-4">
            <Link to="/" className="underline hover:text-gray-900">
              トップページ
            </Link>
            <a href="/privacy-policy" className="underline hover:text-gray-900">
              プライバシーポリシー
            </a>
            <a href="/terms-of-service" className="underline hover:text-gray-900">
              利用規約
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
