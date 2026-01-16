import { useState } from 'react'

/**
 * SNSLinksInput コンポーネント
 * Issue#2: ユーザー登録機能
 *
 * SNSリンクを動的に入力できる機能を提供（最大3件）。
 * URL形式のリアルタイム検証を行う。
 */
interface SNSLinksInputProps {
  links: string[]
  onLinksChange: (links: string[]) => void
}

const MAX_LINKS = 3

function SNSLinksInput({ links, onLinksChange }: SNSLinksInputProps) {
  const [errors, setErrors] = useState<{ [key: number]: string }>({})
  const displayLinks = links.length === 0 ? [''] : links

  const validateURL = (url: string): boolean => {
    if (!url.trim()) return true

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

    if (value.trim() && index === newLinks.length - 1 && newLinks.length < MAX_LINKS) {
      newLinks.push('')
    }

    if (!value.trim() && index < newLinks.length - 1) {
      const filteredLinks = newLinks.slice(0, index + 1)
      if (filteredLinks.length === 0) {
        filteredLinks.push('')
      }
      onLinksChange(filteredLinks)
    } else {
      onLinksChange(newLinks)
    }

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
          <label
            htmlFor={`sns-link-${index}`}
            className="block text-sm font-medium text-gray-700"
          >
            SNSリンク {index + 1}
          </label>

          <input
            type="url"
            id={`sns-link-${index}`}
            aria-label={`SNSリンク ${index + 1}`}
            aria-describedby={errors[index] ? `sns-link-error-${index}` : undefined}
            value={link}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onBlur={(e) => handleBlur(index, e.target.value)}
            placeholder="https://twitter.com/username など"
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors[index] ? 'border-red-500' : 'border-gray-300'
            }`}
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
