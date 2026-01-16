import { Link } from 'react-router-dom'

/**
 * RegisterSuccessPage コンポーネント
 * Issue#2: ユーザー登録機能 (UI) - 登録完了ページ
 *
 * ユーザー登録が正常に完了したことを伝え、メール確認の案内を表示する。
 */
function RegisterSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            登録完了
          </h1>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-green-600 mb-4">
              登録ありがとうございます！
            </h2>

            <p className="text-gray-600 leading-relaxed">
              ご登録のメールアドレスに確認メールを送信しました。メール内のリンクをクリックして、登録を完了してください。
            </p>
          </div>

          <Link
            to="/"
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 inline-block"
          >
            トップページへ
          </Link>
        </div>
      </div>
    </div>
  )
}

export default RegisterSuccessPage


