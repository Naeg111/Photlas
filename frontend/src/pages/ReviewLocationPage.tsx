import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Map, { Marker } from 'react-map-gl'
import { MapPin, Calendar } from 'lucide-react'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'
import { PinSvg } from '../components/PinSvg'
import { LoginDialog } from '../components/LoginDialog'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, getAuthHeaders } from '../utils/apiClient'
import { fetchJson } from '../utils/fetchJson'
import { getRateLimitInlineMessage } from '../utils/notifyIfRateLimited'
import { API_V1_URL } from '../config/api'

/**
 * Issue#65, Issue#54: 位置情報修正のレビューページ（ダイアログスタイル）
 */

interface ReviewData {
  suggestionId: number
  currentLatitude: number
  currentLongitude: number
  suggestedLatitude: number
  suggestedLongitude: number
  photoTitle: string
  imageUrl: string
  thumbnailUrl: string
  username: string
  placeName: string
  shotAt: string
  cropCenterX: number | null
  cropCenterY: number | null
  cropZoom: number | null
}

export default function ReviewLocationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const token = searchParams.get('token')
  const { user } = useAuth()

  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isResolved, setIsResolved] = useState(false)
  const [resolvedMessage, setResolvedMessage] = useState('')
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false)
  const [isSpotPreview, setIsSpotPreview] = useState(false)

  useEffect(() => {
    if (!token || !user) return

    const fetchReviewData = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `${API_V1_URL}/location-suggestions/review?token=${token}`,
          {
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json',
            },
          }
        )
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.message || t('reviewLocation.fetchFailed'))
        }
        const data = await response.json()
        setReviewData(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('reviewLocation.fetchFailed'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchReviewData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user])

  const handleAction = async (action: 'accept' | 'reject') => {
    if (!token) return
    setIsLoading(true)
    try {
      await fetchJson(
        `${API_V1_URL}/location-suggestions/review/${action}?token=${token}`,
        {
          method: 'POST',
          headers: getAuthHeaders() as Record<string, string>,
        }
      )
      setIsResolved(true)
      setResolvedMessage(
        action === 'accept'
          ? t('reviewLocation.accepted')
          : t('reviewLocation.rejected')
      )
    } catch (e) {
      if (e instanceof ApiError && e.isRateLimited) {
        setError(getRateLimitInlineMessage(e, t))
      } else {
        setError(t('reviewLocation.processFailed'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    navigate('/')
  }

  const formatShotAt = (shotAt: string) => {
    try {
      const date = new Date(shotAt)
      return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    } catch {
      return shotAt
    }
  }

  // トークンなし
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black/50">
        <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
          <p className="text-lg text-red-600">{t('pages.invalidLink')}</p>
        </div>
      </div>
    )
  }

  // 未ログイン
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg">{t('auth.loginRequired')}</p>
        <p className="text-sm text-gray-600">{t('reviewLocation.loginRequired')}</p>
        <button
          className="px-4 py-2 bg-black text-white rounded-full"
          onClick={() => setIsLoginDialogOpen(true)}
        >
          {t('common.login')}
        </button>
        <LoginDialog
          open={isLoginDialogOpen}
          onOpenChange={setIsLoginDialogOpen}
          onShowSignUp={() => setIsLoginDialogOpen(false)}
          onShowPasswordReset={() => setIsLoginDialogOpen(false)}
        />
      </div>
    )
  }

  // フルスクリーンマップ（撮影場所プレビュー）
  if (isSpotPreview && reviewData) {
    return (
      <div
        className="fixed inset-0 z-50"
        onClick={() => setIsSpotPreview(false)}
        data-testid="spot-preview-overlay"
      >
        <Map
          mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
          initialViewState={{
            latitude: reviewData.suggestedLatitude,
            longitude: reviewData.suggestedLongitude,
            zoom: 16,
          }}
          mapStyle={MAPBOX_STYLE}
          style={{ width: '100%', height: '100%' }}
        >
          {/* 現在の撮影地点（赤） */}
          <Marker latitude={reviewData.currentLatitude} longitude={reviewData.currentLongitude}>
            <div style={{ width: 32, height: 38 }}><PinSvg fill="#EF4444" stroke="#B91C1C" /></div>
          </Marker>
          {/* 指摘された地点（青） */}
          <Marker latitude={reviewData.suggestedLatitude} longitude={reviewData.suggestedLongitude}>
            <div style={{ width: 32, height: 38 }}><PinSvg fill="#3B82F6" stroke="#1D4ED8" /></div>
          </Marker>
        </Map>
      </div>
    )
  }

  // エラー表示
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black/50">
        <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
          <p className="text-lg text-red-600 mb-6">{error}</p>
          <button
            className="px-6 py-2 bg-white text-black border border-black rounded-full"
            onClick={handleClose}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    )
  }

  // 解決済み
  if (isResolved) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black/50">
        <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
          <p className="text-lg mb-6">{resolvedMessage}</p>
          <button
            className="px-6 py-2 bg-white text-black border border-black rounded-full"
            onClick={handleClose}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    )
  }

  // ローディング
  if (isLoading || !reviewData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">{t('common.loading')}</p>
      </div>
    )
  }

  // メインレビュー画面（ダイアログスタイル）
  const imageStyle: React.CSSProperties = {}
  if (reviewData.cropCenterX != null && reviewData.cropCenterY != null) {
    imageStyle.objectPosition = `${reviewData.cropCenterX * 100}% ${reviewData.cropCenterY * 100}%`
  }
  if (reviewData.cropZoom != null && reviewData.cropZoom > 1) {
    imageStyle.transform = `scale(${reviewData.cropZoom})`
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-lg overflow-hidden max-h-[90dvh] flex flex-col">
        {/* 写真 */}
        <div className="relative w-full aspect-[4/3] overflow-hidden flex-shrink-0">
          <img
            src={reviewData.imageUrl}
            alt={t('reviewLocation.photoAlt')}
            className="w-full h-full object-cover"
            style={imageStyle}
            data-testid="review-photo"
          />
        </div>

        {/* スクロール可能コンテンツ */}
        <div className="overflow-y-auto px-6 pt-4 pb-6 flex-1">
          {/* 表示名 */}
          <p className="text-sm font-medium mb-2" data-testid="review-username">
            {reviewData.username}
          </p>

          {/* メタデータ */}
          <div className="flex flex-col gap-1 mb-4 text-sm text-gray-600">
            {reviewData.shotAt && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span data-testid="review-shot-at">{formatShotAt(reviewData.shotAt)}</span>
              </div>
            )}
            {reviewData.placeName && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span data-testid="review-place-name">{reviewData.placeName}</span>
              </div>
            )}
          </div>

          {/* ミニマップ（2ピン） */}
          <div
            className="w-full h-[200px] rounded-lg overflow-hidden mb-4 cursor-pointer"
            onClick={() => setIsSpotPreview(true)}
            data-testid="review-minimap"
          >
            <Map
              mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
              initialViewState={{
                latitude: reviewData.suggestedLatitude,
                longitude: reviewData.suggestedLongitude,
                zoom: 15,
              }}
              mapStyle={MAPBOX_STYLE}
              interactive={false}
              style={{ width: '100%', height: '100%' }}
            >
              <Marker latitude={reviewData.currentLatitude} longitude={reviewData.currentLongitude}>
                <div style={{ width: 24, height: 28 }}><PinSvg fill="#EF4444" stroke="#B91C1C" /></div>
              </Marker>
              <Marker latitude={reviewData.suggestedLatitude} longitude={reviewData.suggestedLongitude}>
                <div style={{ width: 24, height: 28 }}><PinSvg fill="#3B82F6" stroke="#1D4ED8" /></div>
              </Marker>
            </Map>
          </div>

          {/* アクションボタン */}
          <div className="flex gap-3">
            <button
              className="flex-1 py-2.5 bg-black text-white rounded-full text-sm font-medium disabled:opacity-50"
              onClick={() => handleAction('accept')}
              disabled={isLoading}
            >
              {t('reviewLocation.accept')}
            </button>
            <button
              className="flex-1 py-2.5 bg-white text-black border border-black rounded-full text-sm font-medium disabled:opacity-50"
              onClick={() => handleAction('reject')}
              disabled={isLoading}
            >
              {t('reviewLocation.reject')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
