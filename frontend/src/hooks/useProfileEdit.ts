import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { validateUsername as validateUsernameLite } from '../utils/validation/username'
import { localizeFieldError } from '../utils/validation/localizeFieldError'

// APIエンドポイント定数
const API_ENDPOINTS = {
  PROFILE_IMAGE_PRESIGNED_URL: '/api/v1/users/me/profile-image/presigned-url',
  PROFILE_IMAGE: '/api/v1/users/me/profile-image',
  PROFILE_IMAGE_DELETE: '/api/v1/users/me/profile-image',
  USERNAME: '/api/v1/users/me/username',
} as const

const ERROR_MESSAGES = {
  FAILED_TO_GET_PRESIGNED_URL: 'Failed to get presigned URL',
  FAILED_TO_UPDATE_USERNAME: 'Failed to update username',
  FAILED_TO_REGISTER_PROFILE_IMAGE: 'プロフィール画像の登録に失敗しました',
} as const

const HTTP_STATUS = {
  BAD_REQUEST: 400,
  CONFLICT: 409,
} as const

interface UseProfileEditProps {
  initialUsername: string
  onUsernameUpdated?: (newUsername: string) => void
  onImageUpdated?: (previewUrl: string | null) => void
}

interface UseProfileEditReturn {
  // 表示名編集
  isEditingUsername: boolean
  editingUsername: string
  usernameError: string
  handleUsernameEditClick: () => void
  handleUsernameChange: (value: string) => void
  handleSaveUsername: () => Promise<void>

  // プロフィール画像
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleProfileImageSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleDeleteProfileImage: () => Promise<void>

  // Issue#35: トリミング機能
  isCropperOpen: boolean
  cropperImageSrc: string
  handleCropComplete: (croppedBlob: Blob) => Promise<void>
  handleCropCancel: () => void

  // 統一保存機能
  hasUnsavedChanges: boolean
  isSaving: boolean
  handleSaveAllChanges: () => Promise<void>
  handleCancelAllChanges: () => void
}

/**
 * プロフィール編集機能を提供するカスタムフック
 * Issue#29: プロフィール機能強化
 * Issue#36: 表示名更新時のコールバック追加
 */
