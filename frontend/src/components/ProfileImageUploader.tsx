import { useState, useRef } from 'react'

/**
 * ProfileImageUploader コンポーネント
 * Issue#2: ユーザー登録機能
 *
 * プロフィール画像の選択・プレビュー機能を提供。
 * ファイル形式・サイズの検証を行う。
 */
interface ProfileImageUploaderProps {
  onImageSelect: (file: File) => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

function ProfileImageUploader({ onImageSelect }: ProfileImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')

    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('ファイルサイズは5MB以下にしてください')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        setPreview(e.target.result as string)
      }
    }
    reader.readAsDataURL(file)
    onImageSelect(file)
  }

  return (
    <div className="flex items-center space-x-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        data-testid="image-file-input"
      />

      <button
        type="button"
        onClick={handleButtonClick}
        className="bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        画像を選択
      </button>

      {preview && (
        <div className="flex-shrink-0">
          <img
            src={preview}
            alt="プロフィール画像プレビュー"
            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}

export default ProfileImageUploader
