import { useState, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination'
import { User, Flag } from 'lucide-react'
import { toast } from 'sonner'
import { useProfileEdit } from '../hooks/useProfileEdit'
import { useAuth } from '../contexts/AuthContext'
import { getAuthHeaders } from '../utils/apiClient'
import ProfileImageCropper from './ProfileImageCropper'
import { ReportDialog } from './ReportDialog'
import { SnsLinkEditDialog } from './SnsLinkEditDialog'
import { ProtectedImage } from './figma/ProtectedImage'
import { ImageWithFallback } from './figma/ImageWithFallback'

// API Endpoints
const API_MY_PROFILE = '/api/v1/users/me'
const API_USER_PROFILE_PREFIX = '/api/v1/users/'
const API_FAVORITES = '/api/v1/users/me/favorites'
const API_MY_PHOTOS = '/api/v1/users/me/photos'
const API_USER_PHOTOS_PREFIX = '/api/v1/users/'

// Test IDs
const TEST_ID_FAVORITES_LOADING = 'favorites-loading'
const TEST_ID_FAVORITES_PAGINATION = 'favorites-pagination'
const TEST_ID_FAVORITE_PHOTO_PREFIX = 'favorite-photo-item-'
const TEST_ID_POSTS_LOADING = 'posts-loading'
const TEST_ID_POSTS_PHOTO_PREFIX = 'post-photo-item-'

// Messages
const MSG_NO_FAVORITES = 'お気に入りはまだありません'
const MSG_NO_POSTS = 'まだ投稿がありません'

// ページネーション定数
const PHOTOS_PER_PAGE = 20

interface SnsLink {
  id?: string
  url: string
  platform?: string
}

interface UserProfile {
  userId: number
  username: string
  email?: string
  profileImageUrl: string | null
  snsLinks: SnsLink[]
}

// ユーザー投稿写真APIレスポンスの型定義
interface UserPhotoItem {
  photo: {
    photo_id: number
    image_url: string
    thumbnail_url?: string | null
    crop_center_x?: number | null
    crop_center_y?: number | null
    crop_zoom?: number | null
  }
  spot: {
    spot_id: number
  }
}

interface UserPhotosResponse {
  content: UserPhotoItem[]
  total_elements: number
  total_pages?: number
  pageable: {
    page_number: number
    page_size: number
  }
  last?: boolean
}

// Issue#30: お気に入り一覧API用インターフェース
interface FavoritePhoto {
  photo: {
    photo_id: number
    image_url: string
    thumbnail_url?: string | null
    crop_center_x?: number
    crop_center_y?: number
    crop_zoom?: number
  }
  spot: {
    spot_id: number
  }
  user: {
    user_id: number
    username: string
  }
}

interface FavoritesResponse {
  content: FavoritePhoto[]
  total_elements: number
  total_pages?: number
  pageable: {
    page_number: number
    page_size: number
  }
  last?: boolean
}

interface ProfileDialogProps {
  open: boolean
  onClose: () => void
  userProfile: UserProfile
  isOwnProfile: boolean
  /** Issue#77: 写真クリック時にphotoIdを渡すコールバック */
  onPhotoClick?: (photoId: number) => void
  initialTab?: 'posts' | 'favorites'
}

/**
 * SNSアイコンを取得
 */
const getSnsIcon = (url: string) => {
  if (url.includes('x.com') || url.includes('twitter.com')) {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  }
  if (url.includes('instagram.com')) {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    )
  }
  if (url.includes('tiktok.com')) {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.83a4.83 4.83 0 0 1-1-.14z" />
      </svg>
    )
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    )
  }
  return null
}

/**
 * SNSラベルを取得
 */
const getSnsLabel = (url: string) => {
  if (url.includes('x.com') || url.includes('twitter.com')) {
    return 'X'
  }
  if (url.includes('instagram.com')) {
    return 'Instagram'
  }
  if (url.includes('tiktok.com')) {
    return 'TikTok'
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'YouTube'
  }
  return 'Link'
}

/**
 * プロフィールダイアログコンポーネント
 * Issue#29: プロフィール機能強化
 */
