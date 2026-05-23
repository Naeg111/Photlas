import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Map, { Marker } from 'react-map-gl'
import { MapPin, Calendar, User } from 'lucide-react'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'
import { MAPBOX_LANGUAGE_MAP, type SupportedLanguage } from '../i18n'
import { PinSvg } from '../components/PinSvg'
import { LoginDialog } from '../components/LoginDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, getAuthHeaders } from '../utils/apiClient'
import { fetchJson } from '../utils/fetchJson'
import { getRateLimitInlineMessage } from '../utils/notifyIfRateLimited'
import { computeBoundsForPins } from '../utils/geoBounds'
import { API_V1_URL } from '../config/api'

/**
 * Issue#65, Issue#54: 位置情報修正のレビューページ（ダイアログスタイル）
 * Issue#145: 共通 Dialog 化・正方形サムネ・投稿者アイコン・地図言語・白黒/赤ピン・自動フィット・共通 Button
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
  profileImageUrl?: string | null
  placeName: string
  shotAt: string
  cropCenterX: number | null
  cropCenterY: number | null
  cropZoom: number | null
}

/**
 * Issue#145: 元位置（白黒ピン）と指摘位置（赤ピン）の 2 ピンを描画する。
 * 形状・サイズは同一で色だけ差別化し、赤（指摘）を後に描画して手前に重ねる。
 * ミニマップと全画面プレビューで共通利用する。
 */
function ReviewMarkers({
  currentLatitude,
  currentLongitude,
  suggestedLatitude,
  suggestedLongitude,
  pinSize,
}: Readonly<{
  currentLatitude: number
  currentLongitude: number
  suggestedLatitude: number
  suggestedLongitude: number
  pinSize: { width: number; height: number }
}>) {
  return (
    <>
      {/* 元の登録位置（白黒・投稿詳細のミニマップと同じ） */}
      <Marker latitude={currentLatitude} longitude={currentLongitude} anchor="bottom">
        <div style={{ width: pinSize.width, height: pinSize.height, pointerEvents: 'none' }}>
          <PinSvg fill="#ffffff" stroke="#000000" strokeWidth={2} strokeLinejoin="round">
            <circle cx="16" cy="14" r="6" fill="#000000" stroke="#000000" strokeWidth="1" />
          </PinSvg>
        </div>
      </Marker>
      {/* 指摘位置（赤・形状は白黒ピンと同一、色のみ差別化） */}
      <Marker latitude={suggestedLatitude} longitude={suggestedLongitude} anchor="bottom">
        <div style={{ width: pinSize.width, height: pinSize.height, pointerEvents: 'none' }}>
          <PinSvg fill="#EF4444" stroke="#B91C1C" strokeWidth={2} strokeLinejoin="round" />
        </div>
      </Marker>
    </>
  )
}

/**
 * Issue#145: 確認画面のミニマップ。
 * - 2 ピンが必ず収まるよう bounds で自動フィット
 * - ユーザー言語で地名ラベル表示（language）
 * - Dialog 開閉アニメーション中の Marker 位置ずれを防ぐため 500ms 遅延描画（DetailMiniMap と同じ）
 */
