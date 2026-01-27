import { useState, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

// APIエンドポイント定数
const API_ENDPOINTS = {
  PROFILE_IMAGE_PRESIGNED_URL: '/api/v1/users/me/profile-image/presigned-url',
  PROFILE_IMAGE: '/api/v1/users/me/profile-image',
  SNS_LINKS: '/api/v1/users/me/sns-links',
  USERNAME: '/api/v1/users/me/username',
} as const

// バリデーションエラーメッセージ定数
const ERROR_MESSAGES = {
  USERNAME_REQUIRED: 'ユーザー名を入力してください',
  USERNAME_TOO_LONG: '30文字以内で入力してください',
  FAILED_TO_GET_PRESIGNED_URL: 'Failed to get presigned URL',
  FAILED_TO_UPDATE_USERNAME: 'Failed to update username',
} as const

// バリデーション定数
const VALIDATION = {
  MAX_USERNAME_LENGTH: 30,
} as const

// HTTPステータスコード定数
const HTTP_STATUS = {
  CONFLICT: 409,
} as const

interface SnsLink {
  url: string
  platform?: string
}

interface UseProfileEditProps {
  initialUsername: string
  snsLinks: SnsLink[]
  onUsernameUpdated?: (newUsername: string) => void
}

interface UseProfileEditReturn {
  // ユーザー名編集
  isEditingUsername: boolean
  editingUsername: string
  usernameError: string
  handleUsernameEditClick: () => void
  handleUsernameChange: (value: string) => void
  handleSaveUsername: () => Promise<void>

  // プロフィール画像
  isUploading: boolean
  uploadSuccess: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleProfileImageSelect: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleDeleteProfileImage: () => Promise<void>

  // SNSリンク
  isEditingSnsLinks: boolean
  setIsEditingSnsLinks: (value: boolean) => void
  handleSaveSnsLinks: () => Promise<void>
}

/**
 * プロフィール編集機能を提供するカスタムフック
 * Issue#29: プロフィール機能強化
 * Issue#36: ユーザー名更新時のコールバック追加
 */
export const useProfileEdit = ({
  initialUsername,
  snsLinks,
  onUsernameUpdated,
}: UseProfileEditProps): UseProfileEditReturn => {
  const { getAuthToken } = useAuth()
  // ユーザー名編集の状態
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [editingUsername, setEditingUsername] = useState(initialUsername)
  const [usernameError, setUsernameError] = useState('')

  // プロフィール画像の状態
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // SNSリンク編集の状態
  const [isEditingSnsLinks, setIsEditingSnsLinks] = useState(false)

  /**
   * ユーザー名編集を開始
   */
  const handleUsernameEditClick = useCallback(() => {
    setIsEditingUsername(true)
    setEditingUsername(initialUsername)
    setUsernameError('')
  }, [initialUsername])

  /**
   * ユーザー名の変更
   */
  const handleUsernameChange = useCallback((value: string) => {
    setEditingUsername(value)
  }, [])

  /**
   * ユーザー名のバリデーション
   */
  const validateUsername = (username: string): string | null => {
    if (!username || username.trim() === '') {
      return ERROR_MESSAGES.USERNAME_REQUIRED
    }
    if (username.length > VALIDATION.MAX_USERNAME_LENGTH) {
      return ERROR_MESSAGES.USERNAME_TOO_LONG
    }
    return null
  }

  /**
   * ユーザー名を保存
   * Issue#36: 成功時にonUsernameUpdatedコールバックを呼び出す
   */
  const handleSaveUsername = useCallback(async () => {
    setUsernameError('')

    const validationError = validateUsername(editingUsername)
    if (validationError) {
      setUsernameError(validationError)
      return
    }

    try {
      const token = getAuthToken()
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(API_ENDPOINTS.USERNAME, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ username: editingUsername }),
      })

      if (!response.ok) {
        if (response.status === HTTP_STATUS.CONFLICT) {
          const data = await response.json()
          setUsernameError(data.message)
          return
        }
        throw new Error(ERROR_MESSAGES.FAILED_TO_UPDATE_USERNAME)
      }

      setIsEditingUsername(false)
      // Issue#36: 成功時にコールバックを呼び出してAuthContextを更新
      onUsernameUpdated?.(editingUsername)
    } catch {
      // エラー時の処理
    }
  }, [editingUsername, getAuthToken, onUsernameUpdated])

  /**
   * プロフィール画像を選択してアップロード
   */
  const handleProfileImageSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setIsUploading(true)
      setUploadSuccess(false)

      try {
        const presignedResponse = await fetch(API_ENDPOINTS.PROFILE_IMAGE_PRESIGNED_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!presignedResponse.ok) {
          throw new Error(ERROR_MESSAGES.FAILED_TO_GET_PRESIGNED_URL)
        }

        const { uploadUrl, objectKey } = await presignedResponse.json()

        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
        })

        await fetch(API_ENDPOINTS.PROFILE_IMAGE, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objectKey }),
        })

        setUploadSuccess(true)
      } catch {
        // エラー時の処理
      } finally {
        setIsUploading(false)
      }
    },
    []
  )

  /**
   * プロフィール画像を削除
   */
  const handleDeleteProfileImage = useCallback(async () => {
    await fetch(API_ENDPOINTS.PROFILE_IMAGE, {
      method: 'DELETE',
    })
  }, [])

  /**
   * SNSリンクを保存
   */
  const handleSaveSnsLinks = useCallback(async () => {
    await fetch(API_ENDPOINTS.SNS_LINKS, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snsLinks }),
    })
  }, [snsLinks])

  return {
    // ユーザー名編集
    isEditingUsername,
    editingUsername,
    usernameError,
    handleUsernameEditClick,
    handleUsernameChange,
    handleSaveUsername,

    // プロフィール画像
    isUploading,
    uploadSuccess,
    fileInputRef,
    handleProfileImageSelect,
    handleDeleteProfileImage,

    // SNSリンク
    isEditingSnsLinks,
    setIsEditingSnsLinks,
    handleSaveSnsLinks,
  }
}
