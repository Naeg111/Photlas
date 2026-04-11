import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/**
 * NotFoundPage コンポーネント
 * 存在しないURLにアクセスした際に表示する404ページ
 */
function NotFoundPage() {
  const { t } = useTranslation()
  useDocumentTitle('ページが見つかりません - Photlas')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-6xl font-bold text-gray-300 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('pages.notFound')}
        </h1>
        <p className="text-gray-600 mb-8">
          {t('pages.notFoundMessage')}
        </p>
        <Link
          to="/"
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 inline-block"
        >
          {t('pages.backToHome')}
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage
