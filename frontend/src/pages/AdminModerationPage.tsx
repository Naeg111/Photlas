import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { API_V1_URL } from '../config/api'
import { getAuthHeaders } from '../utils/apiClient'
import { fetchJson } from '../utils/fetchJson'
import { notifyIfRateLimited } from '../utils/notifyIfRateLimited'
import { Button } from '../components/ui/button'
import { ArrowLeft, Check, X, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '../components/ui/sonner'
import { REPORT_REASON_LABELS, ROLE_ADMIN } from '../utils/codeConstants'
import { PhotoLightbox } from '../components/PhotoLightbox'

/**
 * Issue#54: 管理者モデレーションページ
 * 隔離キューの写真を承認・拒否する管理画面
 */

interface ModerationQueueItem {
  photo_id: number
  image_url: string
  thumbnail_url: string | null
  user_id: number
  username: string
  created_at: string | null
  report_count: number
  report_reasons: number[]
}

interface ModerationQueueResponse {
  content: ModerationQueueItem[]
  total_elements: number
  total_pages: number
}

const PAGE_SIZE = 20

export default function AdminModerationPage() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [items, setItems] = useState<ModerationQueueItem[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set())
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  const isAdmin = user?.role === ROLE_ADMIN

  const fetchQueue = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `${API_V1_URL}/admin/moderation/queue?size=${PAGE_SIZE}`,
        { headers: getAuthHeaders() }
      )
      if (!response.ok) {
        if (response.status === 403) {
          setError('アクセス権限がありません')
          return
        }
        throw new Error('キューの取得に失敗しました')
      }
      const data: ModerationQueueResponse = await response.json()
      setItems(data.content)
      setTotalElements(data.total_elements)
    } catch {
      setError('キューの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchQueue()
    }
  }, [isAuthenticated, isAdmin, fetchQueue])

  const handleApprove = async (photoId: number) => {
    setProcessingIds(prev => new Set(prev).add(photoId))
    try {
      await fetchJson(
        `${API_V1_URL}/admin/moderation/photos/${photoId}/approve`,
        { method: 'POST', headers: getAuthHeaders() as Record<string, string> }
      )
      toast.success('写真を承認しました')
      setItems(prev => prev.filter(item => item.photo_id !== photoId))
      setTotalElements(prev => prev - 1)
    } catch (e) {
      if (!notifyIfRateLimited(e, t)) {
        toast.error('承認に失敗しました')
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(photoId)
        return next
      })
    }
  }

  const handleReject = async (photoId: number) => {
    setProcessingIds(prev => new Set(prev).add(photoId))
    try {
      await fetchJson(
        `${API_V1_URL}/admin/moderation/photos/${photoId}/reject`,
        {
          method: 'POST',
          headers: getAuthHeaders() as Record<string, string>,
          body: { reason: '利用規約違反' },
        }
      )
      toast.success('写真を拒否しました')
      setItems(prev => prev.filter(item => item.photo_id !== photoId))
      setTotalElements(prev => prev - 1)
    } catch (e) {
      if (!notifyIfRateLimited(e, t)) {
        toast.error('拒否に失敗しました')
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(photoId)
        return next
      })
    }
  }

  // 未認証 or 非管理者
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Toaster />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">アクセス権限がありません</h1>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            トップに戻る
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />
      {/* ヘッダー */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">モデレーション管理</h1>
          </div>
          <div className="text-sm text-gray-500">
            {totalElements}件の審査待ち
          </div>
        </div>
      </header>

      {/* コンテンツ */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={fetchQueue}>再読み込み</Button>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            審査待ちの写真はありません
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item => (
              <div
                key={item.photo_id}
                className="bg-white rounded-lg shadow overflow-hidden"
                data-testid={`moderation-item-${item.photo_id}`}
              >
                {/* Issue#89: 画像（サムネイル表示＋トグルボタン＋ライトボックス） */}
                <div
                  role="button" tabIndex={0}
                  className={`aspect-square relative overflow-hidden ${revealedIds.has(item.photo_id) ? 'cursor-pointer' : 'cursor-default'}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && revealedIds.has(item.photo_id)) {
                      setSelectedImageUrl(item.image_url)
                      setIsLightboxOpen(true)
                    }
                  }}
                  onClick={() => {
                    if (revealedIds.has(item.photo_id)) {
                      setSelectedImageUrl(item.image_url)
                      setIsLightboxOpen(true)
                    }
                  }}
                  data-testid={`moderation-image-container-${item.photo_id}`}
                >
                  <img
                    src={item.thumbnail_url || item.image_url}
                    alt="画像"
                    className={`w-full h-full object-cover transition-all duration-300 ${
                      revealedIds.has(item.photo_id) ? '' : 'blur-lg'
                    }`}
                    data-testid={`moderation-image-${item.photo_id}`}
                  />
                  {/* ぼかしトグルボタン */}
                  <button
                    className="absolute bottom-2 right-2 p-1.5 rounded bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRevealedIds(prev => {
                        const next = new Set(prev)
                        if (next.has(item.photo_id)) next.delete(item.photo_id)
                        else next.add(item.photo_id)
                        return next
                      })
                    }}
                    data-testid={`blur-toggle-${item.photo_id}`}
                    aria-label={revealedIds.has(item.photo_id) ? 'ぼかしを適用' : 'ぼかしを解除'}
                  >
                    {revealedIds.has(item.photo_id) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>

                {/* 情報 */}
                <div className="p-4 space-y-2">
                  <h3 className="font-medium truncate text-sm text-gray-600">{item.created_at ? new Date(item.created_at).toLocaleString('ja-JP') : ''}</h3>
                  <p className="text-sm text-gray-500">
                    投稿者: {item.username} (ID: {item.user_id})
                  </p>

                  {/* Issue#54: 通報情報 */}
                  {item.report_count > 0 && (
                    <div className="text-sm">
                      <p className="font-medium text-orange-600">通報 {item.report_count}件</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.report_reasons.map((reason) => (
                          <span
                            key={reason}
                            className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded"
                          >
                            {REPORT_REASON_LABELS[reason] || reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* アクションボタン */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 text-green-600 border-green-300 hover:bg-green-50"
                      onClick={() => handleApprove(item.photo_id)}
                      disabled={processingIds.has(item.photo_id)}
                      data-testid={`approve-btn-${item.photo_id}`}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      承認
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => handleReject(item.photo_id)}
                      disabled={processingIds.has(item.photo_id)}
                      data-testid={`reject-btn-${item.photo_id}`}
                    >
                      <X className="w-4 h-4 mr-1" />
                      拒否
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Issue#89: ライトボックス */}
      <PhotoLightbox
        open={isLightboxOpen}
        onOpenChange={(open) => {
          setIsLightboxOpen(open)
          if (!open) setSelectedImageUrl('')
        }}
        imageUrl={selectedImageUrl}
      />
    </div>
  )
}
