import { useState, useCallback } from 'react'
import ProfileImageUploader from '../components/ProfileImageUploader'
import SNSLinksInput from '../components/SNSLinksInput'

/**
 * RegisterPage コンポーネント
 * Issue#2: ユーザー登録機能 (UI)
 * 
 * TDD Green段階: テストを通すための最小実装
 */
function RegisterPage() {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    profileImage: null as File | null,
    snsLinks: [''] as string[], // SNSLinksInputコンポーネントと一致させる
    termsAccepted: false
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    // 表示名バリデーション
    if (!formData.displayName.trim()) {
      newErrors.displayName = '表示名を入力してください'
    }

    // メールアドレスバリデーション
    if (!formData.email.trim()) {
      newErrors.email = 'メールアドレスを入力してください'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '正しいメールアドレスを入力してください'
    }

    // パスワードバリデーション
    if (!formData.password) {
      newErrors.password = 'パスワードを入力してください'
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(formData.password)) {
      newErrors.password = 'パスワードは8文字以上で、数字・小文字・大文字をそれぞれ1文字以上含めてください'
    }

    // パスワード確認バリデーション
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'パスワードが一致しません'
    }

    // 利用規約バリデーション
    if (!formData.termsAccepted) {
      newErrors.terms = '利用規約に同意してください'
    }

    return newErrors
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newErrors = validateForm()
    setErrors(newErrors)

    if (Object.keys(newErrors).length === 0) {
      // 成功時の処理（実際のAPI呼び出しは Issue#3）
      // TODO: API呼び出し実装
      console.log('Registration data:', formData)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // エラーをクリア（プロパティを削除）
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleImageSelect = (file: File) => {
    setFormData(prev => ({ ...prev, profileImage: file }))
  }

  const handleSNSLinksChange = useCallback((links: string[]) => {
    setFormData(prev => ({ ...prev, snsLinks: links }))
  }, [])

  // ボタンは常に有効にして、送信時にバリデーションを行う
  // const validationErrors = useMemo(() => validateForm(), [formData])
  // const isFormValid = useMemo(() => Object.keys(validationErrors).length === 0, [validationErrors])

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">アカウント登録</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* プロフィール画像アップローダー */}
          <div>
            <ProfileImageUploader onImageSelect={handleImageSelect} />
          </div>

          {/* 表示名 */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
              表示名
            </label>
            <input
              type="text"
              id="displayName"
              value={formData.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                errors.displayName ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.displayName && (
              <p className="mt-1 text-sm text-red-500">{errors.displayName}</p>
            )}
          </div>

          {/* メールアドレス */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email}</p>
            )}
          </div>

          {/* パスワード */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password}</p>
            )}
          </div>

          {/* パスワード（確認用） */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              パスワード（確認用）
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
            )}
          </div>

          {/* SNSリンク入力欄 */}
          <div>
            <SNSLinksInput links={formData.snsLinks} onLinksChange={handleSNSLinksChange} />
          </div>

          {/* 利用規約 */}
          <div>
            <div className="border rounded-md p-4 h-32 overflow-y-auto bg-gray-50 mb-4">
              <h3 className="font-bold mb-2">利用規約</h3>
              <p className="text-sm text-gray-600">
                本サービスを利用する際は、以下の利用規約に同意いただく必要があります。
                利用規約の詳細な内容がここに表示されます。
              </p>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.termsAccepted}
                onChange={(e) => handleInputChange('termsAccepted', e.target.checked)}
                className="mr-2"
                aria-label="利用規約に同意する"
              />
              <span className="text-sm">利用規約に同意する</span>
            </label>
            {errors.terms && (
              <p className="mt-1 text-sm text-red-500">{errors.terms}</p>
            )}
          </div>

          {/* 登録ボタン */}
          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              登録する
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegisterPage
