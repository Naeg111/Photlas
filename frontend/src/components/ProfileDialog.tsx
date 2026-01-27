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
import { User, X as XIcon } from 'lucide-react'
import { useProfileEdit } from '../hooks/useProfileEdit'
import { getAuthHeaders } from '../utils/apiClient'

// API Endpoints
const API_FAVORITES = '/api/v1/users/me/favorites'

// Test IDs
const TEST_ID_FAVORITES_LOADING = 'favorites-loading'
const TEST_ID_FAVORITES_PAGINATION = 'favorites-pagination'
const TEST_ID_FAVORITE_PHOTO_PREFIX = 'favorite-photo-item-'

// Messages
const MSG_NO_FAVORITES = 'お気に入りはまだありません'

// SNSプラットフォーム定義
const SNS_PLATFORMS = [
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
] as const

// ページネーション定数
const PHOTOS_PER_PAGE = 20

interface SnsLink {
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

interface Photo {
  photoId: number
  title: string
  s3ObjectKey: string
  shotAt: string
  weather: string
  isFavorited: boolean
}

// Issue#30: お気に入り一覧API用インターフェース
interface FavoritePhoto {
  photo: {
    photo_id: number
    title: string
    thumbnail_url: string
  }
  favorited_at: string
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
  photos: Photo[]
  onPhotoClick: (photo: Photo) => void
  initialTab?: 'posts' | 'favorites'
}

/**
 * SNSアイコンを取得
 */
const getSnsIcon = (url: string) => {
  if (url.includes('x.com') || url.includes('twitter.com')) {
    return <XIcon className="w-5 h-5" />
  }
  if (url.includes('instagram.com')) {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
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
    return 'X.com'
  }
  if (url.includes('instagram.com')) {
    return 'Instagram'
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
  photos,
  onPhotoClick,
  initialTab = 'posts',
}) => {
  const [currentPage, setCurrentPage] = useState(1)

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
  const handleFavoritesTabClick = useCallback(() => {
    if (!favoritesFetched) {
      fetchFavorites()
    }
  }, [favoritesFetched, fetchFavorites])

  // initialTabがfavoritesの場合、ダイアログが開いたときにお気に入りを取得
  useEffect(() => {
    if (open && initialTab === 'favorites' && !favoritesFetched) {
      fetchFavorites()
    }
  }, [open, initialTab, favoritesFetched, fetchFavorites])

  // Issue#30: お気に入り写真がクリックされた時
  const handleFavoritePhotoClick = useCallback((favoritePhoto: FavoritePhoto) => {
    onPhotoClick({
      photoId: favoritePhoto.photo.photo_id,
      title: favoritePhoto.photo.title,
      s3ObjectKey: '',
      shotAt: '',
      weather: '',
      isFavorited: true,
    })
  }, [onPhotoClick])

  // カスタムフックを使用してプロフィール編集機能を取得
  const {
    isEditingUsername,
    editingUsername,
    usernameError,
    handleUsernameEditClick,
    handleUsernameChange,
    handleSaveUsername,
    isUploading,
    uploadSuccess,
    fileInputRef,
    handleProfileImageSelect,
    handleDeleteProfileImage,
    isEditingSnsLinks,
    setIsEditingSnsLinks,
    handleSaveSnsLinks,
  } = useProfileEdit({
    initialUsername: userProfile.username,
    snsLinks: userProfile.snsLinks,
  })

  // ページネーション計算
  const totalPages = Math.ceil(photos.length / PHOTOS_PER_PAGE)
  const startIndex = (currentPage - 1) * PHOTOS_PER_PAGE
  const endIndex = startIndex + PHOTOS_PER_PAGE
  const currentPhotos = photos.slice(startIndex, endIndex)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>プロフィール</DialogTitle>
          <DialogDescription className="sr-only">ユーザープロフィール情報</DialogDescription>
        </DialogHeader>

        {/* プロフィールセクション */}
        <div className="flex flex-col items-center mb-6">
          {/* プロフィール画像 */}
          <div className="relative mb-4">
            {userProfile.profileImageUrl ? (
              <img
                src={userProfile.profileImageUrl}
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

          {/* 画像を選択ボタン（自分のプロフィールのみ） */}
          {isOwnProfile && (
            <>
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
                className="mb-2"
                onClick={() => fileInputRef.current?.click()}
              >
                画像を選択
              </Button>
              {userProfile.profileImageUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-2 text-red-500"
                  data-testid="delete-profile-image-button"
                  onClick={handleDeleteProfileImage}
                >
                  画像を削除
                </Button>
              )}
              {isUploading && (
                <div data-testid="upload-progress" className="text-sm text-gray-500">
                  アップロード中...
                </div>
              )}
              {uploadSuccess && (
                <div data-testid="upload-success" className="text-sm text-green-500">
                  アップロード完了
                </div>
              )}
            </>
          )}

          {/* ユーザー名 */}
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="flex items-center gap-2">
              {isEditingUsername ? (
                <>
                  <Input
                    data-testid="username-input"
                    value={editingUsername}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    className="w-48"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="default"
                    data-testid="save-username-button"
                    onClick={handleSaveUsername}
                  >
                    保存
                  </Button>
                </>
              ) : (
                <h2 className="text-2xl font-bold">{userProfile.username}</h2>
              )}
              {isOwnProfile && !isEditingUsername && (
                <Button size="sm" variant="outline" onClick={handleUsernameEditClick}>
                  変更
                </Button>
              )}
            </div>
            {usernameError && <p className="text-sm text-red-500">{usernameError}</p>}
          </div>

          {/* SNSリンク */}
          {!isEditingSnsLinks && userProfile.snsLinks.length > 0 && (
            <div className="flex gap-4 mt-2">
              {userProfile.snsLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={getSnsLabel(link.url)}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                  role="link"
                >
                  {getSnsIcon(link.url)}
                </a>
              ))}
            </div>
          )}

