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
  MAX_SNS_LINKS: 3,
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
  onImageUpdated?: (previewUrl: string | null) => void
  onSnsLinksUpdated?: (newLinks: SnsLink[]) => void
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
  handleProfileImageSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleDeleteProfileImage: () => Promise<void>

  // Issue#35: トリミング機能
  isCropperOpen: boolean
  cropperImageSrc: string
  handleCropComplete: (croppedBlob: Blob) => Promise<void>
  handleCropCancel: () => void

  // SNSリンク
  isEditingSnsLinks: boolean
  editingSnsLinks: SnsLink[]
  handleStartEditSnsLinks: () => void
  handleCancelEditSnsLinks: () => void
  handleAddSnsLink: () => void
  handleRemoveSnsLink: (index: number) => void
  handleUpdateSnsLink: (index: number, field: 'platform' | 'url', value: string) => void
  handleSaveSnsLinks: () => Promise<void>

  // 統一保存機能
  hasUnsavedChanges: boolean
  isSaving: boolean
  handleSaveAllChanges: () => Promise<void>
  handleCancelAllChanges: () => void
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
  onImageUpdated,
  onSnsLinksUpdated,
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

  // Issue#35: トリミング機能の状態
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [cropperImageSrc, setCropperImageSrc] = useState('')

  // SNSリンク編集の状態
  // Issue#37: 編集中のSNSリンクをステートで管理
  const [isEditingSnsLinks, setIsEditingSnsLinks] = useState(false)
  const [editingSnsLinks, setEditingSnsLinks] = useState<SnsLink[]>([])

  // 統一保存機能の状態
  const [isSaving, setIsSaving] = useState(false)

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
   * Issue#35: プロフィール画像を選択してトリミングモーダルを開く
   */
  const handleProfileImageSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      // FileReaderで画像をData URLに変換
      const reader = new FileReader()
      reader.onload = () => {
        setCropperImageSrc(reader.result as string)
        setIsCropperOpen(true)
      }
      reader.readAsDataURL(file)
    },
    []
  )

  /**
   * Issue#35: トリミング完了後のアップロード処理
   */
  const handleCropComplete = useCallback(
    async (croppedBlob: Blob) => {
      setIsUploading(true)
      setUploadSuccess(false)
      setIsCropperOpen(false)

      // プレビュー用のBlobURLを即座に生成して表示
      const previewUrl = URL.createObjectURL(croppedBlob)
      onImageUpdated?.(previewUrl)

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
          body: croppedBlob,
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
    [onImageUpdated]
  )

  /**
   * Issue#35: トリミングをキャンセル
   */
  const handleCropCancel = useCallback(() => {
    setIsCropperOpen(false)
    setCropperImageSrc('')
  }, [])

  /**
   * プロフィール画像を削除
   */
  const handleDeleteProfileImage = useCallback(async () => {
    // ローカルステートをクリアして即座にUIを更新
    onImageUpdated?.(null)

    await fetch(API_ENDPOINTS.PROFILE_IMAGE, {
      method: 'DELETE',
    })
  }, [onImageUpdated])

  /**
   * Issue#37: SNSリンク編集を開始
   */
  const handleStartEditSnsLinks = useCallback(() => {
    // 既存のsnsLinksをコピーして編集用ステートにセット
    // 空の場合は1つの空エントリを追加
    const initialLinks = snsLinks.length > 0
      ? [...snsLinks]
      : [{ platform: 'twitter', url: '' }]
    setEditingSnsLinks(initialLinks)
    setIsEditingSnsLinks(true)
  }, [snsLinks])

  /**
   * Issue#37: SNSリンク編集をキャンセル
   */
  const handleCancelEditSnsLinks = useCallback(() => {
    setIsEditingSnsLinks(false)
    setEditingSnsLinks([])
  }, [])

  /**
   * Issue#37: SNSリンクを追加（最大件数まで）
   */
  const handleAddSnsLink = useCallback(() => {
    if (editingSnsLinks.length < VALIDATION.MAX_SNS_LINKS) {
      setEditingSnsLinks([...editingSnsLinks, { platform: 'twitter', url: '' }])
    }
  }, [editingSnsLinks])

  /**
   * Issue#37: SNSリンクを削除
   */
  const handleRemoveSnsLink = useCallback((index: number) => {
    setEditingSnsLinks(editingSnsLinks.filter((_, i) => i !== index))
  }, [editingSnsLinks])

  /**
   * Issue#37: SNSリンクを更新
   */
  const handleUpdateSnsLink = useCallback((index: number, field: 'platform' | 'url', value: string) => {
    const updated = [...editingSnsLinks]
    updated[index] = { ...updated[index], [field]: value }
    setEditingSnsLinks(updated)
  }, [editingSnsLinks])

  /**
   * Issue#37: SNSリンクを保存（編集内容を送信）
   */
  const handleSaveSnsLinks = useCallback(async () => {
    // URLが空でないリンクのみ保存
    const linksToSave = editingSnsLinks.filter(link => link.url.trim() !== '')

    const token = getAuthToken()
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(API_ENDPOINTS.SNS_LINKS, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ snsLinks: linksToSave }),
    })

    if (response.ok) {
      // 保存成功時にコールバックを呼び出し、表示を更新
      onSnsLinksUpdated?.(linksToSave)
    }

    setIsEditingSnsLinks(false)
  }, [editingSnsLinks, getAuthToken, onSnsLinksUpdated])

  /**
   * 未保存の変更があるかどうか
   * ユーザー名編集中またはSNSリンク編集中の場合にtrue
   */
  const hasUnsavedChanges = isEditingUsername || isEditingSnsLinks

  /**
   * 統一保存機能：アカウント名とSNSリンクを一括保存
   */
  const handleSaveAllChanges = useCallback(async () => {
    setIsSaving(true)

    try {
      const token = getAuthToken()
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // ユーザー名を保存（編集中の場合のみ）
      if (isEditingUsername) {
        const validationError = validateUsername(editingUsername)
        if (validationError) {
          setUsernameError(validationError)
          setIsSaving(false)
          return
        }

        const usernameResponse = await fetch(API_ENDPOINTS.USERNAME, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ username: editingUsername }),
        })

        if (!usernameResponse.ok) {
          if (usernameResponse.status === HTTP_STATUS.CONFLICT) {
            const data = await usernameResponse.json()
            setUsernameError(data.message)
            setIsSaving(false)
            return
          }
          throw new Error(ERROR_MESSAGES.FAILED_TO_UPDATE_USERNAME)
        }

        setIsEditingUsername(false)
        onUsernameUpdated?.(editingUsername)
      }

      // SNSリンクを保存（編集中の場合のみ）
      if (isEditingSnsLinks) {
        const linksToSave = editingSnsLinks.filter(link => link.url.trim() !== '')

        const snsResponse = await fetch(API_ENDPOINTS.SNS_LINKS, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ snsLinks: linksToSave }),
        })

        if (snsResponse.ok) {
          onSnsLinksUpdated?.(linksToSave)
        }

        setIsEditingSnsLinks(false)
      }
    } catch {
      // エラー時の処理
    } finally {
      setIsSaving(false)
    }
  }, [
    getAuthToken,
    isEditingUsername,
    editingUsername,
    onUsernameUpdated,
    isEditingSnsLinks,
    editingSnsLinks,
    onSnsLinksUpdated,
  ])

  /**
   * 全ての編集をキャンセル
   */
  const handleCancelAllChanges = useCallback(() => {
    if (isEditingUsername) {
      setIsEditingUsername(false)
      setEditingUsername(initialUsername)
      setUsernameError('')
    }
    if (isEditingSnsLinks) {
      setIsEditingSnsLinks(false)
      setEditingSnsLinks([])
    }
  }, [isEditingUsername, isEditingSnsLinks, initialUsername])

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

    // Issue#35: トリミング機能
    isCropperOpen,
    cropperImageSrc,
    handleCropComplete,
    handleCropCancel,

    // SNSリンク
    isEditingSnsLinks,
    editingSnsLinks,
    handleStartEditSnsLinks,
    handleCancelEditSnsLinks,
    handleAddSnsLink,
    handleRemoveSnsLink,
    handleUpdateSnsLink,
    handleSaveSnsLinks,

    // 統一保存機能
    hasUnsavedChanges,
    isSaving,
    handleSaveAllChanges,
    handleCancelAllChanges,
  }
}