const ProfileDialog: React.FC<ProfileDialogProps> = ({
  open,
  onClose,
  userProfile,
  isOwnProfile,
  onPhotoClick,
  initialTab = 'posts',
}) => {
  // プロフィール画像とSNSリンクのローカルステート（即時反映用）
  const [localProfileImageUrl, setLocalProfileImageUrl] = useState<string | null>(null)
  const [localSnsLinks, setLocalSnsLinks] = useState<SnsLink[] | null>(null)

  // APIから取得したプロフィール画像URL
  const [fetchedProfileImageUrl, setFetchedProfileImageUrl] = useState<string | null>(null)

  // 画像削除保留フラグ（削除ボタン押下後、デフォルトアバターを表示するため）
  const [isImagePendingDelete, setIsImagePendingDelete] = useState(false)

  // 実際に表示する値（削除保留時はnull、それ以外はローカル編集 > API取得 > props の優先順位）
  const displayProfileImageUrl = isImagePendingDelete ? null : (localProfileImageUrl ?? fetchedProfileImageUrl ?? userProfile.profileImageUrl)
  const displaySnsLinks = localSnsLinks ?? userProfile.snsLinks

  // Issue#79: ダイアログopen時にプロフィール画像URLをAPIから取得
  useEffect(() => {
    if (!open || displayProfileImageUrl) return

    const fetchProfile = async () => {
      try {
        const url = isOwnProfile
          ? API_MY_PROFILE
          : `${API_USER_PROFILE_PREFIX}${userProfile.userId}`
        const headers: HeadersInit = isOwnProfile ? getAuthHeaders() : {}
        const response = await fetch(url, { headers })
        if (response.ok) {
          const data = await response.json()
          if (data.profileImageUrl) {
            setFetchedProfileImageUrl(data.profileImageUrl)
          }
        }
      } catch {
        // プロフィール画像取得失敗時はフォールバック表示のまま
      }
    }
    fetchProfile()
  }, [open, isOwnProfile, userProfile.userId, displayProfileImageUrl])

  // ユーザー投稿一覧の状態
  const [userPhotos, setUserPhotos] = useState<UserPhotoItem[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photosFetched, setPhotosFetched] = useState(false)
  const [photosTotalPages, setPhotosTotalPages] = useState(0)
  const [photosPage, setPhotosPage] = useState(0)

  // ユーザー投稿一覧を取得
  const fetchUserPhotos = useCallback(async (page = 0) => {
    setPhotosLoading(true)
    try {
      const url = isOwnProfile
        ? `${API_MY_PHOTOS}?page=${page}&size=${PHOTOS_PER_PAGE}`
        : `${API_USER_PHOTOS_PREFIX}${userProfile.userId}/photos?page=${page}&size=${PHOTOS_PER_PAGE}`
      const headers: HeadersInit = isOwnProfile ? getAuthHeaders() : {}
      const response = await fetch(url, { headers })
      if (response.ok) {
        const data: UserPhotosResponse = await response.json()
        setUserPhotos(data.content)
        setPhotosTotalPages(data.total_pages ?? Math.ceil(data.total_elements / PHOTOS_PER_PAGE))
        setPhotosPage(data.pageable.page_number)
        setPhotosFetched(true)
      }
    } catch {
      // エラー時は空配列のまま
    } finally {
      setPhotosLoading(false)
    }
  }, [isOwnProfile, userProfile.userId])

  // Issue#80: ダイアログが閉じたら取得済みフラグをリセット（再度開いた時に再取得させる）
  useEffect(() => {
    if (!open) {
      setPhotosFetched(false)
      setIsImagePendingDelete(false)
      setLocalProfileImageUrl(null)
      setFetchedProfileImageUrl(null)
    }
  }, [open])

  // ダイアログが開いたときに投稿一覧を取得
  useEffect(() => {
    if (open && !photosFetched) {
      fetchUserPhotos()
    }
  }, [open, photosFetched, fetchUserPhotos])

  // Issue#30: お気に入り一覧状態
  const [favorites, setFavorites] = useState<FavoritePhoto[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [favoritesFetched, setFavoritesFetched] = useState(false)
  const [favoritesTotalPages, setFavoritesTotalPages] = useState(0)
  const [favoritesPage, setFavoritesPage] = useState(0)

  // Issue#30: お気に入り一覧を取得
  const fetchFavorites = useCallback(async (page = 0) => {
    setFavoritesLoading(true)
    try {
      const response = await fetch(`${API_FAVORITES}?page=${page}&size=20`, {
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        const data: FavoritesResponse = await response.json()
        setFavorites(data.content)
        setFavoritesTotalPages(data.total_pages ?? Math.ceil(data.total_elements / 20))
        setFavoritesPage(data.pageable.page_number)
        setFavoritesFetched(true)
      }
    } catch {
      // エラー時は空配列のまま
    } finally {
      setFavoritesLoading(false)
    }
  }, [])

  // Issue#30: お気に入りタブがクリックされた時
  // Issue#72: タブをcontrolled化（E2Eテストの安定性向上）
  const [activeTab, setActiveTab] = useState(initialTab)

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as 'posts' | 'favorites')
    if (value === 'favorites' && !favoritesFetched) {
      fetchFavorites()
    }
  }, [favoritesFetched, fetchFavorites])

  // initialTabがfavoritesの場合、ダイアログが開いたときにお気に入りを取得
  useEffect(() => {
    if (open && initialTab === 'favorites' && !favoritesFetched) {
      fetchFavorites()
    }
  }, [open, initialTab, favoritesFetched, fetchFavorites])

  // SNSリンク編集ダイアログ状態管理
  const [isSnsEditDialogOpen, setIsSnsEditDialogOpen] = useState(false)

  // Issue#54: プロフィール通報状態管理
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isReportLoading, setIsReportLoading] = useState(false)

  const handleProfileReport = useCallback(async (data: { reason: string; details?: string }) => {
    setIsReportLoading(true)
    try {
      const response = await fetch(`/api/v1/users/${userProfile.userId}/report`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: data.reason, details: data.details }),
      })

      if (response.ok || response.status === 409 || response.status === 400) {
        setIsReportOpen(false)
      }
    } catch {
      // エラー時は何もしない
    } finally {
      setIsReportLoading(false)
    }
  }, [userProfile.userId])

  // 写真クリックハンドラー（spotIdを渡してPhotoDetailDialogを開く）
  const handlePhotoClick = useCallback((photoId: number) => {
    onPhotoClick?.(photoId)
  }, [onPhotoClick])

  // SNSリンク保存ハンドラー（ダイアログから呼び出される）
  const handleSaveSnsLinksFromDialog = useCallback(async (newLinks: Array<{ platform: string; url: string }>) => {
    try {
      const response = await fetch('/api/v1/users/me/sns-links', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ snsLinks: newLinks }),
      })

      if (response.ok) {
        setLocalSnsLinks(newLinks.map(l => ({ url: l.url, platform: l.platform })))
      }
    } catch {
      // エラー時は何もしない
    }
  }, [])

  // カスタムフックを使用してプロフィール編集機能を取得
  // Issue#36: AuthContextからupdateUserを取得
  const { updateUser } = useAuth()

  const {
    isEditingUsername,
    editingUsername,
    usernameError,
    handleUsernameEditClick,
    handleUsernameChange,
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
  } = useProfileEdit({
    initialUsername: userProfile.username,
    snsLinks: userProfile.snsLinks,
    // Issue#36: ユーザー名更新成功時にAuthContextを更新
    onUsernameUpdated: (newUsername) => {
      updateUser({ username: newUsername })
    },
    // プロフィール画像更新時にローカルステートを更新
    onImageUpdated: (previewUrl) => {
      if (previewUrl === null) {
        setLocalProfileImageUrl(null)
        setIsImagePendingDelete(true)
      } else {
        setLocalProfileImageUrl(previewUrl)
        setIsImagePendingDelete(false)
      }
    },
    // SNSリンク保存成功時にローカルステートを更新
    onSnsLinksUpdated: (newLinks) => {
      setLocalSnsLinks(newLinks)
    },
  })

  // ダイアログが閉じたら未保存の編集状態をリセット
  useEffect(() => {
    if (!open) {
      handleCancelAllChanges()
    }
  }, [open, handleCancelAllChanges])

  // 保存ボタンクリック時のラッパー（トースト通知付き）
  const handleSave = useCallback(async () => {
    toast('保存中...')
    await handleSaveAllChanges()
  }, [handleSaveAllChanges])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] min-h-[80vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '80dvh', minHeight: '80dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>プロフィール</DialogTitle>
            <DialogDescription className="sr-only">ユーザープロフィール情報</DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        {/* プロフィールセクション */}
        <div className="flex flex-col mb-[36px] mt-4">
          {/* プロフィール画像エリア */}
          <div className="flex mb-[36px]">
            {/* 左半分：プロフィール画像（中央配置） */}
            <div className="flex-1 flex justify-center">
              <div className="shrink-0">
                {displayProfileImageUrl ? (
                  <ProtectedImage
                    src={displayProfileImageUrl}
                    alt={userProfile.username}
                    className="w-28 h-28 rounded-full object-cover"
                  />
                ) : (
                  <Avatar className="w-28 h-28">
                    <AvatarFallback>
                      <User data-testid="default-avatar-icon" className="w-14 h-14" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>

            {/* 右半分：画像選択・削除ボタン（中央配置・上下中央） */}
            {isOwnProfile && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageSelect}
                  className="hidden"
                  data-testid="profile-image-input"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  画像を選択
                </Button>
                {displayProfileImageUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500"
                    data-testid="delete-profile-image-button"
                    onClick={handleDeleteProfileImage}
                  >
                    画像を削除
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* ユーザー名 */}
          <div className="flex flex-col gap-2 mb-[14px]">
            <label htmlFor="profile-username" className="text-sm font-medium text-gray-700">アカウント名</label>
            <div className="flex items-center justify-between gap-2">
              {isEditingUsername ? (
                <Input
                  id="profile-username"
                  data-testid="username-input"
                  value={editingUsername}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
              ) : (
                <>
                  <h2 className="text-2xl font-bold">{userProfile.username}</h2>
                  {isOwnProfile && (
                    <Button size="sm" variant="outline" onClick={handleUsernameEditClick}>
                      変更
                    </Button>
                  )}
                  {/* Issue#54: プロフィール通報ボタン（他人のプロフィールのみ） */}
                  {!isOwnProfile && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsReportOpen(true)}
                      aria-label="このプロフィールを通報"
                    >
                      <Flag className="w-4 h-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
            {usernameError && <p className="text-sm text-red-500">{usernameError}</p>}
          </div>

          {/* Issue#54: プロフィール通報ダイアログ */}
          <ReportDialog
            open={isReportOpen}
            onOpenChange={setIsReportOpen}
            onSubmit={handleProfileReport}
            isLoading={isReportLoading}
          />

          {/* SNSリンク */}
          {displaySnsLinks.length > 0 && (
            <div className="flex gap-4">
              {displaySnsLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={getSnsLabel(link.url)}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {getSnsIcon(link.url)}
                </a>
              ))}
            </div>
          )}

          {/* SNSリンク編集ボタン（自分のプロフィールのみ） */}
          {isOwnProfile && (
            <div className="flex justify-center mt-2">
              <Button
                variant="ghost"
                size="sm"
                data-testid="edit-sns-links-button"
                onClick={() => setIsSnsEditDialogOpen(true)}
              >
                SNSリンクを編集
              </Button>
            </div>
          )}

          {/* 統一保存ボタン（編集中の場合のみ表示） */}
          {isOwnProfile && hasUnsavedChanges && (
            <div className="flex justify-center gap-4 mt-4">
              <Button
                variant="outline"
                onClick={handleCancelAllChanges}
                disabled={isSaving}
              >
                キャンセル
              </Button>
              <Button
                data-testid="save-all-changes-button"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? '保存中...' : '保存'}
              </Button>
            </div>
          )}
        </div>

        {/* タブUI */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="posts" className="flex-1 data-[state=active]:!bg-black data-[state=active]:!text-white data-[state=active]:rounded-lg">
              投稿
            </TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="favorites" className="flex-1 data-[state=active]:!bg-black data-[state=active]:!text-white data-[state=active]:rounded-lg">
                お気に入り
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="posts" className="mt-4 data-[state=inactive]:hidden" forceMount>
            {/* ローディング表示 */}
            {photosLoading && (
              <div
                data-testid={TEST_ID_POSTS_LOADING}
                className="flex items-center justify-center py-8"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            )}

            {/* 投稿なしメッセージ */}
            {!photosLoading && photosFetched && userPhotos.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {MSG_NO_POSTS}
              </div>
            )}

            {/* 写真グリッド */}
            {!photosLoading && userPhotos.length > 0 && (
              <>
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
                  data-testid="photo-grid"
                >
                  {userPhotos.map((item) => {
                    const cx = item.photo.crop_center_x ?? 0.5
                    const cy = item.photo.crop_center_y ?? 0.5
                    const zoom = item.photo.crop_zoom ?? 1
                    return (
                      <div
                        key={item.photo.photo_id}
                        data-testid={`${TEST_ID_POSTS_PHOTO_PREFIX}${item.photo.photo_id}`}
                        role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") handlePhotoClick(item.photo.photo_id) }} onClick={() => handlePhotoClick(item.photo.photo_id)}
                        className="relative pt-[100%] bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <ImageWithFallback
                          src={item.photo.thumbnail_url || item.photo.image_url}
                          fallbackSrc={item.photo.image_url}
                          data-fallback-src={item.photo.image_url}
                          alt="画像"
                          className="absolute inset-0 w-full h-full"
                          style={{
                            objectFit: 'cover',
                            objectPosition: `${cx * 100}% ${cy * 100}%`,
                            transform: `scale(${zoom})`,
                            transformOrigin: `${cx * 100}% ${cy * 100}%`,
                          }}
                        />
                      </div>
                    )
                  })}
                </div>

                {/* 投稿一覧ページネーション */}
                {photosTotalPages > 1 && (
                  <div className="mt-6" data-testid="posts-pagination">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => fetchUserPhotos(Math.max(0, photosPage - 1))}
                            className={
                              photosPage === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                            }
                          />
                        </PaginationItem>
                        {Array.from({ length: photosTotalPages }, (_, i) => i).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => fetchUserPhotos(page)}
                              isActive={photosPage === page}
                              className="cursor-pointer"
                            >
                              {page + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => fetchUserPhotos(Math.min(photosTotalPages - 1, photosPage + 1))}
                            className={
                              photosPage === photosTotalPages - 1
                                ? 'pointer-events-none opacity-50'
                                : 'cursor-pointer'
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="favorites" className="mt-4 data-[state=inactive]:hidden" forceMount>
              {/* Issue#30: お気に入り一覧 */}
              {favoritesLoading && (
                <div
                  data-testid={TEST_ID_FAVORITES_LOADING}
                  className="flex items-center justify-center py-8"
                >
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              )}

              {!favoritesLoading && favoritesFetched && favorites.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {MSG_NO_FAVORITES}
                </div>
              )}

              {!favoritesLoading && favorites.length > 0 && (
                <>
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
                    data-testid="favorites-grid"
                  >
                    {favorites.map((favorite) => {
                      const cx = favorite.photo.crop_center_x ?? 0.5
                      const cy = favorite.photo.crop_center_y ?? 0.5
                      const zoom = favorite.photo.crop_zoom ?? 1
                      return (
                        <div
                          key={favorite.photo.photo_id}
                          data-testid={`${TEST_ID_FAVORITE_PHOTO_PREFIX}${favorite.photo.photo_id}`}
                          onClick={() => handlePhotoClick(favorite.photo.photo_id)}
                          className="relative pt-[100%] bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          <ImageWithFallback
                            src={favorite.photo.thumbnail_url || favorite.photo.image_url}
                            fallbackSrc={favorite.photo.image_url}
                            data-fallback-src={favorite.photo.image_url}
                            alt="画像"
                            className="absolute inset-0 w-full h-full"
                            style={{
                              objectFit: 'cover',
                              objectPosition: `${cx * 100}% ${cy * 100}%`,
                              transform: `scale(${zoom})`,
                              transformOrigin: `${cx * 100}% ${cy * 100}%`,
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* お気に入りページネーション */}
                  {favoritesTotalPages > 1 && (
                    <div className="mt-6" data-testid={TEST_ID_FAVORITES_PAGINATION}>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => fetchFavorites(Math.max(0, favoritesPage - 1))}
                              className={
                                favoritesPage === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                              }
                            />
                          </PaginationItem>
                          {Array.from({ length: favoritesTotalPages }, (_, i) => i).map((page) => (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => fetchFavorites(page)}
                                isActive={favoritesPage === page}
                                className="cursor-pointer"
                              >
                                {page + 1}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => fetchFavorites(Math.min(favoritesTotalPages - 1, favoritesPage + 1))}
                              className={
                                favoritesPage === favoritesTotalPages - 1
                                  ? 'pointer-events-none opacity-50'
                                  : 'cursor-pointer'
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* Issue#35: トリミングモーダル */}
        {isCropperOpen && (
          <ProfileImageCropper
            imageSrc={cropperImageSrc}
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
          />
        )}

        {/* SNSリンク編集ダイアログ */}
        <SnsLinkEditDialog
          open={isSnsEditDialogOpen}
          onOpenChange={setIsSnsEditDialogOpen}
          initialLinks={displaySnsLinks}
          onSave={async (newLinks) => {
            await handleSaveSnsLinksFromDialog(newLinks)
          }}
        />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ProfileDialog