export const useProfileEdit = ({
  initialUsername,
  onUsernameUpdated,
  onImageUpdated,
}: UseProfileEditProps): UseProfileEditReturn => {
  const { getAuthToken } = useAuth()
  const { t } = useTranslation()
  // 表示名編集の状態
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [editingUsername, setEditingUsername] = useState(initialUsername)
  const [usernameError, setUsernameError] = useState('')

  // プロフィール画像の状態
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Issue#35: トリミング機能の状態
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [cropperImageSrc, setCropperImageSrc] = useState('')

  // Issue#82: 画像の遅延アップロード
  const [pendingImageBlob, setPendingImageBlob] = useState<Blob | null>(null)
  const [pendingImageDelete, setPendingImageDelete] = useState(false)

  // 統一保存機能の状態
  const [isSaving, setIsSaving] = useState(false)

  /**
   * 表示名編集を開始
   */
  const handleUsernameEditClick = useCallback(() => {
    setIsEditingUsername(true)
    setEditingUsername(initialUsername)
    setUsernameError('')
  }, [initialUsername])

  /**
   * 表示名の変更
   */
  const handleUsernameChange = useCallback((value: string) => {
    setEditingUsername(value)
  }, [])

  /**
   * 表示名のバリデーション
   * Issue#98: 軽量バリデーション（utils/validation/username.ts）に委譲し、
   *          エラーキーを i18n フックで翻訳する
   */
  const validateUsername = (username: string): string | null => {
    const errorKey = validateUsernameLite(username)
    if (errorKey) {
      return t(`errors.${errorKey}`)
    }
    return null
  }

  /**
   * 表示名を保存
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
        if (response.status === HTTP_STATUS.BAD_REQUEST) {
          // Issue#98: 400 Bad Request の field-level エラー（i18n キー）を取得
          const data = await response.json().catch(() => null) as
            | { errors?: Array<{ field?: string; message?: string }> }
            | null
          const usernameErr = data?.errors?.find(e => e.field === 'username')?.message
          if (usernameErr) {
            setUsernameError(localizeFieldError(usernameErr, t))
            return
          }
        }
        throw new Error(ERROR_MESSAGES.FAILED_TO_UPDATE_USERNAME)
      }

      setIsEditingUsername(false)
      // Issue#36: 成功時にコールバックを呼び出してAuthContextを更新
      onUsernameUpdated?.(editingUsername)
    } catch {
      // エラー時の処理
    }
  }, [editingUsername, getAuthToken, onUsernameUpdated, t])

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
   * Issue#82: トリミング完了後 → Blobを保持してプレビューのみ（アップロードしない）
   */
  const handleCropComplete = useCallback(
    async (croppedBlob: Blob) => {
      setIsCropperOpen(false)

      // プレビュー用のBlobURLを即座に生成して表示
      const previewUrl = URL.createObjectURL(croppedBlob)
      onImageUpdated?.(previewUrl)

      // Blobを保持（保存ボタン押下時にアップロード）
      setPendingImageBlob(croppedBlob)
      setPendingImageDelete(false)
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
   * Issue#82: プロフィール画像を削除（遅延 - 保存ボタンで確定）
   */
  const handleDeleteProfileImage = useCallback(async () => {
    // プレビューをデフォルトアバターに戻す（APIは呼ばない）
    onImageUpdated?.(null)
    setPendingImageBlob(null)
    setPendingImageDelete(true)
  }, [onImageUpdated])

  /**
   * 未保存の変更があるかどうか
   * Issue#82: 画像変更・画像削除も含める
   * Issue#102: SNS リンク編集は SnsLinkEditDialog に切り出し済みのため除外
   */
  const hasUnsavedChanges = isEditingUsername || pendingImageBlob !== null || pendingImageDelete

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

      // 表示名を保存（編集中の場合のみ）
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
          if (usernameResponse.status === HTTP_STATUS.BAD_REQUEST) {
            // Issue#98: 400 Bad Request の field-level エラーを取得
            const data = await usernameResponse.json().catch(() => null) as
              | { errors?: Array<{ field?: string; message?: string }> }
              | null
            const usernameErr = data?.errors?.find(e => e.field === 'username')?.message
            if (usernameErr) {
              setUsernameError(localizeFieldError(usernameErr, t))
              setIsSaving(false)
              return
            }
          }
          throw new Error(ERROR_MESSAGES.FAILED_TO_UPDATE_USERNAME)
        }

        setIsEditingUsername(false)
        onUsernameUpdated?.(editingUsername)
      }

      // Issue#82: 画像アップロード（保存待ちの場合のみ）
      if (pendingImageBlob) {
        const blobType = pendingImageBlob.type || 'image/jpeg'
        const extension = blobType === 'image/png' ? 'png' : blobType === 'image/webp' ? 'webp' : 'jpg'

        const presignedResponse = await fetch(API_ENDPOINTS.PROFILE_IMAGE_PRESIGNED_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({ extension, contentType: blobType }),
        })

        if (presignedResponse.ok) {
          const { uploadUrl, objectKey } = await presignedResponse.json()

          const s3Response = await fetch(uploadUrl, {
            method: 'PUT',
            body: pendingImageBlob,
          })

          if (!s3Response.ok) {
            toast.error(ERROR_MESSAGES.FAILED_TO_REGISTER_PROFILE_IMAGE)
          } else {
            const registerResponse = await fetch(API_ENDPOINTS.PROFILE_IMAGE, {
              method: 'PUT',
              headers,
              body: JSON.stringify({ objectKey }),
            })

            if (!registerResponse.ok) {
              toast.error(ERROR_MESSAGES.FAILED_TO_REGISTER_PROFILE_IMAGE)
            } else {
              setPendingImageBlob(null)
            }
          }
        }
      }

      // Issue#82: 画像削除（削除フラグがある場合のみ）
      if (pendingImageDelete) {
        await fetch(API_ENDPOINTS.PROFILE_IMAGE, {
          method: 'DELETE',
          headers,
        })
        setPendingImageDelete(false)
      }

      // Issue#102: SNSリンクは SnsLinkEditDialog 内で直接保存するため、ここでは扱わない
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
    pendingImageBlob,
    pendingImageDelete,
    t,
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
    // Issue#82: 画像変更をリバート（hook内部の状態のみリセット）
    // ProfileDialogのクリーンアップeffectがUI状態をリセットするため
    // onImageUpdatedは呼ばない（呼ぶとisImagePendingDeleteが再設定される）
    if (pendingImageBlob || pendingImageDelete) {
      setPendingImageBlob(null)
      setPendingImageDelete(false)
    }
  }, [isEditingUsername, initialUsername, pendingImageBlob, pendingImageDelete])

  return {
    // 表示名編集
    isEditingUsername,
    editingUsername,
    usernameError,
    handleUsernameEditClick,
    handleUsernameChange,
    handleSaveUsername,

    // プロフィール画像
    fileInputRef,
    handleProfileImageSelect,
    handleDeleteProfileImage,

    // Issue#35: トリミング機能
    isCropperOpen,
    cropperImageSrc,
    handleCropComplete,
    handleCropCancel,

    // 統一保存機能
    hasUnsavedChanges,
    isSaving,
    handleSaveAllChanges,
    handleCancelAllChanges,
  }
}