function ReviewMiniMap({
  currentLatitude,
  currentLongitude,
  suggestedLatitude,
  suggestedLongitude,
  mapboxLang,
  onClick,
}: Readonly<{
  currentLatitude: number
  currentLongitude: number
  suggestedLatitude: number
  suggestedLongitude: number
  mapboxLang: string
  onClick: () => void
}>) {
  const [isMapReady, setIsMapReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setIsMapReady(true), 500)
    return () => clearTimeout(timer)
  }, [])

  const bounds = computeBoundsForPins(
    { lng: currentLongitude, lat: currentLatitude },
    { lng: suggestedLongitude, lat: suggestedLatitude },
  )

  return (
    <div
      className="w-full h-[200px] rounded-lg overflow-hidden mb-[26px] cursor-pointer"
      onClick={onClick}
      data-testid="review-minimap"
    >
      {isMapReady ? (
        <Map
          mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
          initialViewState={{ bounds, fitBoundsOptions: { padding: 40, maxZoom: 16 } }}
          mapStyle={MAPBOX_STYLE}
          language={mapboxLang}
          interactive={false}
          style={{ width: '100%', height: '100%' }}
        >
          <ReviewMarkers
            currentLatitude={currentLatitude}
            currentLongitude={currentLongitude}
            suggestedLatitude={suggestedLatitude}
            suggestedLongitude={suggestedLongitude}
            pinSize={{ width: 24, height: 28 }}
          />
        </Map>
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
    </div>
  )
}

export default function ReviewLocationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const mapboxLang = MAPBOX_LANGUAGE_MAP[i18n.language as SupportedLanguage] || 'en'
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

  // 未ログイン (#9: shadcn Dialog で他画面と統一、閉じ手段は全て封じる)
  if (!user) {
    return (
      <>
        <Dialog open>
          <DialogContent
            hideCloseButton
            onEscapeKeyDown={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{t('reviewLocation.confirmTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-lg">{t('auth.loginRequired')}</p>
              <p className="text-sm text-gray-600">{t('reviewLocation.loginRequired')}</p>
              <div className="flex justify-end">
                <Button onClick={() => setIsLoginDialogOpen(true)}>
                  {t('common.login')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <LoginDialog
          open={isLoginDialogOpen}
          onOpenChange={setIsLoginDialogOpen}
          onShowSignUp={() => setIsLoginDialogOpen(false)}
          onShowPasswordReset={() => setIsLoginDialogOpen(false)}
        />
      </>
    )
  }

  // フルスクリーンマップ（撮影場所プレビュー）— 2 ピンを自動フィットで両方表示
  if (isSpotPreview && reviewData) {
    const previewBounds = computeBoundsForPins(
      { lng: reviewData.currentLongitude, lat: reviewData.currentLatitude },
      { lng: reviewData.suggestedLongitude, lat: reviewData.suggestedLatitude },
    )
    return (
      <div
        className="fixed inset-0 z-50"
        onClick={() => setIsSpotPreview(false)}
        data-testid="spot-preview-overlay"
      >
        <Map
          mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
          initialViewState={{ bounds: previewBounds, fitBoundsOptions: { padding: 60, maxZoom: 16 } }}
          mapStyle={MAPBOX_STYLE}
          language={mapboxLang}
          style={{ width: '100%', height: '100%' }}
        >
          <ReviewMarkers
            currentLatitude={reviewData.currentLatitude}
            currentLongitude={reviewData.currentLongitude}
            suggestedLatitude={reviewData.suggestedLatitude}
            suggestedLongitude={reviewData.suggestedLongitude}
            pinSize={{ width: 32, height: 38 }}
          />
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
          <Button variant="outline" onClick={handleClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    )
  }

  // 解決済み (#11 受け入れ後 / #12 拒否後) - shadcn Dialog で他ダイアログと統一
  if (isResolved) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent hideCloseButton className="text-center">
          <p className="text-lg mb-6">{resolvedMessage}</p>
          <div className="flex justify-center">
            <Button variant="outline" onClick={handleClose}>
              {t('common.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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

  // メインレビュー画面（shadcn Dialog で他ダイアログと統一・中央表示・閉じ手段なし）
  return (
    <Dialog open>
      <DialogContent
        hideCloseButton
        className="p-0 gap-0 overflow-hidden max-h-[90dvh] flex flex-col"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{t('reviewLocation.confirmTitle')}</DialogTitle>

        {/* 写真（投稿詳細と同じ正方形クロップ・クロップ済みサムネをそのまま表示） */}
        <div className="relative w-full aspect-square overflow-hidden flex-shrink-0">
          <img
            src={reviewData.thumbnailUrl}
            alt={t('reviewLocation.photoAlt')}
            loading="eager"
            className="w-full h-full object-cover"
            data-testid="review-photo"
          />
        </div>

        {/* スクロール可能コンテンツ */}
        <div className="overflow-y-auto px-6 pt-4 pb-6 flex-1">
          {/* 投稿者アイコン + 表示名 */}
          <div className="flex items-center gap-2 mb-2">
            {reviewData.profileImageUrl ? (
              <img
                data-testid="review-avatar"
                src={reviewData.profileImageUrl}
                alt={reviewData.username}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div
                data-testid="review-avatar-placeholder"
                className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center"
              >
                <User className="w-5 h-5 text-gray-500" />
              </div>
            )}
            <p className="text-sm font-medium" data-testid="review-username">
              {reviewData.username}
            </p>
          </div>

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

          {/* ミニマップ（白黒=元位置 / 赤=指摘位置、自動フィット） */}
          <ReviewMiniMap
            currentLatitude={reviewData.currentLatitude}
            currentLongitude={reviewData.currentLongitude}
            suggestedLatitude={reviewData.suggestedLatitude}
            suggestedLongitude={reviewData.suggestedLongitude}
            mapboxLang={mapboxLang}
            onClick={() => setIsSpotPreview(true)}
          />

          {/* アクションボタン（左=拒否 / 右=受け入れ、共通 Button） */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleAction('reject')}
              disabled={isLoading}
            >
              {t('reviewLocation.reject')}
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleAction('accept')}
              disabled={isLoading}
            >
              {t('reviewLocation.accept')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
