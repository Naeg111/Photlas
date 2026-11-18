import { useState, useEffect, useCallback } from 'react'
import { useRobotsNoindex } from '../hooks/useRobotsNoindex'
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
import { REPORT_REASON_I18N_KEYS, ROLE_ADMIN } from '../utils/codeConstants'
import { PhotoLightbox } from '../components/PhotoLightbox'

/**
 * Spec#54: 管理者モデレーションページ
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
  useRobotsNoindex()
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState<ModerationQueueItem[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  // エラーは翻訳キーで持ち、表示するときに t() する（fetchQueue を t に依存させず、言語の切り替えで再取得しないため）
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set())
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  const isAdmin = user?.role === ROLE_ADMIN

  const fetchQueue = useCallback(async () => {
    setIsLoading(true)
    setErrorKey(null)
    try {
      const response = await fetch(
        `${API_V1_URL}/admin/moderation/queue?size=${PAGE_SIZE}`,
        { headers: getAuthHeaders() }
      )
      if (!response.ok) {
        if (response.status === 403) {
          setErrorKey('admin.accessDenied')
          return
        }
        throw new Error(`failed to fetch moderation queue: ${response.status}`)
      }
      const data: ModerationQueueResponse = await response.json()
      setItems(data.content)
      setTotalElements(data.total_elements)
    } catch {
      setErrorKey('admin.moderation.fetchFailed')
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
      toast.success(t('admin.moderation.approveSuccess'))
      setItems(prev => prev.filter(item => item.photo_id !== photoId))
      setTotalElements(prev => prev - 1)
    } catch (e) {
      if (!notifyIfRateLimited(e, t)) {
        toast.error(t('admin.moderation.approveFailed'))
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
          // 理由は画面の文言ではなく DB に保存されるデータ（制裁の理由・投稿者への通知メールに使われる）。
          // 管理者の表示言語で変わらないよう、Spec#93 追加対応でも多言語化の対象外としている。
          // TODO(Spec#168): メールの理由が投稿者の言語にならない問題は Spec#168 で対応する。
          body: { reason: '利用規約違反' },
        }
      )
      toast.success(t('admin.moderation.rejectSuccess'))
      setItems(prev => prev.filter(item => item.photo_id !== photoId))
      setTotalElements(prev => prev - 1)
    } catch (e) {
      if (!notifyIfRateLimited(e, t)) {
        toast.error(t('admin.moderation.rejectFailed'))
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('admin.accessDenied')}</h1>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('admin.backToTop')}
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
            <h1 className="text-xl font-bold">{t('admin.moderation.title')}</h1>
          </div>
          <div className="text-sm text-gray-500">
            {t('admin.moderation.pendingCount', { total: totalElements })}
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

        {errorKey && (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{t(errorKey)}</p>
            <Button variant="outline" onClick={fetchQueue}>{t('admin.moderation.reload')}</Button>
          </div>
        )}

        {!isLoading && !errorKey && items.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {t('admin.moderation.empty')}
          </div>
        )}

        {!isLoading && !errorKey && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item => (
              <div
                key={item.photo_id}
                className="bg-white rounded-lg shadow overflow-hidden"
                data-testid={`moderation-item-${item.photo_id}`}
              >
                {/* Spec#89: 画像（サムネイル表示＋トグルボタン＋ライトボックス） */}
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
                    alt={t('admin.moderation.imageAlt')}
                    loading="lazy"
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
                    aria-label={revealedIds.has(item.photo_id) ? t('admin.moderation.blurApply') : t('admin.moderation.blurRemove')}
                  >
                    {revealedIds.has(item.photo_id) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>

                {/* 情報 */}
                <div className="p-4 space-y-2">
                  <h3 className="font-medium truncate text-sm text-gray-600">{item.created_at ? new Date(item.created_at).toLocaleString(i18n.language) : ''}</h3>
                  <p className="text-sm text-gray-500">
                    {t('admin.moderation.poster', { username: item.username, userId: item.user_id })}
                  </p>

                  {/* Spec#54: 通報情報 */}
                  {item.report_count > 0 && (
                    <div className="text-sm">
                      <p className="font-medium text-orange-600">{t('admin.moderation.reportCount', { total: item.report_count })}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.report_reasons.map((reason) => (
                          <span
                            key={reason}
                            className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded"
                          >
                            {REPORT_REASON_I18N_KEYS[reason] ? t(REPORT_REASON_I18N_KEYS[reason]) : reason}
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
                      {t('admin.moderation.approve')}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => handleReject(item.photo_id)}
                      disabled={processingIds.has(item.photo_id)}
                      data-testid={`reject-btn-${item.photo_id}`}
                    >
                      <X className="w-4 h-4 mr-1" />
                      {t('admin.moderation.reject')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Spec#89: ライトボックス */}
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