          {/* SNSリンク編集ボタン（自分のプロフィールのみ） */}
          {isOwnProfile && !isEditingSnsLinks && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              data-testid="edit-sns-links-button"
              onClick={() => setIsEditingSnsLinks(true)}
            >
              SNSリンクを編集
            </Button>
          )}

          {/* SNSリンク編集モード */}
          {isOwnProfile && isEditingSnsLinks && (
            <div className="w-full max-w-md mt-4 space-y-4">
              <div className="flex gap-2">
                <select
                  data-testid="sns-platform-select"
                  className="flex-1 border rounded-md px-3 py-2"
                >
                  {SNS_PLATFORMS.map((platform) => (
                    <option key={platform.value} value={platform.value}>
                      {platform.label}
                    </option>
                  ))}
                </select>
                <Input placeholder="URL" className="flex-1" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setIsEditingSnsLinks(false)}>
                  キャンセル
                </Button>
                <Button size="sm" data-testid="save-sns-links-button" onClick={handleSaveSnsLinks}>
                  保存
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* タブUI */}
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="posts" className="flex-1">
              投稿
            </TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="favorites" className="flex-1" onClick={handleFavoritesTabClick}>
                お気に入り
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            {/* 写真グリッド */}
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
              data-testid="photo-grid"
            >
              {currentPhotos.map((photo) => (
                <div
                  key={photo.photoId}
                  data-testid={`photo-item-${photo.photoId}`}
                  onClick={() => onPhotoClick(photo)}
                  className="relative pt-[100%] bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="absolute inset-0 flex items-center justify-center p-2">
                    <span className="text-xs text-gray-500 text-center line-clamp-2">
                      {photo.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* ページネーション */}
            {photos.length > PHOTOS_PER_PAGE && (
              <div className="mt-6" data-testid="pagination">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className={
                          currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className={
                          currentPage === totalPages
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="favorites" className="mt-4">
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
                    {favorites.map((favorite) => (
                      <div
                        key={favorite.photo.photo_id}
                        data-testid={`${TEST_ID_FAVORITE_PHOTO_PREFIX}${favorite.photo.photo_id}`}
                        onClick={() => handleFavoritePhotoClick(favorite)}
                        className="relative pt-[100%] bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <div className="absolute inset-0 flex items-center justify-center p-2">
                          <span className="text-xs text-gray-500 text-center line-clamp-2">
                            {favorite.photo.title}
                          </span>
                        </div>
                      </div>
                    ))}
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

      </DialogContent>
    </Dialog>
  )
}

export default ProfileDialog
