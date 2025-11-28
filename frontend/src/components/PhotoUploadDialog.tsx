import { useState, useEffect, useRef } from 'react'

interface PhotoUploadDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    title: string
    photo: File
    categories: string[]
    location?: { lat: number; lng: number }
  }) => void
}

interface Location {
  lat: number
  lng: number
}

/**
 * 写真投稿フォームダイアログコンポーネント
 * Issue#7: 写真投稿フォーム (UI)
 */
export default function PhotoUploadDialog({ open, onClose, onSubmit }: PhotoUploadDialogProps) {
  // フォーム状態
  const [title, setTitle] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [location, setLocation] = useState<Location | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // カテゴリ一覧
  const categories = ['風景', '建築', 'ストリート', 'ポートレート', '乗り物']

  // モーダルが開かれたときにフォームをリセット
  useEffect(() => {
    if (open) {
      setTitle('')
      setPhoto(null)
      setPhotoPreview(null)
      setSelectedCategories([])
      setLocation(null)
      setValidationErrors([])
    }
  }, [open])

  // タイトル文字数
  const titleLength = title.length
  const isTitleValid = titleLength >= 2 && titleLength <= 20

  // 投稿ボタンの活性化条件
  const isFormValid = isTitleValid && photo !== null && location !== null && selectedCategories.length > 0

  // タイトル入力ハンドラー
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    // タイトルが変更されたらバリデーションエラーをクリア
    if (validationErrors.length > 0) {
      setValidationErrors([])
    }
  }

  // 写真選択ボタンクリックハンドラー
  const handlePhotoSelectClick = () => {
    fileInputRef.current?.click()
  }

  // 写真ファイル選択ハンドラー
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhoto(file)

    // プレビュー生成
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      setPhotoPreview(result)
    }
    reader.readAsDataURL(file)
  }

  // カテゴリ選択トグルハンドラー
  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category)
      } else {
        return [...prev, category]
      }
    })
    // カテゴリが変更されたらバリデーションエラーをクリア
    if (validationErrors.length > 0) {
      setValidationErrors([])
    }
  }

  // 位置設定ハンドラー（Issue#8で地図ピッカーを実装予定）
  const handleLocationSet = () => {
    // モック: 東京の座標を設定
    setLocation({ lat: 35.6762, lng: 139.6503 })
  }

  // バリデーション
  const validate = (): string[] => {
    const errors: string[] = []

    if (!title) {
      errors.push('タイトルを入力してください')
    } else if (titleLength < 2 || titleLength > 20) {
      errors.push('タイトルは2文字以上20文字以内で入力してください')
    }

    if (!photo) {
      errors.push('写真を選択してください')
    }

    if (!location) {
      errors.push('撮影位置を設定してください')
    }

    if (selectedCategories.length === 0) {
      errors.push('カテゴリを選択してください')
    }

    return errors
  }

  // 送信ハンドラー
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const errors = validate()
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors([])

    if (photo && location) {
      onSubmit({
        title,
        photo,
        categories: selectedCategories,
        location
      })
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        role="dialog"
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto"
      >
        {/* タイトル */}
        <h2 className="text-2xl font-bold mb-6">写真を投稿</h2>

        {/* バリデーションエラー */}
        {validationErrors.length > 0 && (
          <ul
            data-testid="validation-errors"
            className="bg-red-50 border border-red-200 rounded p-4 mb-6 text-red-500"
          >
            {validationErrors.map((error, index) => (
              <li key={index} className="list-disc list-inside">
                {error}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* タイトル入力欄 */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              タイトル
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={handleTitleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div
              className={`text-sm mt-1 ${
                titleLength < 2 || titleLength > 20 ? 'text-red-500' : 'text-gray-500'
              }`}
            >
              {titleLength} / 20
            </div>
          </div>

          {/* 写真プレビューエリア */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">写真</label>
            <div
              data-testid="photo-preview-area"
              className="w-[90%] aspect-[3/2] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50"
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="写真プレビュー"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <button
                  type="button"
                  onClick={handlePhotoSelectClick}
                  className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  写真を選択
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              data-testid="photo-file-input"
              type="file"
              accept="image/jpeg,image/png,image/heic"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>

          {/* 位置設定用エリア */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">位置情報</label>
            <div
              data-testid="location-selection-area"
              className="border border-gray-300 rounded-lg p-4 bg-gray-50"
            >
              {location ? (
                <div className="text-sm text-gray-700">
                  位置が設定されました（緯度: {location.lat}, 経度: {location.lng}）
                </div>
              ) : (
                <div className="text-sm text-gray-500 mb-2">地図で撮影場所を選んでください</div>
              )}
              <button
                type="button"
                onClick={handleLocationSet}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                位置を設定
              </button>
            </div>
          </div>

          {/* カテゴリ選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
            <div
              data-testid="category-selection"
              className="grid grid-cols-2 gap-3"
            >
              {categories.map(category => (
                <label
                  key={category}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={() => handleCategoryToggle(category)}
                    className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{category}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 投稿ボタン */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!isFormValid}
              className={`px-6 py-3 rounded-md font-medium ${
                isFormValid
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              投稿する
            </button>
          </div>
        </form>

        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          aria-label="閉じる"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
