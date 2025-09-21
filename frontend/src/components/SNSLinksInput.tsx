import { useState } from 'react'

interface SNSLinksInputProps {
  links: string[]
  onLinksChange: (links: string[]) => void
}

/**
 * SNSLinksInput コンポーネント
 * Issue#2: ユーザー登録機能 (UI) - SNSリンク動的入力欄
 * 
 * TDD Green段階: テストを通すための最小実装
 */
function SNSLinksInput({ links, onLinksChange }: SNSLinksInputProps) {
  const [errors, setErrors] = useState<{ [key: number]: string }>({})

  // リンクが空または配列が空の場合、最低1つの空の入力欄を表示
  const displayLinks = links.length === 0 ? [''] : links

  const validateURL = (url: string): boolean => {
    if (!url.trim()) return true // 空の場合は有効とする
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  const handleInputChange = (index: number, value: string) => {
    const newLinks = [...displayLinks]
    newLinks[index] = value

    // 動的に入力欄を追加
    if (value.trim() && index === newLinks.length - 1 && newLinks.length < 3) {
      newLinks.push('')
    }

    // 空の場合は後続の入力欄を削除（ただし最低1つは残す）
    if (!value.trim() && index < newLinks.length - 1) {
      const filteredLinks = newLinks.slice(0, index + 1)
      if (filteredLinks.length === 0) {
        filteredLinks.push('')
      }
      onLinksChange(filteredLinks)
    } else {
      onLinksChange(newLinks)
    }

    // エラーをクリア
    if (errors[index]) {
      const newErrors = { ...errors }
      delete newErrors[index]
      setErrors(newErrors)
    }
  }

  const handleBlur = (index: number, value: string) => {
    if (value.trim() && !validateURL(value)) {
      setErrors(prev => ({
        ...prev,
        [index]: '正しいURLを入力してください'
      }))
    }
  }

  return (
    <div className="space-y-4">
      {displayLinks.map((link, index) => (
        <div key={index}>
          <label htmlFor={`sns-link-${index}`} className="block text-sm font-medium text-gray-700">
            SNSリンク {index + 1}
          </label>
          <input
            type="url"
            id={`sns-link-${index}`}
            aria-label={`SNSリンク ${index + 1}`}
            value={link}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onBlur={(e) => handleBlur(index, e.target.value)}
            placeholder="https://twitter.com/username など"
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors[index] ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-describedby={errors[index] ? `sns-link-error-${index}` : undefined}
          />
          {errors[index] && (
            <p 
              id={`sns-link-error-${index}`}
              className="mt-1 text-sm text-red-500"
            >
              {errors[index]}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

export default SNSLinksInput
